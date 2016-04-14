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
}

describe('treeFilter', () => {
  let fs = fsData.fs()
  let ff = fileFilter.fromFs(fs)
  let treeFilter = ff.treeFilter

  it('filters trees', () => {
    let tree = ff.statNode('/data')
    let glob = ff.nameFilter._.fromGlobString('**/*.txt')
    tree.then(t => {
      let filtered = treeFilter.filter(t, glob)
      let dirs = []
      checkTree(filtered, node => {
        if (!node) {
          expect(node).to.not.equal(null)
        } else if (node.isDir) {
          dirs.push(node.name)
        } else {
          expect(node.name.indexOf('.txt')).to.equal(node.name.length - 4)
        }
      })
      expect(dirs).to.deep.equal([ 'data', 'dir1', 'dir1txt', 'dir2', 'dir2txt' ])
    })
  })
})
