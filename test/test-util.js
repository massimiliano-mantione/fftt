/* @flow */

let expect = require('chai').expect
let mock = require('mock-fs')
let util = require('../src/util')

let files = {
  '/root': {
    'foo.txt': 'foo',
    'bar.txt': 'bar'
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
  let [fs, u] = [null, null]

  beforeEach(() => {
    fs = mock.fs(files)
    u = util.fromFs(fs)
  })

  it('Can read files', () => {
    return u.readText('/root/foo.txt').then((text) => {
      expect(text).to.equal('foo')
      return Promise.resolve()
    })
  })

  it('Can write files', () => {
    return u.writeText('text', '/dest.txt').then(() => {
      return u.readText('/dest.txt')
    }).then((text) => {
      expect(text).to.equal('text')
      return Promise.resolve()
    })
  })

  it('Can copy files', () => {
    return u.copy('/root/bar.txt', '/dest.txt').then(() => {
      return u.readText('/dest.txt')
    }).then((text) => {
      expect(text).to.equal('bar')
      return Promise.resolve()
    })
  })

  it('Can stat files', () => {
    return u.stat('/home/baz.txt').then((stats) => {
      expect(stats.size).to.equal(3)
      expect(stats.ctime.getTime()).to.equal(1)
      expect(stats.mtime.getTime()).to.equal(2)
      return Promise.resolve()
    })
  })
})
