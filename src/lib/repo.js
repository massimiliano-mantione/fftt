/* @flow */

import shortid from 'shortid'
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
  storeTree: (path: string, node: TreeNode, storeFilesAsLinks: boolean) => Promise<string>;
  storeFile: (path: string, isExe: boolean, storeFilesAsLinks: boolean) => Promise<string>;
  storeDir: (path: string, isLink: boolean, children: TreeNodeMap, storeFilesAsLinks: boolean) => Promise<string>;
  checkOutResult: (hash: string) => Promise<string>;
  makeWorkDir: () => Promise<Workdir>;
  ROOT: string;
  OBJ: string;
  MEM: string;
  DIR: string;
  FIX: string;
  TMP: string;
  MNT: string;
  RES: string;
  OUT: string;
}

function repository (ff: FileFilter, root: string): Promise<Repo> {
  let OBJ = ff.join(root, 'obj')
  let MEM = ff.join(root, 'mem')
  let DIR = ff.join(root, 'dir')
  let FIX = ff.join(root, 'fix')
  let TMP = ff.join(root, 'tmp')
  let MNT = ff.join(root, 'mnt')
  let RES = ff.join(root, 'res')
  let OUT = ff.join(root, 'out')

  function storeTree (path: string, node: TreeNode, storeFilesAsLinks: boolean): Promise<string> {
    if (node.hash != null) {
      return Promise.resolve(node.hash)
    } else {
      let hPromise = (node.isDir)
        ? storeDir(path, node.isLink, node.children, storeFilesAsLinks)
        : storeFile(path, node.isExe, storeFilesAsLinks)
      return hPromise.then(h => {
        node.hash = h
        return h
      })
    }
  }

  function storeFile (path: string, isExe: boolean, storeFilesAsLinks: boolean): Promise<string> {
    let fileHash = ''
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

  function storeDir (path: string, isLink: boolean, children: TreeNodeMap, storeFilesAsLinks: boolean): Promise<string> {
    let dirData = {}
    let dirHash = ''
    let dirDir = ''
    let dirFix = ''
    let childNames = Object.keys(children)
    return Promise.all(childNames.map(childName => {
      let childPath = ff.join(path, childName)
      let childNode = children[childName]
      return storeTree(childPath, childNode, storeFilesAsLinks)
    })).then(() => {
      for (let childName of childNames) {
        dirData[childName] = children[childName].hash
      }
      dirHash = hash.hashObject('{}', dirData, isLink ? 'L' : 'D')
      // TODO: refcount-protected writes
      dirDir = ff.join(DIR, dirHash)
      dirFix = ff.join(FIX, dirHash)
      return Promise.all([
        ff.mkdirp(dirDir),
        ff.mkdirp(dirFix),
        ff.writeText(JSON.stringify(dirData), ff.join(OBJ, dirHash))
      ])
    }).then(() => {
      let linkOperations = childNames.map(childName => {
        let child = children[childName]
        let childHash = dirData[childName]
        if (child.isDir) {
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

  function checkOutResult (h: string): Promise<string> {
    let path = ff.join(RES, h)
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

  function makeWorkDir (): Promise<Workdir> {
    let baseName = shortid.generate()
    let base = ff.join(TMP, baseName)
    let env = ff.join(base, 'env')
    let result = {
      base: base,
      env: env,
      in: ff.join(env, 'in'),
      inHash: '',
      out: ff.join(env, 'out'),
      exit: ff.join(base, 'exit'),
      stdout: ff.join(base, 'stdout'),
      stderr: ff.join(base, 'stderr')
    }
    return ff.mkdirp(base).then(() => {
      return ff.mkdirp(env)
    }).then(() => {
      Promise.all([
        ff.slink('/repo', result.in),
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
    checkOutResult,
    makeWorkDir,
    ROOT: root,
    OBJ, MEM, DIR, FIX, TMP, MNT, RES, OUT
  }

  return Promise.all([OBJ, MEM, DIR, FIX, TMP, MNT, RES, OUT].map(p => { ff.mkdirp(p) })).then(() => {
    return repo
  })
}

export default repository
