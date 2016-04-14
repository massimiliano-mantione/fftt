/* @flow */

import * as crypto from 'crypto'
const ALGORITHM = 'sha1'
const DIGEST_FORMAT = 'hex'

export type HashKind = ('F'|'D'|'T')

let kinds = {
  'f': 'F',
  'F': 'F',
  'd': 'D',
  'D': 'D',
  't': 'T',
  'T': 'T'
}

function checkKind (kind: string): boolean {
  return typeof (kinds[kind]) === 'string'
}

function toKind (kindVal: string): HashKind {
  if (checkKind(kindVal)) {
    return kinds[kindVal]
  } else {
    throw new Error('Invalid kind: ' + kindVal)
  }
}

function applyKind (kind: HashKind, value: string): string {
  return kind + '-' + value
}

function getKind (value: string): HashKind {
  return toKind(value.charAt(0))
}

function hashStream (stream: any, kindVal: string): Promise<string> {
  return new Promise((resolve, reject) => {
    let shasum = crypto.createHash(ALGORITHM)
    stream.on('data', (data) => {
      shasum.update(data)
    })
    stream.on('end', () => {
      resolve(applyKind(toKind(kindVal), shasum.digest(DIGEST_FORMAT)))
    })
    stream.on('error', (err) => {
      reject(err)
    })
  })
}

function hashString (data: string, kindVal: string): string {
  let shasum = crypto.createHash(ALGORITHM)
  shasum.update(data, 'utf8')
  return applyKind(toKind(kindVal), shasum.digest(DIGEST_FORMAT))
}

module.exports = {
  checkKind,
  applyKind,
  getKind,
  hashStream,
  hashString
}
