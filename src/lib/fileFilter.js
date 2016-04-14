/* @flow */

import {join, basename} from 'path'
import * as nameFilter from './nameFilter'
import type {NameFilter} from './nameFilter'

export type TreeNode = {
  name: string;
  isDir: boolean;
  isExe: boolean;
  children: Array<TreeNode>;
  mtimeTicks: number;
  hash: ?string;
}

export type FileFilter = {
  nameFilter: typeof nameFilter;
  treeFilter: (tree: TreeNode, filter: NameFilter) => ?TreeNode;
  scanTree: (fullPath: string, filter: NameFilter) => Promise<?TreeNode>;
  copy: (source: string, target: string) => Promise<void>;
  readText: (sourcePath: string) => Promise<string>;
  writeText: (text: string, targetPath: string) => Promise<void>;
  stat: (path: string) => Promise<any>;
  statNode: (fullPath: string) => Promise<TreeNode>;
  makeTreeNode: (name: string, isDir: boolean, isExe: boolean, children: Array<TreeNode>, mtimeTicks: number, hash: ?string) => TreeNode;
  cloneTreeNode: (node: TreeNode) => TreeNode;
  fromFs: (fs: any) => FileFilter;
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

  function makeTreeNode (name: string, isDir: boolean, isExe: boolean, children: Array<TreeNode> = [], mtimeTicks: number = 0, hash: ?string = null): TreeNode {
    return {
      name: name,
      isDir: isDir,
      isExe: isExe,
      mtimeTicks: mtimeTicks,
      hash: hash,
      children: children
    }
  }

  function cloneTreeNode (node: TreeNode): TreeNode {
    return {
      name: node.name,
      isDir: node.isDir,
      isExe: node.isExe,
      children: node.children.map(cloneTreeNode),
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
          Promise.all(files.sort().map((fileName) => {
            return statNode(join(fullPath, fileName))
          })).then((nodes) => {
            return Promise.resolve(makeTreeNode(
              basename(fullPath),
              true,
              false,
              nodes
            ))
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
        let fileName = basename(fullPath)
        return Promise.resolve(makeTreeNode(fileName, false, isExecutable(stats), [], stats.mtime.getTime()))
      } else if (stats.isDirectory()) {
        return statDir(fullPath)
      } else {
        throw new Error('File is neither a file nor a directory: ' + basename(fullPath))
      }
    })
  }

  function treeFilter (tree: TreeNode, filter: NameFilter) : ?TreeNode {
    let filterResult = filter(tree.name, tree.isDir)
    if (filterResult) {
      let res = makeTreeNode(
          filterResult.name,
          tree.isDir,
          tree.isExe,
          [],
          tree.mtimeTicks,
          tree.hash)
      let nextFilter = filterResult.next
      if (tree.isDir) {
        tree.children.forEach((child) => {
          let filteredChild = treeFilter(child, nextFilter)
          if (filteredChild) {
            res.children.push(filteredChild)
          }
        })
      }

      if (filterResult.volatile && res.children.length === 0) {
        return null
      } else {
        return res
      }
    } else {
      return null
    }
  }

  function scanTree (fullPath: string, filter: NameFilter) : Promise<?TreeNode> {
    return stat(fullPath)
    .then((stats) => {
      let nodeName = basename(fullPath)
      let filterResult = filter(nodeName, stats.isDirectory())

      if (filterResult) {
        let fr = filterResult
        if (stats.isFile()) {
          return Promise.resolve(makeTreeNode(nodeName, false, isExecutable(stats), [], stats.mtime.getTime()))
        } else if (stats.isDirectory()) {
          return new Promise((resolve, reject) => {
            fs.readdir(fullPath, (err, files) => {
              if (err) {
                reject(err)
              } else {
                Promise.all(files.sort().map((fileName) => {
                  return scanTree(join(fullPath, fileName), fr.next)
                })).then((nodes) => {
                  nodes = nodes.filter(node => node != null)
                  if (fr.volatile && nodes.length === 0) {
                    return Promise.resolve(null)
                  } else {
                    return Promise.resolve(makeTreeNode(
                      basename(fullPath),
                      true,
                      false,
                      nodes,
                      stats.mtime.getTime()
                    ))
                  }
                })
                .then((stats) => resolve(stats))
                .catch((err) => { reject(err) })
              }
            })
          })
        } else {
          throw new Error('Path is neither a file nor a directory: ' + fullPath)
        }
      } else {
        return Promise.resolve(null)
      }
    })
  }

  result.nameFilter = nameFilter
  result.treeFilter = treeFilter
  result.scanTree = scanTree
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
