/* @flow */

import shortid from 'shortid'
import nameFilter from './nameFilter'
import hash from './hash'

import type {FileFilter, TreeNode, TreeNodeMap} from './fileFilter'

export type Workdir = {
  base: string;
  env: string;
  in: string;
  inHash: string;
  out: string;
  exit: string;
  stdout: string;
  stderr: string;
}

export type Repo = {
  storeTree: (path: ?string, node: TreeNode, storeFilesAsLinks: boolean) => Promise<string>;
  storeFile: (path: string, isExe: boolean, storeFilesAsLinks: boolean) => Promise<string>;
  storeDir: (path: ?string, isLink: boolean, children: TreeNodeMap, storeFilesAsLinks: boolean) => Promise<string>;
  checkOutTree: (hash: string) => Promise<string>;
  extractTree: (hash: string) => Promise<TreeNode>;
  prependPath: (path: string, tree: TreeNode) => TreeNode;
  walkPath: (path: string, tree: TreeNode) => ?TreeNode;
  mergeTrees2: (tree1: TreeNode, tree2: TreeNode, treeName: string) => TreeNode;
  mergeTrees: (trees: Array<TreeNode>) => TreeNode;
  makeWorkDir: (inHash: string) => Promise<Workdir>;
  ROOT: string;
  OBJ: string;
  MEM: string;
  DIR: string;
  FIX: string;
  TMP: string;
  MNT: string;
  OUT: string;
}

function repository (ff: FileFilter, root: string): Promise<Repo> {
  let OBJ = ff.join(root, 'obj')
  let MEM = ff.join(root, 'mem')
  let DIR = ff.join(root, 'dir')
  let FIX = ff.join(root, 'fix')
  let TMP = ff.join(root, 'tmp')
  let MNT = ff.join(root, 'mnt')
  let OUT = ff.join(root, 'out')

  function storeTree (path: ?string, node: TreeNode, storeFilesAsLinks: boolean): Promise<string> {
    if (node.hash !== hash.EMPTY) {
      return Promise.resolve(node.hash)
    } else {
      let hPromise = (node.isDir)
        ? storeDir(path, node.isLink, node.children, storeFilesAsLinks)
        : (path ? storeFile(path, node.isExe, storeFilesAsLinks) : Promise.reject(new Error('File path is null')))
      return hPromise.then(h => {
        node.hash = h
        return h
      })
    }
  }

  function storeFile (path: string, isExe: boolean, storeFilesAsLinks: boolean): Promise<string> {
    let fileHash = hash.EMPTY
    return hash.hashStream(ff.createReadStream(path), isExe ? 'X' : 'F').then(h => {
      fileHash = h
      let fileInRepo = ff.join(OBJ, fileHash)
      // TODO: refcount-protected writes
      if (storeFilesAsLinks) {
        return ff.hlink(path, fileInRepo)
      } else {
        return ff.copy(path, fileInRepo)
      }
    }).then(() => {
      return fileHash
    })
  }

  function hashAndWriteDir (dirData: Object, isLink: boolean): Promise<string> {
    let childNames = Object.keys(dirData)
    let dirHash = hash.hashObject('{}', dirData, isLink ? 'L' : 'D')
    // TODO: refcount-protected writes
    let dirDir = ff.join(DIR, dirHash)
    let dirFix = ff.join(FIX, dirHash)
    return Promise.all([
      ff.mkdirp(dirDir),
      ff.mkdirp(dirFix),
      ff.writeText(JSON.stringify(dirData), ff.join(OBJ, dirHash))
    ]).then(() => {
      let linkOperations = childNames.map(childName => {
        let childHash = dirData[childName]
        if (hash.isDirectory(childHash)) {
          return Promise.all([
            ff.hlink(ff.join(OBJ, childHash), ff.join(dirFix, childName)),
            ff.slink(ff.join(DIR, childHash), ff.join(dirDir, childName))
          ])
        } else {
          return ff.hlink(ff.join(OBJ, childHash), ff.join(dirDir, childName))
        }
      })
      return Promise.all(linkOperations)
    }).then(() => {
      return dirHash
    })
  }

  function storeDir (path: ?string, isLink: boolean, children: TreeNodeMap, storeFilesAsLinks: boolean): Promise<string> {
    let dirData = {}
    let childNames = Object.keys(children)
    return Promise.all(childNames.map(childName => {
      let childPath = path ? ff.join(path, childName) : null
      let childNode = children[childName]
      return storeTree(childPath, childNode, storeFilesAsLinks)
    })).then(() => {
      for (let childName of childNames) {
        dirData[childName] = children[childName].hash
      }
      return hashAndWriteDir(dirData, isLink)
    })
  }

  function checkOutFile (path: string, h: string): Promise<void> {
    return ff.hlink(ff.join(OBJ, h), path)
  }

  function checkOutDirectory (path: string, h: string): Promise<void> {
    return ff.readText(ff.join(OBJ, h)).then(text => {
      let dir = JSON.parse(text)
      let todo = Object.keys(dir).map(name => {
        let childHash = dir[name]
        let childPath = ff.join(path, name)
        if (hash.isDirectory(childHash)) {
          return ff.mkdirp(childPath).then(() => {
            return checkOutDirectory(childPath, childHash)
          })
        } else {
          return checkOutFile(childPath, childHash)
        }
      })
      return Promise.all(todo)
    }).then(() => {
      return
    })
  }

  function checkOutTree (h: string): Promise<string> {
    let path = ff.join(MNT, h)
    return ff.stat(path).then(stats => {
      if (stats.isDirectory()) {
        return Promise.resolve(path)
      } else {
        return Promise.reject()
      }
    }).catch(() => {
      if (hash.isDirectory(h)) {
        return ff.mkdirp(path).then(() => {
          return checkOutDirectory(path, h)
        })
      } else {
        return checkOutFile(path, h)
      }
    }).then(() => {
      return path
    })
  }

  function extractTree (h: string): Promise<TreeNode> {
    if (hash.isDirectory(h)) {
      let children = {}
      let result = ff.makeTreeNode(true, false, hash.isLink(h), children, 0, h)
      return ff.readText(ff.join(OBJ, h)).then(text => {
        return JSON.parse(text)
      }).then(dirData => {
        return Promise.all(Object.keys(dirData).map(name => {
          let childHash = dirData[name]
          return extractTree(childHash).then(childNode => {
            children[name] = childNode
          })
        }))
      }).then(() => {
        return result
      })
    } else {
      return Promise.resolve(ff.makeTreeNode(false, hash.isExecutable(h), false, {}, 0, h))
    }
  }

  function prependPath (path: string, tree: TreeNode): TreeNode {
    let components = nameFilter.splitPath(path)
    components.reverse()
    for (let component of components) {
      let children = {}
      children[component] = tree
      tree = ff.makeTreeNode(true, false, false, children, 0, hash.EMPTY)
    }
    return tree
  }

  function walkPath (path: string, tree: TreeNode): ?TreeNode {
    let components = nameFilter.splitPath(path)
    for (let component of components) {
      if (tree.isDir && tree.children[component]) {
        tree = tree.children[component]
      } else {
        return null
      }
    }
    return tree
  }

  function mergeTrees2 (tree1: TreeNode, tree2: TreeNode, treeName: string): TreeNode {
    if (tree1.isDir && tree2.isDir) {
      let result = ff.cloneTreeNode(tree1)
      result.hash = hash.EMPTY
      for (let childName of ff.childNames(tree2)) {
        let otherTree = tree2.children[childName]
        if (result.children[childName]) {
          result.children[childName] = mergeTrees2(result.children[childName], otherTree, childName)
        } else {
          result.children[childName] = ff.cloneTreeNode(otherTree)
        }
      }
      return result
    } else if (tree1.isDir || tree2.isDir) {
      throw new Error('Cannot merge a file and a directory (item name "' + treeName + '")')
    } else {
      return ff.cloneTreeNode(tree2)
    }
  }

  function mergeTrees (trees: Array<TreeNode>): TreeNode {
    if (trees.length === 0) {
      return ff.makeEmptyDirNode()
    } else if (trees.length === 1) {
      return ff.cloneTreeNode(trees[0])
    } else {
      let isFirst = true
      let result = trees[0]
      for (let tree of trees) {
        if (isFirst) {
          isFirst = false
        } else {
          result = mergeTrees2(result, tree, 'root')
        }
      }
      return result
    }
  }

  function makeWorkDir (inHash: string): Promise<Workdir> {
    let baseName = shortid.generate()
    let base = ff.join(TMP, baseName)
    let env = ff.join(base, 'env')
    let result = {
      base: base,
      env: env,
      in: ff.join(env, 'in'),
      inHash: inHash,
      out: ff.join(env, 'out'),
      exit: ff.join(base, 'exit'),
      stdout: ff.join(base, 'stdout'),
      stderr: ff.join(base, 'stderr')
    }
    return ff.mkdirp(base).then(() => {
      return ff.mkdirp(env)
    }).then(() => {
      Promise.all([
        ff.slink(ff.join('/repo/mnt', inHash), result.in),
        ff.mkdirp(result.out),
        ff.writeText('', result.exit),
        ff.writeText('', result.stdout),
        ff.writeText('', result.stderr)
      ])
    }).then(function (): Workdir {
      return result
    })
  }

  let repo = {
    storeTree,
    storeFile,
    storeDir,
    checkOutTree,
    extractTree,
    prependPath,
    walkPath,
    mergeTrees2,
    mergeTrees,
    makeWorkDir,
    ROOT: root,
    OBJ, MEM, DIR, FIX, TMP, MNT, OUT
  }

  return Promise.all([OBJ, MEM, DIR, FIX, TMP, MNT, OUT].map(p => { ff.mkdirp(p) })).then(() => {
    return repo
  })
}

export default repository
