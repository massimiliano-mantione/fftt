/* @flow */

import shortid from 'shortid'
import nameFilter from './nameFilter'
import hash from './hash'
import run from './runner'

import type {FileFilter, TreeNode, TreeNodeMap} from './fileFilter'
import type {TaskArgument, Task, BuildGraph} from './tasks'

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

export type CommandResult = {
  out: string;
  all: string;
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
  evaluateSourceArgument: (sourceBase: string, arg: TaskArgument) => Promise<string>;
  evaluateCommandArgument: (arg: TaskArgument, graph: BuildGraph, tag: string) => Promise<string>;
  evaluateTaskArgument: (arg: TaskArgument, graph: BuildGraph, tag: string) => Promise<string>;
  expandTaskArgument: (arg: TaskArgument, graph: BuildGraph, tag: string) => Promise<TreeNode>;
  storeResult: (workDir: Workdir, task: Task, tag: string, link: boolean) => Promise<CommandResult>;
  evaluateTask: (task: Task, graph: BuildGraph, tag: string) => Promise<string>;
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

  function evaluateSourceArgument (sourceBase: string, arg: TaskArgument): Promise<string> {
    if (!arg.source) {
      throw new Error('Source required')
    }
    let sourcePath = ff.join(sourceBase, arg.source)
    let glob = arg.files
    sourcePath = ff.join(sourcePath, glob.from)
    let sourceTree = ff.makeEmptyDirNode()
    return ff.scanDir(sourcePath, ff.nameFilter.fromGlobArray(glob.files)).then(tree => {
      if (!tree) {
        tree = ff.makeEmptyDirNode()
      }
      sourceTree = tree
      return storeTree(sourcePath, sourceTree, false)
    }).then(h => {
      let resultTree = prependPath(glob.to, sourceTree)
      if (resultTree !== sourceTree) {
        return storeTree(null, resultTree, false)
      } else {
        return Promise.resolve(h)
      }
    })
  }

  function evaluateCommandArgument (arg: TaskArgument, graph: BuildGraph, tag: string): Promise<string> {
    if (!arg.id) {
      throw new Error('Id required')
    }
    let id: string = arg.id
    let task = graph.tasks[arg.id]
    if (!task) {
      throw new Error('Task ' + arg.id + ' not found')
    }
    let taskTree = ff.makeEmptyDirNode()
    return evaluateTask(task, graph, tag).catch(err => {
      console.error('Error evaluating task ' + id + ': ' + err)
      return Promise.reject(err)
    }).then(h => {
      return extractTree(h)
    }).then(tree => {
      let glob = arg.files
      let fromTree = walkPath(glob.from, tree)
      if (!fromTree) {
        taskTree = ff.makeEmptyDirNode()
      } else {
        taskTree = fromTree
      }
      taskTree = ff.treeFilter(taskTree, ff.nameFilter.fromGlobArray(glob.files))
      if (!taskTree) {
        taskTree = ff.makeEmptyDirNode()
      }
      taskTree = prependPath(glob.to, taskTree)
      return storeTree(null, taskTree, true)
    })
  }

  function evaluateTaskArgument (arg: TaskArgument, graph: BuildGraph, tag: string): Promise<string> {
    if (arg.source) {
      return evaluateSourceArgument(graph.sourceRoot, arg)
    } else if (arg.id) {
      return evaluateCommandArgument(arg, graph, tag)
    } else {
      throw new Error('Invalid arg: ', arg)
    }
  }

  function expandTaskArgument (arg: TaskArgument, graph: BuildGraph, tag: string): Promise<TreeNode> {
    return evaluateTaskArgument(arg, graph, tag).then(h => {
      return extractTree(h)
    }).then(tree => {
      if (!tree) {
        return ff.makeEmptyDirNode()
      } else {
        return tree
      }
    })
  }

  function storeResult (workDir: Workdir, task: Task, tag: string, link: boolean): Promise<CommandResult> {
    let outPath = ff.join(workDir.out, task.out.from)
    let tagPath = ff.join(OUT, tag)
    let outTree = ff.makeEmptyDirNode()
    let outHash = hash.EMPTY
    let allHash = hash.EMPTY
    return ff.scanDir(outPath, ff.nameFilter.fromGlobArray(task.out.files)).then(tree => {
      if (!tree) {
        tree = ff.makeEmptyDirNode()
      }
      outTree = tree
      return storeTree(outPath, outTree, link)
    }).then(h => {
      let toTree = prependPath(task.out.to, outTree)
      if (toTree === outTree) {
        return Promise.resolve(h)
      } else {
        return storeTree(null, outTree, link)
      }
    }).then(h => {
      outHash = h
      return Promise.all([
        storeFile(workDir.exit, false, true),
        storeFile(workDir.stdout, false, true),
        storeFile(workDir.stderr, false, true)
      ])
    }).then(hashes => {
      let dirData = {
        out: outHash,
        exit: hashes[0],
        stdout: hashes[1],
        stderr: hashes[2]
      }
      return hashAndWriteDir(dirData, false)
    }).then(h => {
      allHash = h
      if (task.hash !== hash.EMPTY) {
        let resultHash = task.hash + '-' + workDir.inHash
        let memDir = ff.join(MEM, resultHash)
        return ff.mkdirp(memDir).then(() => {
          return Promise.all([
            ff.writeText(outHash, ff.join(memDir, 'out')),
            ff.writeText(allHash, ff.join(memDir, 'all')),
            ff.hlink(ff.join(OBJ, allHash), ff.join(memDir, 'lnk'))
          ])
        })
      } else {
        return Promise.resolve()
      }
    }).then(() => {
      return checkOutTree(outHash)
    }).then(() => {
      return ff.mkdirp(tagPath)
    }).then(() => {
      return ff.slink(ff.join(MNT, outHash), ff.join(tagPath, task.id))
    }).then(() => {
      return Promise.resolve({out: outHash, all: allHash})
    })
  }

  function evaluateTask (task: Task, graph: BuildGraph, tag: string): Promise<string> {
    if (task.lock) {
      throw new Error('Recursive evaluation of task ' + task.id)
    }
    task.lock = true
    let taskInput = (task.in ? task.in : [])
    let argTrees = taskInput.map(arg => expandTaskArgument(arg, graph, tag))
    let inHash = hash.EMPTY
    return Promise.all(argTrees).then(trees => {
      let inTree = mergeTrees(trees)
      return storeTree(null, inTree, false)
    }).then(h => {
      inHash = h
      return checkOutTree(inHash)
    }).then(() => {
      if (task.run) {
        let taskCommand = task.run
        return makeWorkDir(inHash).then(workDir => {
          return run(ff, repo, workDir, taskCommand).then(() => {
            return storeResult(workDir, task, tag, true)
          })
        }).then(commandResult => {
          return commandResult.out
        })
      } else {
        return Promise.resolve(inHash)
      }
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
    evaluateSourceArgument,
    evaluateCommandArgument,
    evaluateTaskArgument,
    expandTaskArgument,
    storeResult,
    evaluateTask,
    ROOT: root,
    OBJ, MEM, DIR, FIX, TMP, MNT, OUT
  }

  return Promise.all([OBJ, MEM, DIR, FIX, TMP, MNT, OUT].map(p => { ff.mkdirp(p) })).then(() => {
    return repo
  })
}

export default repository
