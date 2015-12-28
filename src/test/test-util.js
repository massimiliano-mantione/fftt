/* @flow */

import {expect} from 'code'

import * as Lab from 'lab'
const lab = exports.lab = Lab.script()
const describe = lab.describe
const beforeEach = lab.beforeEach
const it = require('./promisify-it')(lab)

import * as mock from 'mock-fs'
import * as util from '../lib/util'

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

describe('Utils', () => {
  let [fs, u] = [require('fs'), util]

  beforeEach((done) => {
    fs = mock.fs(files)
    u = util.fromFs(fs)
    done()
  })

  it('Can read files', () => {
    return u.readText('/root/foo.txt').then((text) => {
      expect(text).to.equal('foo')
    })
  })

  it('Can write files', () => {
    return u.writeText('text', '/dest.txt').then(() => {
      return u.readText('/dest.txt')
    }).then((text) => {
      expect(text).to.equal('text')
    })
  })

  it('Can copy files', () => {
    return u.copy('/root/bar.txt', '/dest.txt').then(() => {
      return u.readText('/dest.txt')
    }).then((text) => {
      expect(text).to.equal('bar')
    })
  })

  it('Can stat files', () => {
    return u.stat('/home/baz.txt').then((stats) => {
      expect(stats.size).to.equal(3)
      expect(stats.ctime.getTime()).to.equal(1)
      expect(stats.mtime.getTime()).to.equal(2)
    })
  })

  it('Can stat dirs', () => {
    // return u.statDir('/root').then((dirStats) => {
    //   console.log('STATS', dirStats)
    // })
  })
})
