/* @flow */

import {join, basename} from 'path'
import * as nameFilter from './nameFilter'
import type {NameFilter} from './nameFilter'

export type TreeNodeMap = {[key: string]: TreeNode}
export type TreeNode = {
  isDir: boolean;
  isExe: boolean;
  children: TreeNodeMap;
  mtimeTicks: number;
  hash: ?string;
}

export type FileFilter = {
  nameFilter: typeof nameFilter;
  treeFilter: (tree: TreeNode, filter: NameFilter) => ?TreeNode;
  scanDir: (fullPath: string, filter: NameFilter) => Promise<TreeNodeMap>;
  copy: (source: string, target: string) => Promise<void>;
  readText: (sourcePath: string) => Promise<string>;
  writeText: (text: string, targetPath: string) => Promise<void>;
  stat: (path: string) => Promise<any>;
  statNode: (fullPath: string) => Promise<TreeNode>;
  makeTreeNode: (isDir: boolean, isExe: boolean, children: TreeNodeMap, mtimeTicks: number, hash: ?string) => TreeNode;
  cloneTreeNode: (node: TreeNode) => TreeNode;
  fromFs: (fs: any) => FileFilter;
}

function childNames (node: TreeNode): Array<string> {
  return Object.keys(node.children)
}

function ff (fs: any) : FileFilter {
  if (!fs) {
    fs = require('fs')
  }
  let result = {}

  function copy (source: string, target: string): Promise<void> {
    return new Promise((resolve, reject) => {
      let sourceStream = fs.createReadStream(source)
      let targetStream = fs.createWriteStream(target)
      sourceStream.pipe(targetStream)
      sourceStream.on('error', err => { reject(err) })
      targetStream.on('error', err => { reject(err) })
      targetStream.on('finish', () => { resolve() })
    })
  }

  function readText (sourcePath: string): Promise<string> {
    return new Promise((resolve, reject) => {
      fs.readFile(sourcePath, {encoding: 'utf8'}, (err, data) => {
        if (err) reject(err)
        else resolve(data)
      })
    })
  }

  function writeText (text: string, targetPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(targetPath, text, {encoding: 'utf8'}, (err) => {
        if (err) reject(err)
        else resolve()
      })
    })
  }

  function stat (path: string): Promise<any> {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats) => {
        if (err) reject(err)
        else resolve(stats)
      })
    })
  }

  function makeTreeNode (isDir: boolean, isExe: boolean, children: TreeNodeMap = {}, mtimeTicks: number = 0, hash: ?string = null): TreeNode {
    return {
      isDir: isDir,
      isExe: isExe,
      mtimeTicks: mtimeTicks,
      hash: hash,
      children: children
    }
  }

  function cloneTreeNode (node: TreeNode): TreeNode {
    let children = {}
    childNames(node).forEach(k => {
      children[k] = cloneTreeNode(node.children[k])
    })
    return {
      isDir: node.isDir,
      isExe: node.isExe,
      children: children,
      mtimeTicks: node.mtimeTicks,
      hash: node.hash
    }
  }

  function statDir (fullPath: string): Promise<TreeNode> {
    return new Promise((resolve, reject) => {
      fs.readdir(fullPath, (err, files) => {
        if (err) {
          reject(err)
        } else {
          let children = {}
          Promise.all(files.sort().map((fileName) => {
            return statNode(join(fullPath, fileName)).then(child => {
              children[fileName] = child
            })
          })).then(() => {
            return Promise.resolve(makeTreeNode(true, false, children))
          })
          .then((stats) => resolve(stats))
          .catch((err) => { reject(err) })
        }
      })
    })
  }

  function isExecutable (stats) {
    return !!(1 & parseInt((stats.mode & parseInt('777', 8)).toString(8)[0], 10))
  }

  function statNode (fullPath: string): Promise<TreeNode> {
    return stat(fullPath)
    .then((stats) => {
      if (stats.isFile()) {
        return Promise.resolve(makeTreeNode(false, isExecutable(stats), {}, stats.mtime.getTime()))
      } else if (stats.isDirectory()) {
        return statDir(fullPath)
      } else {
        throw new Error('File is neither a file nor a directory: ' + basename(fullPath))
      }
    })
  }

  function treeFilter (tree: TreeNode, filter: NameFilter) : TreeNode {
    let children = {}
    let result = makeTreeNode(tree.isDir, tree.isExe, children, tree.mtimeTicks, tree.hash)
    childNames(tree).forEach((name) => {
      let treeChild = tree.children[name]
      let filterResult = filter(name, treeChild.isDir)

      if (filterResult) {
        let resultChild = treeFilter(treeChild, filterResult.next)

        if (childNames(resultChild).length > 0 || !filterResult.volatile) {
          children[name] = resultChild
        }
      }
    })
    return result
  }

  function scanDir (path: string, filter: NameFilter): Promise<TreeNodeMap> {
    return new Promise((resolve, reject) => {
      fs.readdir(path, (err, files) => {
        if (err) {
          reject(err)
        } else {
          let children = {}
          Promise.all(files.sort().map((nodeName) => {
            let nodePath = join(path, nodeName)
            return stat(nodePath).then(stats => {
              let filterResult = filter(nodeName, stats.isDirectory())
              if (filterResult) {
                let fr = filterResult
                if (stats.isDirectory()) {
                  return scanDir(nodePath, filterResult.next).then(dirChildren => {
                    if ((!fr.volatile) || Object.keys(dirChildren).length > 0) {
                      children[nodeName] = makeTreeNode(true, false, dirChildren, stats.mtime.getTime())
                    }
                  })
                } else if (stats.isFile()) {
                  children[nodeName] = makeTreeNode(false, isExecutable(stats), {}, stats.mtime.getTime())
                  return Promise.resolve()
                } else {
                  throw new Error('Path is neither a file nor a directory: ' + nodePath)
                }
              } else {
                return Promise.resolve()
              }
            })
          })).then(() => {
            resolve(children)
          }).catch(err => {
            reject(err)
          })
        }
      })
    })
  }

  result.nameFilter = nameFilter
  result.treeFilter = treeFilter
  result.scanDir = scanDir
  result.copy = copy
  result.readText = readText
  result.writeText = writeText
  result.stat = stat
  result.statNode = statNode
  result.makeTreeNode = makeTreeNode
  result.cloneTreeNode = cloneTreeNode
  result.fromFs = ff

  return result
}

module.exports = ff()
