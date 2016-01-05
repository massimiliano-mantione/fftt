/* @flow */

import {expect} from 'code'

import * as Lab from 'lab'
const lab = exports.lab = Lab.script()
const describe = lab.describe
// const beforeEach = lab.beforeEach
const it = require('./promisify-it')(lab)

import * as nameFilter from '../lib/nameFilter'

describe('nameFilter', () => {
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

  describe('fromGlob', () => {
    var fg = nameFilter.fromGlob

    describe('star last', () => {
      it('works', () => {
        var glob = fg('*', null)
        var foo = glob('foo', false)
        expect(foo).to.deep.equal({name: 'foo', next: glob})
        expect(glob('foo', true)).to.not.equal(null)
        expect(glob('', true)).to.not.equal(null)
      })
    })

    describe('star with next', () => {
      it('works', () => {
        var next = fg('foo', null)
        var glob = fg('*', next)
        expect(glob('foo', false)).to.deep.equal({name: 'foo', next})
        expect(glob('foo', true)).to.deep.equal({name: 'foo', next})
      })
    })

    describe('empty', () => {
      it('works', () => {
        var glob = fg('', null)
        expect(glob('foo', false)).to.not.equal(null)
        expect(glob('foo', true)).to.not.equal(null)
        expect(glob('', true)).to.not.equal(null)
      })
    })

    describe('simple name', () => {
      it('works', () => {
        var f = 'foobar'
        var glob = fg(f, null)
        expect(glob(f, false)).to.deep.equal({name: f, next: null})
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
        var glob = fg(f, null)
        expect(glob(f, false)).to.deep.equal({name: f, next: null})
        expect(glob('foo', true)).to.equal(null)
        expect(glob('ob', false)).to.equal(null)
        expect(glob('', false)).to.equal(null)
        expect(glob('my' + f, false)).to.equal(null)
        expect(glob(f + 'nice', false)).to.equal(null)
      })
    })

    describe('jolly char', () => {
      it('works', () => {
        var glob = fg('foo?ar', null)
        expect(glob('foobar', false)).to.deep.equal({name: 'foobar', next: null})
        expect(glob('foocar', false)).to.deep.equal({name: 'foocar', next: null})
        expect(glob('foo.ar', false)).to.deep.equal({name: 'foo.ar', next: null})
        expect(glob('foo', true)).to.equal(null)
        expect(glob('ob', false)).to.equal(null)
      })
    })

    describe('jolly chars', () => {
      it('works', () => {
        var glob = fg('n?sc?r', null)
        expect(glob('nascar', false)).to.deep.equal({name: 'nascar', next: null})
        expect(glob('nosc.r', false)).to.deep.equal({name: 'nosc.r', next: null})
        expect(glob('nasca', false)).to.equal(null)
      })
    })

    describe('star char', () => {
      it('works', () => {
        var glob = fg('*.js', null)
        expect(glob('foo.js', false)).to.deep.equal({name: 'foo.js', next: null})
        expect(glob('bar.js', false)).to.deep.equal({name: 'bar.js', next: null})
        expect(glob('$.js', false)).to.deep.equal({name: '$.js', next: null})
        expect(glob('foo.cs', false)).to.equal(null)
      })
    })

    describe('double star', () => {
      it('works', () => {
        var next = fg('foo', null)
        var glob = fg('**', next)
        expect(glob('foo', false)).to.deep.equal({name: 'foo', next: null})
        expect(glob('foo', true)).to.deep.equal({name: 'foo', next: glob})
        expect(glob('bar', false)).to.equal(null)
        expect(glob('bar', true)).to.deep.equal({name: 'bar', next: glob})
      }, {only: true})
    })
  })
})
