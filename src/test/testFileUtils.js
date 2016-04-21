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
  '/home': {}
}

describe('FileUtils', () => {
  let [fs, ff] = [require('fs'), fileFilter]

  beforeEach(() => {
    fs = mock.fs(files)
    ff = fileFilter.fromFs(fs)
  })

  it('Can create dirs', () => {
    return ff.mkdirp('/my/new/path').then(() => {
      return ff.writeText('text', '/my/new/path/file.txt')
    }).then(() => {
      return ff.readText('/my/new/path/file.txt')
    }).then((text) => {
      expect(text).to.equal('text')
    })
  })

  it('Can create symlinks', () => {
    return ff.slink('/root/foo.txt', '/home/foo.txt').then(() => {
      return ff.readText('/home/foo.txt')
    }).then((text) => {
      expect(text).to.equal('foo')
    })
  })

  it('Can create hard links', () => {
    return ff.hlink('/root/foo.txt', '/home/foo.txt').then(() => {
      return ff.readText('/home/foo.txt')
    }).then((text) => {
      expect(text).to.equal('foo')
    })
  })
})
