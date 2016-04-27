/* @flow */

import * as hash from './hash'

import type {FileFilter, TreeNode, TreeNodeMap} from './fileFilter'

export type Repo = {
  storeTree: (path: string, node: TreeNode) => Promise<string>;
  storeFile: (path: string, isExe: boolean) => Promise<string>;
  storeDir: (path: string, isLink: boolean, children: TreeNodeMap) => Promise<string>;
}

function repository (ff: FileFilter, root: string): Promise<Repo> {
  let OBJ = ff.join(root, 'obj')
  let MEM = ff.join(root, 'mem')
  let DIR = ff.join(root, 'dir')
  let FIX = ff.join(root, 'fix')

  function storeTree (path: string, node: TreeNode): Promise<string> {
    if (node.hash != null) {
      return Promise.resolve(node.hash)
    } else {
      let hPromise = (node.isDir)
        ? storeDir(path, node.isLink, node.children)
        : storeFile(path, node.isExe)
      return hPromise.then(h => {
        node.hash = h
        return h
      })
    }
  }

  function storeFile (path: string, isExe: boolean): Promise<string> {
    let fileHash = ''
    return hash.hashStream(ff.createReadStream(path), isExe ? 'X' : 'F').then(h => {
      fileHash = h
      // TODO: refcount-protected writes
      return ff.copy(path, ff.join(OBJ, fileHash))
    }).then(() => {
      return fileHash
    })
  }

  function storeDir (path: string, isLink: boolean, children: TreeNodeMap): Promise<string> {
    let dirData = {}
    let dirHash = ''
    let dirDir = ''
    let dirFix = ''
    let childNames = Object.keys(children)
    return Promise.all(childNames.map(childName => {
      let childPath = ff.join(path, childName)
      let childNode = children[childName]
      return storeTree(childPath, childNode)
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

  let repo = {
    storeTree,
    storeFile,
    storeDir
  }

  return Promise.all([OBJ, MEM, DIR, FIX].map(p => { ff.mkdirp(p) })).then(() => {
    return repo
  })
}

export default repository
