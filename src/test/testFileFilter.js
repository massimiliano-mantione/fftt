/* @flow */

import {expect} from 'code'
import * as Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe, beforeEach} = require('./promisify-lab')(lab)

import * as mock from 'mock-fs'
import * as fileFilter from '../lib/fileFilter'

let files = {
  '/root': {
    'foo.txt': 'foo',
    'bar.txt': 'bar',
    'q': {
      'a': '42'
    }
  },
  '/home': {
    'baz.txt': mock.file({
      content: 'baz',
      ctime: new Date(1),
      mtime: new Date(2)
    })
  }
}

describe('FileFilter', () => {
  let [fs, ff] = [require('fs'), fileFilter]

  beforeEach(() => {
    fs = mock.fs(files)
    ff = fileFilter.fromFs(fs)
  })

  it('Can read files', () => {
    return ff.readText('/root/foo.txt').then((text) => {
      expect(text).to.equal('foo')
    })
  })

  it('Can write files', () => {
    return ff.writeText('text', '/dest.txt').then(() => {
      return ff.readText('/dest.txt')
    }).then((text) => {
      expect(text).to.equal('text')
    })
  })

  it('Can copy files', () => {
    return ff.copy('/root/bar.txt', '/dest.txt').then(() => {
      return ff.readText('/dest.txt')
    }).then((text) => {
      expect(text).to.equal('bar')
    })
  })

  it('Can stat files', () => {
    return ff.stat('/home/baz.txt').then((stats) => {
      expect(stats.size).to.equal(3)
      expect(stats.ctime.getTime()).to.equal(1)
      expect(stats.mtime.getTime()).to.equal(2)
    })
  })

  it('Can stat dirs', () => {
    // return ff.statDir('/root').then((dirStats) => {
    //   console.log('STATS', dirStats)
    // })
  })
})
