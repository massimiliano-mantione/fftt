/* @flow */

import shortid from 'shortid'
import hash from './hash'

import type {FileFilter, TreeNode, TreeNodeMap} from './fileFilter'

export type Workdir = {
  base: string;
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
  makeWorkDir: () => Promise<Workdir>;
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

  function makeWorkDir (): Promise<Workdir> {
    let baseName = shortid.generate()
    let base = ff.join(TMP, baseName)
    let result = {
      base: base,
      in: ff.join(base, 'in'),
      inHash: '',
      out: ff.join(base, 'out'),
      exit: ff.join(base, 'exit'),
      stdout: ff.join(base, 'stdout'),
      stderr: ff.join(base, 'stderr')
    }
    return ff.mkdirp(base).then(() => {
      Promise.all([
        ff.mkdirp(result.in),
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
    makeWorkDir,
    OBJ, MEM, DIR, FIX, TMP, MNT, OUT
  }

  return Promise.all([OBJ, MEM, DIR, FIX, TMP, MNT, OUT].map(p => { ff.mkdirp(p) })).then(() => {
    return repo
  })
}

export default repository
