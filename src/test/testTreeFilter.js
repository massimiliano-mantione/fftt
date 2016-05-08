/* @flow */

import {expect} from 'code'
import Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe} = require('./promisify-lab')(lab)

import fsData from './fs-data'
import fileFilter from '../lib/fileFilter'

function checkNodes (nodes, check) {
  Object.keys(nodes).forEach(name => {
    let node = nodes[name]
    check(name, node)
    if (node.isDir) {
      checkNodes(node.children, check)
    }
  })
  return Promise.resolve()
}

function checkNodesForSuffix (nodes, suffix, dirs) {
  let foundDirs = []
  return checkNodes(nodes, (name, node) => {
    if (!node) {
      expect(node).to.not.equal(null)
    } else if (node.isDir) {
      foundDirs.push(name)
    } else {
      expect(name.indexOf(suffix)).to.equal(name.length - suffix.length)
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
  let scanDir = ff.scanDir

  it('filters trees', () => {
    let tree = ff.statNode('/data')
    let glob = ff.nameFilter._.fromGlobString('**/*.txt')
    return tree.then(t => {
      let filtered = treeFilter(t, glob)
      if (filtered) {
        return checkNodesForSuffix(filtered.children, '.txt', [ 'dir1', 'dir1txt', 'dir2', 'dir2txt' ])
      } else {
        expect(filtered).to.not.equal(null)
      }
    })
  })

  describe('scanDir', () => {
    it('finds txt files', () => {
      let glob = ff.nameFilter._.fromGlobString('**/*.txt')
      return scanDir('/', glob).then(filtered => {
        return checkNodesForSuffix(filtered.children, '.txt', [ 'data', 'dir1', 'dir1txt', 'dir2', 'dir2txt' ])
      })
    })

    it('finds txt files in a path', () => {
      let glob = ff.nameFilter._.fromGlobString('**/*.txt')
      return scanDir('/data', glob).then(filtered => {
        return checkNodesForSuffix(filtered.children, '.txt', [ 'dir1', 'dir1txt', 'dir2', 'dir2txt' ])
      })
    })

    it('skips unknown files', () => {
      let glob = ff.nameFilter._.fromGlobString('**/*.tvv')
      return scanDir('/', glob).then(filtered => {
        expect(filtered.children).to.deep.equal({})
      })
    })

    it('skips unknown dirs', () => {
      let glob = ff.nameFilter._.fromGlobString('/woo')
      return scanDir('/', glob).then(filtered => {
        expect(filtered.children).to.deep.equal({})
      })
    })

    it('finds patterns', () => {
      let glob = ff.nameFilter._.fromGlobString('**/*.js??')
      return scanDir('/', glob).then(filtered => {
        return checkNodesForSuffix(filtered.children, '.json', [ 'data', 'dir1', 'dir1json', 'dir2', 'dir2json' ])
      })
    })

    it('looks into dirs', () => {
      let glob = ff.nameFilter._.fromGlobString('**/*.txt')
      return scanDir('/data/dir1', glob).then(filtered => {
        return checkNodesForSuffix(filtered.children, '.txt', [ 'dir1txt' ])
      })
    })
  })
})
