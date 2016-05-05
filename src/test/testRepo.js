/* @flow */

import {expect} from 'code'
import Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe, beforeEach} = require('./promisify-lab')(lab)

import fsData from './fs-data'
import fileFilter from '../lib/fileFilter'
import repository from '../lib/repo'

describe('repo', () => {
  let fs = fsData.fs()
  let ff = fileFilter.fromFs(fs)

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

  it('stores trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let pathToStore = '/data/dir1/dir1txt'
      return ff.scanDir(pathToStore, ff.nameFilter._.fromGlobString('**/*')).then(children => {
        return r.storeDir(pathToStore, false, children, false)
      }).then(dirHash => {
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
      })
    })
  })

  it('stores deep trees', () => {
    return repository(ff, '/my/repo').then(r => {
      let pathToStore = '/data/dir1'
      let dirHash = ''
      return ff.scanDir(pathToStore, ff.nameFilter._.fromGlobString('**/*')).then(children => {
        return r.storeDir(pathToStore, false, children, false)
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

  it('makes workdirs', () => {
    return repository(ff, '/my/repo').then(r => {
      return r.makeWorkDir()
    }).then(wd => {
      expect(wd.base.indexOf('/my/repo/tmp')).to.equal(0)
      expect(wd.in.indexOf(wd.base)).to.equal(0)
    })
  })
})
