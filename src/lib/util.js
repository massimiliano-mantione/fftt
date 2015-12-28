/* @flow */

let Promise = require('any-promise')
import {join, basename} from 'path'

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

  function stat (path) {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats) => {
        if (err) reject(err)
        else resolve(stats)
      })
    })
  }

  function makeTreeNode (name: string, isDir: boolean, isExe: boolean, mtimeTicks: number = 0, hash: ?string = null, children: ?Array<TreeNode> = null): TreeNode {
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
      mtimeTicks: node.mtimeTicks,
      hash: node.hash,
      children: (node.children) ? node.children.map(cloneTreeNode) : null
    }
  }

  function statDir (path) {
    return new Promise((resolve, reject) => {
      fs.readdir(path, (err, files) => {
        if (err) {
          reject(err)
        } else {
          Promise.all(files.map((fileName) => {
            console.log('FILE', join(path, fileName))
            return statNode(join(path, fileName))
          })).then((nodes) => {
            // let actualNodes = nodes.reduce()
            return Promise.resolve()
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

  function statNode (fullPath) {
    stat(fullPath)
    .then((stats) => {
      if (stats.isFile()) {
        let fileName = basename(fullPath)
        return Promise.resolve(makeTreeNode(fileName, false, isExecutable(stats), stats.mtime.getTime()))
      } else if (stats.isDirectory()) {
        return statDir(fullPath)
      } else {
        return Promise.resolve(null)
      }
    })
  }

  u.copy = copy
  u.readText = readText
  u.writeText = writeText
  u.stat = stat
  u.makeTreeNode = makeTreeNode
  u.cloneTreeNode = cloneTreeNode
  u.fromFs = util

  return u
}

module.exports = util()
