/* @flow */

import {join, basename} from 'path'

export type TreeNode = {
  name: string;
  isDir: boolean;
  isExe: boolean;
  children: Array<TreeNode>;
  mtimeTicks: number;
  hash: ?string;
}

export type Util = {
  copy: (source: string, target: string) => Promise<void>;
  readText: (sourcePath: string) => Promise<string>;
  writeText: (text: string, targetPath: string) => Promise<void>;
  stat: (path: string) => Promise<any>;
  statNode: (fullPath: string) => Promise<TreeNode>;
  makeTreeNode: (name: string, isDir: boolean, isExe: boolean, children: Array<TreeNode>, mtimeTicks: number, hash: ?string) => TreeNode;
  cloneTreeNode: (node: TreeNode) => TreeNode;
  fromFs: (fs: any) => Util;
}

function util (fs: any) : Util {
  if (!fs) {
    fs = require('fs')
  }
  let u = {}

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
          Promise.all(files.map((fileName) => {
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
        throw new Error('')
      }
    })
  }

  u.copy = copy
  u.readText = readText
  u.writeText = writeText
  u.stat = stat
  u.statNode = statNode
  u.makeTreeNode = makeTreeNode
  u.cloneTreeNode = cloneTreeNode
  u.fromFs = util

  return u
}

module.exports = util()
