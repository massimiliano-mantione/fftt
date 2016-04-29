import {expect} from 'code'
import Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe, beforeEach} = require('./promisify-lab')(lab)

// import * as sstr from 'string-streamer'
let sstr = require('string-streamer')
import * as hash from '../lib/hash'

describe('Hash', () => {
  it('Hashes synchronously', () => {
    let result = hash.hashString('Foo!', 'f')
    expect(result).to.equal('F-52d5b977e091d02281056e295b80f2d97e5ed092')
  })
  it('Hashes asynchronously', () => {
    return hash.hashStream(sstr('Foo!'), 'L').then(h => {
      expect(h).to.equal('L-52d5b977e091d02281056e295b80f2d97e5ed092')
    })
  })

  describe('hashObject', () => {
    let h = hash._.hashObjectPartial
    let p = []
    beforeEach(() => {
      p = []
    })

    it('hashes simple objects', () => {
      let steps = ['p1', 'p2', 'p3']
      h(p, steps, {
        p1: 1,
        p2: 'foo',
        p3: true
      })
      expect(p).to.deep.equal([ '{', 'p1', '1', 'p2', 'foo', 'p3', 'T', '}' ])
    })

    it('hashes null values', () => {
      let steps = ['p1', 'p2', 'p3']
      h(p, steps, {
        p1: null,
        p2: undefined
      })
      expect(p).to.deep.equal([ '{', 'p1', 'NULL', 'p2', 'NONE', 'p3', 'NONE', '}' ])
    })

    it('hashes nested objects', () => {
      let steps = [
        'p',
        ['q'],
        ['ap', '[]'],
        ['m', [['{}', ['x', 'y']]]],
        ['o', '{}']
      ]
      h(p, steps, {
        p: 'p',
        q: 'q',
        ap: [1, 3, 2],
        m: {
          k3: {y: 3, x: 4},
          k1: {x: 3, y: 4},
          k2: {x: 4, y: 2}
        },
        o: {
          a: 'a',
          c: 'c',
          b: 'b'
        }
      })
      expect(p).to.deep.equal([
        '{',
        'p', 'p',
        'q', 'q',
        'ap', '{', '1', '3', '2', '}',
        'm', '{',
        'k1', '{', 'x', '3', 'y', '4', '}',
        'k2', '{', 'x', '4', 'y', '2', '}',
        'k3', '{', 'x', '4', 'y', '3', '}', '}',
        'o', '{', 'a', 'a', 'b', 'b', 'c', 'c', '}',
        '}' ])
    })
  })
})
