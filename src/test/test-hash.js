import {expect} from 'code'
import * as Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe} = require('./promisify-lab')(lab)

// import * as sstr from 'string-streamer'
let sstr = require('string-streamer')
import * as hash from '../lib/hash'

describe('Hash', () => {
  it('Hashes synchronously', () => {
    let result = hash.hashString('Foo!', 'f')
    expect(result).to.equal('F-52d5b977e091d02281056e295b80f2d97e5ed092')
  })
  it('Hashes asynchronously', () => {
    return hash.hashStream(sstr('Foo!'), 'T').then(h => {
      expect(h).to.equal('T-52d5b977e091d02281056e295b80f2d97e5ed092')
    })
  })
})
