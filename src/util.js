/* @flow */

let Promise = require('any-promise')

let util = (fs) => {
  if (!fs) {
    fs = require('fs')
  }
  let u = {}

  function copy (source, target) {
    return new Promise((resolve, reject) => {
      let sourceStream = fs.createReadStream(source)
      let targetStream = fs.createWriteStream(target)
      sourceStream.pipe(targetStream)
      sourceStream.on('error', err => { reject(err) })
      targetStream.on('error', err => { reject(err) })
      targetStream.on('finish', () => { resolve() })
    })
  }

  function readText (sourcePath) {
    return new Promise((resolve, reject) => {
      let stream = fs.createReadStream(sourcePath)
      let result = ''
      stream.setEncoding('utf8')
      stream.on('error', err => { reject(err) })
      stream.on('data', data => { result += data })
      stream.on('end', () => { resolve(result) })
    })
  }

  function writeText (text, targetPath) {
    return new Promise((resolve, reject) => {
      let stream = fs.createWriteStream(targetPath)
      stream.on('error', err => { reject(err) })
      stream.on('finish', () => { resolve() })
      stream.end(text)
    })
  }

  function stat (path) {
    return new Promise((resolve, reject) => {
      fs.stat(path, (err, stats) => {
        if (err) reject(err)
        else resolve(stats)
      })
    })
  }

  u.copy = copy
  u.readText = readText
  u.writeText = writeText
  u.stat = stat

  return u
}

module.exports = util()
module.exports.fromFs = util
