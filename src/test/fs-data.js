import * as mockFs from 'mock-fs'

let data = {
  '/data': {
    't1.txt': 't1',
    't2.txt': 't2',
    'jn1.json': '{j:true}',
    'j1.js': 'console.log(\'Hi!\')',
    'dir1': {
      't11.txt': 't11',
      't12.txt': 't12',
      'jn11.json': '{j:true}',
      'j11.js': 'console.log(\'Hi!\')',
      'dir1txt': {
        't111.txt': 't11',
        't112.txt': 't12'
      },
      'dir1json': {
        'jn11i.json': '{j:true}'
      },
      'dir1js': {
        'j11i.js': 'console.log(\'Hi!\')'
      }
    },
    'dir2': {
      't21.txt': 't21',
      't22.txt': 't22',
      'jn21.json': '{j:true}',
      'j21.js': 'console.log(\'Hi!\')',
      'dir2txt': {
        't221.txt': 't21',
        't222.txt': 't22'
      },
      'dir2json': {
        'jn21i.json': '{j:true}'
      },
      'dir2js': {
        'j12i.js': 'console.log(\'Hi!\')'
      }
    }
  }
}

module.exports = {
  data,
  fs: function () {
    return mockFs.fs(data, {
      createCwd: false,
      createTmp: false
    })
  }
}
