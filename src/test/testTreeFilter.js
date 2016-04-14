/* @flow */

import {expect} from 'code'
import * as Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe} = require('./promisify-lab')(lab)

import * as fsData from './fs-data'
import * as fileFilter from '../lib/fileFilter'

function checkTree (node, check) {
  check(node)
  if (node) {
    node.children.forEach(child => {
      checkTree(child, check)
    })
  }
  return Promise.resolve()
}

function checkTreeForSuffix (node, suffix, dirs) {
  let foundDirs = []
  return checkTree(node, node => {
    if (!node) {
      expect(node).to.not.equal(null)
    } else if (node.isDir) {
      foundDirs.push(node.name)
    } else {
      expect(node.name.indexOf(suffix)).to.equal(node.name.length - suffix.length)
    }
  }).then(() => {
    expect(dirs).to.deep.equal(foundDirs)
    return Promise.resolve()
  })
}

describe('treeFilter', () => {
  let fs = fsData.fs()
  let ff = fileFilter.fromFs(fs)
  let treeFilter = ff.treeFilter
  let scanTree = ff.scanTree

  it('filters trees', () => {
    let tree = ff.statNode('/data')
    let glob = ff.nameFilter._.fromGlobString('**/*.txt')
    return tree.then(t => {
      let filtered = treeFilter(t, glob)
      return checkTreeForSuffix(filtered, '.txt', [ 'data', 'dir1', 'dir1txt', 'dir2', 'dir2txt' ])
    })
  })

  it('scans trees', () => {
    let glob = ff.nameFilter._.fromGlobString('**/*.txt')
    return scanTree('/data', glob).then(filtered => {
      return checkTreeForSuffix(filtered, '.txt', [ 'data', 'dir1', 'dir1txt', 'dir2', 'dir2txt' ])
    })
  })
})
