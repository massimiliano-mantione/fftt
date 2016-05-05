/* @flow */

import {expect} from 'code'
import Lab from 'lab'
const lab = exports.lab = Lab.script()
const {it, describe} = require('./promisify-lab')(lab)

import {internal, makeBuildGraph} from '../lib/tasks'

function fail () {
  expect(false).to.equal(true)
}

describe('tasks makeGlob', () => {
  let m = internal.makeGlob

  let checkGlob = function (g: any): boolean {
    if (typeof g.from !== 'string') {
      throw new Error('from is not a string in ' + g)
    }
    if (typeof g.to !== 'string') {
      throw new Error('to is not a string in ' + g)
    }
    if (!internal.isGlobArray(g.files)) {
      throw new Error('files is not a glob array in ' + g)
    }
    return true
  }

  it('handles empty values', () => {
    let g = (m(undefined, 'ID'))
    expect(checkGlob(g)).to.equal(true)
    expect(g).to.deep.equal({'from': '/', 'to': '/', 'files': ['**/*']})
  })

  it('handles strings', () => {
    let g = (m('foo', 'ID'))
    expect(checkGlob(g)).to.equal(true)
    expect(g).to.deep.equal({'from': '/', 'to': '/', 'files': ['foo']})
  })

  it('handles arrays', () => {
    let g = (m(['foo'], 'ID'))
    expect(checkGlob(g)).to.equal(true)
    expect(g).to.deep.equal({'from': '/', 'to': '/', 'files': ['foo']})
  })

  it('handles objects', () => {
    let g = (m({'from': '/', 'to': '/', 'files': ['foo']}, 'ID'))
    expect(checkGlob(g)).to.equal(true)
    expect(g).to.deep.equal({'from': '/', 'to': '/', 'files': ['foo']})
  })

  it('handles incomplete objects', () => {
    let g = (m({}, 'ID'))
    expect(checkGlob(g)).to.equal(true)
    expect(g).to.deep.equal({'from': '/', 'to': '/', 'files': ['**/*']})
  })

  it('detects bad object properties', () => {
    try {
      m({to: 4}, 'ID')
    } catch (e) {
      expect(e.message).to.contain('Invalid to specification')
      return
    }
    fail()
  })

  it('detects bad values', () => {
    try {
      m([4, 5, 6], 'ID')
    } catch (e) {
      expect(e.message).to.contain('Invalid glob')
      return
    }
    fail()
  })
})

describe('tasks makeTaskArgument', () => {
  let m = internal.makeTaskArgument

  it('handles strings', () => {
    let arg = m('foo', 'ID')
    expect(arg).to.deep.equal({id: 'foo', source: null, files: {from: '/', to: '/', files: [ '**/*' ]}})
  })

  it('handles simple source', () => {
    let arg = m({source: 'foo'}, 'ID')
    expect(arg).to.deep.equal({source: 'foo', id: null, files: {from: '/', to: '/', files: [ '**/*' ]}})
  })

  it('requires id or source', () => {
    try {
      m({files: 'foo'}, 'ID')
    } catch (e) {
      expect(e.message).to.include('no id or source')
      return
    }
    fail()
  })
})

describe('tasks makeBuildGraph', () => {
  it('builds a graph', () => {
    let data = [
      {'default': 'foo'},
      {env: 'bar'},
      {
        id: 'foo',
        in: 'bar',
        run: {img: 'image', cmd: 'ls'}
      },
      {
        id: 'bar',
        in: {source: '/source'},
        run: {img: 'image', cmd: 'ps'}
      }
    ]
    let graph = makeBuildGraph(data)
    expect(graph.defaultTask).to.equal('foo')
    expect(graph.tasks['foo'].id).to.equal('foo')
    expect(graph.tasks['bar'].id).to.equal('bar')
  })

  it('checks graph edges', () => {
    let data = [
      {'default': 'foo'},
      {env: 'bar'},
      {
        id: 'foo',
        in: 'baz',
        run: {img: 'image', cmd: 'ls'}
      },
      {
        id: 'bar',
        in: {source: '/source'},
        run: {img: 'image', cmd: 'ps'}
      }
    ]
    try {
      makeBuildGraph(data)
    } catch (e) {
      expect(e.message).to.contain('baz')
      expect(e.message).to.contain('not found in task')
      expect(e.message).to.contain('foo')
      return
    }
    fail()
  })
})
