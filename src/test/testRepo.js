/* @flow */

import {expect} from 'code'
import Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe, beforeEach} = require('./promisify-lab')(lab)

import fsData from './fs-data'
import fileFilter from '../lib/fileFilter'
import repository from '../lib/repo'
import hash from '../lib/hash'

describe('repo', () => {
  let fs = fsData.fs()
  let ff = fileFilter.fromFs(fs)

  function simplifyTree (tree) {
    let result = {}
    if (tree.isDir) {
      for (let name of ff.childNames(tree)) {
        result[name] = simplifyTree(tree.children[name])
      }
    }
    return result
  }

  beforeEach(() => {
    fs = fsData.fs()
    ff = fileFilter.fromFs(fs)
  })

  it('initializes repo', () => {
    return repository(ff, '/my/repo').then(() => {
      return ff.writeText('hola', '/my/repo/obj/hola.txt')
    }).then(() => {
      return ff.readText('/my/repo/obj/hola.txt')
    }).then(text => {
      expect(text).to.equal('hola')
    })
  })

  it('works with trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let dirHash = hash.EMPTY
      let pathToStore = '/data/dir1/dir1txt'
      return ff.scanDir(pathToStore, ff.nameFilter._.fromGlobString('**/*')).then(tree => {
        return r.storeDir(pathToStore, false, tree.children, false)
      }).then(h => {
        dirHash = h
        return ff.readText(ff.join('/my/repo/obj', dirHash))
      }).then(text => {
        let dirData = JSON.parse(text)
        expect(Object.keys(dirData).length).to.equal(2)
        return Promise.all([
          ff.readText(ff.join('/my/repo/obj', dirData['t111.txt'])),
          ff.readText(ff.join('/my/repo/obj', dirData['t112.txt']))
        ])
      }).then(files => {
        expect(files).to.deep.equal(['t11', 't12'])
      }).then(() => {
        return r.extractTree(dirHash)
      }).then(tree => {
        expect(tree.isDir).to.equal(true)
        expect(tree.hash).to.equal(dirHash)
        expect(tree.children['t111.txt'].isDir).to.equal(false)
        expect(tree.children['t111.txt'].children).to.deep.equal({})
        expect(tree.children['t112.txt'].isDir).to.equal(false)
        expect(tree.children['t112.txt'].children).to.deep.equal({})
        return tree
      }).then(tree => {
        let longer = r.prependPath('/foo/bar/baz', tree)
        expect(longer.children['foo'].children['bar'].children['baz'].children['t111.txt'].isDir).to.equal(false)
        expect(longer.children['foo'].children['bar'].children['baz'].isDir).to.equal(true)
        expect(longer.children['foo'].children['bar'].children['baz']).to.equal(tree)
        expect(longer.children['foo'].children['bar'].hash).to.equal(hash.EMPTY)
        expect(longer.children['foo'].hash).to.equal(hash.EMPTY)
        expect(longer.hash).to.equal(hash.EMPTY)
        let shorter = r.walkPath('foo/bar/baz/', longer)
        expect(shorter).to.equal(tree)
        expect(r.walkPath('foo/no/where', longer)).to.equal(null)
      })
    })
  })

  it('checks out trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let pathToStore = '/data/dir1/dir1txt'
      return ff.scanDir(pathToStore, ff.nameFilter._.fromGlobString('**/*')).then(tree => {
        return r.storeDir(pathToStore, false, tree.children, false)
      }).then(dirHash => {
        return r.checkOutTree(dirHash)
      }).then(dirPath => {
        return Promise.all([
          ff.readText(ff.join(dirPath, 't111.txt')),
          ff.readText(ff.join(dirPath, 't112.txt'))
        ])
      }).then(files => {
        expect(files).to.deep.equal(['t11', 't12'])
      })
    })
  })

  it('stores deep trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let pathToStore = '/data/dir1'
      let dirHash = ''
      return ff.scanDir(pathToStore, ff.nameFilter._.fromGlobString('**/*')).then(tree => {
        return r.storeDir(pathToStore, false, tree.children, false)
      }).then(dh => {
        dirHash = dh
        return ff.readText(ff.join('/my/repo/obj', dirHash))
      }).then(text => {
        let dirData = JSON.parse(text)
        expect(Object.keys(dirData).length).to.equal(7)
        return Promise.all([
          ff.readText(ff.join('/my/repo/obj', dirData['t11.txt'])),
          ff.readText(ff.join('/my/repo/obj', dirData['t12.txt']))
        ])
      }).then(files => {
        expect(files).to.deep.equal(['t11', 't12'])
        let dirRoot = ff.join('/my/repo/dir', dirHash)
        return Promise.all([
          ff.readText(ff.join(dirRoot, 't11.txt')),
          ff.readText(ff.join(dirRoot, 't12.txt')),
          ff.readText(ff.join(dirRoot, 'dir1json/jn11i.json')),
          ff.readText(ff.join(dirRoot, 'dir1js/j11i.js'))
        ])
      }).then(files => {
        expect(files).to.deep.equal([ 't11', 't12', '{j:true}', 'console.log(\'Hi!\')' ])
      })
    })
  })

  it('merges two trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let txt = ff.nameFilter.fromGlobArray(['**/*.txt'])
      let dir1tree = ff.makeEmptyDirNode()
      let dir2tree = ff.makeEmptyDirNode()
      let merged = ff.makeEmptyDirNode()
      return ff.scanDir('/data/dir1', txt).then(tree => {
        dir1tree = tree
        return r.storeTree('/data/dir1', dir2tree, false)
      }).then(() => {
        return ff.scanDir('/data/dir2', txt)
      }).then(tree => {
        dir2tree = tree
        return r.storeTree('/data/dir2', dir2tree, false)
      }).then(() => {
        return r.storeTree(null, merged, false)
      }).then(() => {
        merged = r.mergeTrees2(dir1tree, dir2tree, 'merged')
        expect(simplifyTree(merged)).to.deep.equal({
          't11.txt': {},
          't12.txt': {},
          dir1txt: { 't111.txt': {}, 't112.txt': {} },
          't21.txt': {},
          't22.txt': {},
          dir2txt: { 't221.txt': {}, 't222.txt': {} }
        })
      })
    })
  })

  it('merges trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let txt = ff.nameFilter.fromGlobArray(['**/*.txt'])
      let js = ff.nameFilter.fromGlobArray(['**/*.js'])
      return Promise.all([
        ff.scanDir('/data/dir1', txt),
        ff.scanDir('/data/dir1', js),
        ff.scanDir('/data/dir2', txt)
      ]).then(trees => {
        let merged = r.mergeTrees(trees)
        expect(simplifyTree(merged)).to.deep.equal({
          't11.txt': {},
          't12.txt': {},
          dir1txt: { 't111.txt': {}, 't112.txt': {} },
          'j11.js': {},
          dir1js: { 'j11i.js': {} },
          't21.txt': {},
          't22.txt': {},
          dir2txt: { 't221.txt': {}, 't222.txt': {} }
        })
      })
    })
  })

  it('makes workdirs', () => {
    return repository(ff, '/my/repo').then(r => {
      return r.makeWorkDir('foo-hash')
    }).then(wd => {
      expect(wd.base.indexOf('/my/repo/tmp')).to.equal(0)
      expect(wd.in.indexOf(wd.base)).to.equal(0)
    })
  })
})
