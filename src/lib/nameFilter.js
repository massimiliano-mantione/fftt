/* @flow */

import type {Glob, GlobArray} from './tasks'

// This function is like a predicate on a file or directory name.
// Given a name (and whether it is a directory), it returns null if it
// does not match the filter, and a FilterResult if it matches.
export type NameFilter = (name: string, isDir: boolean) => ?FilterResult

// The value returned from a NameFilter in case of match.
type FilterResult = {
  // The resulting name (different from the original one if the filter was of
  // the "from-to" kind).
  name: string;
  // The filter to apply to the next section of the path, if any.
  next: NameFilter;
  // True if the result is meaningful only if it has children (like '**')
  volatile: bool;
}

const CONTINUE_MARKER = '/...'

function endsWith (path: string, end: string): boolean {
  let foundIndex = path.indexOf(end)
  return (foundIndex >= 0 && foundIndex === path.length - end.length)
}

function hasContinueMarker (path: string): boolean {
  return endsWith(path, CONTINUE_MARKER)
}

function hasSeparators (path: string): boolean {
  return path.indexOf('/') >= 0
}

function isAbsolute (path: string): boolean {
  return path.indexOf('/') === 0
}

function stripFinalSeparator (path: string): string {
  if (path.endsWith('/')) {
    return path.substring(0, path.length - 1)
  } else {
    return path
  }
}

function stripInitialSeparator (path: string): string {
  if (isAbsolute(path)) {
    return path.substring(1, path.length)
  } else {
    return path
  }
}

function stripContinueMarker (path: string): string {
  if (hasContinueMarker(path)) {
    return path.substring(0, path.length - CONTINUE_MARKER.length)
  } else {
    return path
  }
}

function splitPath (path: string): string[] {
  let result = path.split('/')
  result = result.filter(p => {
    if (p === '..') {
      throw new Error('.. not allowed in paths: ' + path)
    }
    return p !== '' && p !== '.'
  })
  return result
}

var anyFilter: NameFilter = (name: string) => {
  return {name, next: anyFilter, volatile: false}
}

var NULL: NameFilter = () => { return null }

function starFilter (next: NameFilter = NULL) : NameFilter {
  if (next === NULL) {
    return anyFilter
  } else {
    return (name: string, isDir: boolean) => {
      return {name, next, volatile: true}
    }
  }
}

function doubleStarFilter (next: NameFilter = NULL) : NameFilter {
  function me (name: string, isDir: boolean) {
    if (isDir) {
      return {name, next: me, volatile: true}
    } else {
      if (next != null) {
        return next(name, false)
      } else {
        return null
      }
    }
  }
  return me
}

function unionFilter (alternatives: Array<NameFilter>) : NameFilter {
  return (name: string, isDir: boolean) => {
    for (let attempt of alternatives) {
      let result = attempt(name, isDir)
      if (result !== null) {
        return result
      }
    }
    return null
  }
}

function fromSingleGlobString (pattern: string, next: NameFilter = NULL) : NameFilter {
  if (pattern === '') {
    return starFilter(next)
  } else if (pattern === '*') {
    return starFilter(next)
  } else if (pattern === '**') {
    return doubleStarFilter(next)
  } else {
    // TODO: quote every regexp special character
    pattern = pattern.replace(/\$/g, '\\$')
    pattern = pattern.replace(/\^/g, '\\^')
    pattern = pattern.replace(/\./g, '\\.')
    // Turn glob into regexp
    pattern = pattern.replace(/\?/g, '.')
    pattern = pattern.replace(/\*/g, '.*')
    // Match the whole pattern
    pattern = '^' + pattern + '$'
    var regexp = new RegExp(pattern)
    return (name: string, isDir: boolean) => {
      if (regexp.test(name)) {
        return {name, next, volatile: false}
      } else {
        return null
      }
    }
  }
}

function fromGlobString (pattern: string, next: NameFilter = NULL): NameFilter {
  let components = pattern.split('/')
  while (components.length > 0) {
    let component = components.pop()
    if (component.length > 0) {
      next = fromSingleGlobString(component, next)
    }
  }
  return next
}

function isGlobSequence (globs: GlobArray): boolean {
  if (globs.length === 0) {
    return false
  }
  let first = globs[0]
  if (typeof first === 'string' && hasContinueMarker(first)) {
    return true
  }
  return false
}

function toGlobSequence (globs: GlobArray): GlobArray {
  let strip = true
  return globs.map(g => {
    if (strip && typeof g === 'string') {
      strip = false
      return stripContinueMarker(g)
    } else {
      return g
    }
  })
}

function fromGlobItem (item: GlobArray|string, next: NameFilter = NULL): NameFilter {
  if (typeof item === 'string') {
    return fromGlobString(item, next)
  } else if (Array.isArray(item)) {
    return fromGlobArray(item, next)
  } else {
    throw new Error('Invalid glob: ', item)
  }
}

function fromGlobArray (globs: GlobArray, next: NameFilter = NULL): NameFilter {
  if (isGlobSequence(globs)) {
    let sequence = toGlobSequence(globs)
    while (sequence.length > 0) {
      next = fromGlobItem(sequence.pop(), next)
    }
    return next
  } else {
    let alternatives = globs.map(g => {
      return fromGlobItem(g, next)
    })
    return unionFilter(alternatives)
  }
}

function fromGlob (glob: Glob): NameFilter {
  return fromGlobArray(glob.files)
}

var nameFilter = {
  // Private functions exposed for testing
  _: {
    endsWith,
    hasContinueMarker,
    hasSeparators,
    stripFinalSeparator,
    stripInitialSeparator,
    stripContinueMarker,
    splitPath,
    fromSingleGlobString,
    fromGlobString
  },
  fromGlobArray,
  fromGlob,
  isAbsolute,
  NULL
}

module.exports = nameFilter
