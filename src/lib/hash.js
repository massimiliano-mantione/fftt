/* @flow */

import crypto from 'crypto'
const ALGORITHM = 'sha1'
const DIGEST_FORMAT = 'hex'

export type HashKind = ('F'|'D'|'T')

let kinds = {
  'f': 'F',
  'F': 'F',
  'x': 'x',
  'X': 'X',
  'd': 'D',
  'D': 'D',
  'l': 'L',
  'L': 'L',
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

const OPEN = '{'
const CLOSE = '}'
const SEPARATOR = '/'

function hashPrimitivePartial (parts: Array<string>, data: any): void {
  if (typeof data === 'string') {
    parts.push(data)
  } else if (typeof data === 'number') {
    parts.push('' + data)
  } else if (typeof data === 'boolean') {
    parts.push(data ? 'T' : 'F')
  } else if (data === null) {
    parts.push('NULL')
  } else if (data === undefined) {
    parts.push('NONE')
  } else {
    throw new Error('Data is not primitive: ' + data)
  }
}

function hashObjectPartial (parts: Array<string>, steps: any, data: any): void {
  parts.push(OPEN)
  if (typeof steps === 'string') {
    steps = [steps]
  } else if (steps.length === 0) {
    steps = ['[]']
  }
  for (let step of steps) {
    if (typeof step === 'string') {
      step = [step]
    } else if (step.length === 0) {
      step = ['[]']
    }
    let stepCode = step[0]
    let subStep = step[1]
    if (stepCode === '[]') {
      if (subStep) {
        data.forEach(element => {
          hashObjectPartial(parts, subStep, element)
        })
      } else {
        data.forEach(element => {
          hashPrimitivePartial(parts, element)
        })
      }
    } else if (stepCode === '{}') {
      let keys = Object.keys(data)
      keys.sort()
      if (subStep) {
        keys.forEach(key => {
          parts.push(key)
          hashObjectPartial(parts, subStep, data[key])
        })
      } else {
        keys.forEach(key => {
          parts.push(key)
          hashPrimitivePartial(parts, data[key])
        })
      }
    } else if (typeof stepCode === 'string') {
      parts.push(stepCode)
      if (subStep) {
        hashObjectPartial(parts, subStep, data[stepCode])
      } else {
        hashPrimitivePartial(parts, data[stepCode])
      }
    } else {
      throw new Error('Invalid stepcode: ' + stepCode)
    }
  }
  parts.push(CLOSE)
}

function hashObject (steps: any, data: any, kindVal: string): string {
  let parts = []
  hashObjectPartial(parts, steps, data)
  let stringData = parts.join(SEPARATOR)
  return hashString(stringData, kindVal)
}

function isDirectory (h: string): boolean {
  let start = h.charAt(0)
  return start === 'D' || start === 'L'
}

module.exports = {
  _: {
    hashObjectPartial
  },
  checkKind,
  applyKind,
  getKind,
  hashStream,
  hashString,
  hashObject,
  isDirectory
}
