/* @flow */

import {expect} from 'code'
import Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe} = require('./promisify-lab')(lab)

import nameFilter from '../lib/nameFilter'

describe('nameFilter', () => {
  let empty = nameFilter.NULL

  describe('endsWith', () => {
    it('works', () => {
      expect(nameFilter._.endsWith('foobar', 'bar')).to.equal(true)
      expect(nameFilter._.endsWith('foobar', 'foobar')).to.equal(true)
      expect(nameFilter._.endsWith('foobar', 'foo')).to.equal(false)
    })
  })

  describe('hasContinueMarker', () => {
    it('works', () => {
      expect(nameFilter._.hasContinueMarker('foobar')).to.equal(false)
      expect(nameFilter._.hasContinueMarker('foo/bar/...')).to.equal(true)
    })
  })

  describe('hasSeparators', () => {
    it('works', () => {
      expect(nameFilter._.hasSeparators('foobar')).to.equal(false)
      expect(nameFilter._.hasSeparators('foo/bar')).to.equal(true)
      expect(nameFilter._.hasSeparators('/foobar')).to.equal(true)
    })
  })

  describe('isAbsolute', () => {
    it('works', () => {
      expect(nameFilter.isAbsolute('foobar')).to.equal(false)
      expect(nameFilter.isAbsolute('foo/bar')).to.equal(false)
      expect(nameFilter.isAbsolute('/foobar')).to.equal(true)
    })
  })

  describe('stripFinalSeparator', () => {
    it('works', () => {
      expect(nameFilter._.stripFinalSeparator('foobar')).to.equal('foobar')
      expect(nameFilter._.stripFinalSeparator('foo/bar')).to.equal('foo/bar')
      expect(nameFilter._.stripFinalSeparator('foobar/')).to.equal('foobar')
      expect(nameFilter._.stripFinalSeparator('/foobar/')).to.equal('/foobar')
    })
  })

  describe('stripInitialSeparator', () => {
    it('works', () => {
      expect(nameFilter._.stripInitialSeparator('foobar')).to.equal('foobar')
      expect(nameFilter._.stripInitialSeparator('foo/bar')).to.equal('foo/bar')
      expect(nameFilter._.stripInitialSeparator('/foobar')).to.equal('foobar')
      expect(nameFilter._.stripInitialSeparator('/foobar/')).to.equal('foobar/')
    })
  })

  describe('splitPath', () => {
    it('works', () => {
      expect(nameFilter._.splitPath('foobar')).to.deep.equal(['foobar'])
      expect(nameFilter._.splitPath('foo/bar')).to.deep.equal(['foo', 'bar'])
      expect(nameFilter._.splitPath('foo/bar/baz')).to.deep.equal(['foo', 'bar', 'baz'])
      expect(nameFilter._.splitPath('/foobar')).to.deep.equal(['', 'foobar'])
      expect(nameFilter._.splitPath('foobar/')).to.deep.equal(['foobar', ''])
    })
  })

  describe('fromSingleGlobString', () => {
    var fg = nameFilter._.fromSingleGlobString

    describe('star last', () => {
      it('works', () => {
        var glob = fg('*')
        var foo = glob('foo', false)
        expect(foo).to.deep.equal({name: 'foo', next: glob, volatile: false})
        expect(glob('foo', true)).to.not.equal(null)
        expect(glob('', true)).to.not.equal(null)
      })
    })

    describe('star with next', () => {
      it('works', () => {
        var next = fg('foo')
        var glob = fg('*', next)
        expect(glob('foo', false)).to.deep.equal({name: 'foo', next, volatile: true})
        expect(glob('foo', true)).to.deep.equal({name: 'foo', next, volatile: true})
      })
    })

    describe('empty', () => {
      it('works', () => {
        var glob = fg('')
        expect(glob('foo', false)).to.not.equal(null)
        expect(glob('foo', true)).to.not.equal(null)
        expect(glob('', true)).to.not.equal(null)
      })
    })

    describe('simple name', () => {
      it('works', () => {
        var f = 'foobar'
        var glob = fg(f)
        expect(glob(f, false)).to.deep.equal({name: f, next: empty, volatile: false})
        expect(glob('foo', true)).to.equal(null)
        expect(glob('ob', false)).to.equal(null)
        expect(glob('', false)).to.equal(null)
        expect(glob('my' + f, false)).to.equal(null)
        expect(glob(f + 'nice', false)).to.equal(null)
      })
    })

    describe('special chars', () => {
      it('works', () => {
        var f = 'f$oo.b^ar'
        var glob = fg(f)
        expect(glob(f, false)).to.deep.equal({name: f, next: empty, volatile: false})
        expect(glob('foo', true)).to.equal(null)
        expect(glob('ob', false)).to.equal(null)
        expect(glob('', false)).to.equal(null)
        expect(glob('my' + f, false)).to.equal(null)
        expect(glob(f + 'nice', false)).to.equal(null)
      })
    })

    describe('jolly char', () => {
      it('works', () => {
        var glob = fg('foo?ar')
        expect(glob('foobar', false)).to.deep.equal({name: 'foobar', next: empty, volatile: false})
        expect(glob('foocar', false)).to.deep.equal({name: 'foocar', next: empty, volatile: false})
        expect(glob('foo.ar', false)).to.deep.equal({name: 'foo.ar', next: empty, volatile: false})
        expect(glob('foo', true)).to.equal(null)
        expect(glob('ob', false)).to.equal(null)
      })
    })

    describe('jolly chars', () => {
      it('works', () => {
        var glob = fg('n?sc?r')
        expect(glob('nascar', false)).to.deep.equal({name: 'nascar', next: empty, volatile: false})
        expect(glob('nosc.r', false)).to.deep.equal({name: 'nosc.r', next: empty, volatile: false})
        expect(glob('nasca', false)).to.equal(null)
      })
    })

    describe('star char', () => {
      it('works', () => {
        var glob = fg('*.js')
        expect(glob('foo.js', false)).to.deep.equal({name: 'foo.js', next: empty, volatile: false})
        expect(glob('bar.js', false)).to.deep.equal({name: 'bar.js', next: empty, volatile: false})
        expect(glob('$.js', false)).to.deep.equal({name: '$.js', next: empty, volatile: false})
        expect(glob('foo.cs', false)).to.equal(null)
      })
    })

    describe('double star', () => {
      it('works', () => {
        var next = fg('foo')
        var glob = fg('**', next)
        expect(glob('foo', false)).to.deep.equal({name: 'foo', next: empty, volatile: false})
        expect(glob('foo', true)).to.deep.equal({name: 'foo', next: glob, volatile: true})
        expect(glob('bar', false)).to.equal(null)
        expect(glob('bar', true)).to.deep.equal({name: 'bar', next: glob, volatile: true})
      })
    })
  })

  describe('fromGlobString', () => {
    var fg = nameFilter._.fromGlobString

    it('handles a simple pattern', () => {
      var f = 'foobar'
      var glob = fg(f)
      expect(glob(f, false)).to.deep.equal({name: f, next: empty, volatile: false})
    })

    it('handles a double pattern', () => {
      var glob = fg('foo/bar')
      let foo = glob('foo', false)
      if (foo) {
        expect(foo.name).to.equal('foo')
        if (foo.next) {
          expect(foo.next('bar', false)).to.deep.equal({name: 'bar', next: empty, volatile: false})
        } else {
          throw new Error('foo.next is null')
        }
      } else {
        throw new Error('foo is null')
      }
    })
  })

  describe('fromGlobArray', () => {
    var fga = nameFilter.fromGlobArray

    it('handles a simple pattern', () => {
      var name = 'foobar'
      var files = [name]
      var glob = fga(files)
      expect(glob(name, false)).to.deep.equal({name: name, next: empty, volatile: false})
    })

    it('handles a sequence', () => {
      var glob = fga(['foo/...', 'bar'])
      let foo = glob('foo', false)
      if (foo) {
        expect(foo.name).to.equal('foo')
        if (foo.next) {
          expect(foo.next('bar', false)).to.deep.equal({name: 'bar', next: empty, volatile: false})
        } else {
          throw new Error('foo.next is null')
        }
      } else {
        throw new Error('foo is null')
      }
    })

    it('handles an alternative', () => {
      let n1 = 'foo'
      let n2 = 'bar'
      var glob = fga([n1, n2])
      expect(glob(n1, false)).to.deep.equal({name: n1, next: empty, volatile: false})
      expect(glob(n2, false)).to.deep.equal({name: n2, next: empty, volatile: false})
      expect(glob('baz', false)).to.equal(null)
    })
  })
})
