/* @flow */

// This function is like a predicate on a file or directory name.
// Given a name (and whether it is a directory), it returns null if it
// does not match the filter, and a FilterResult if it matches.
type NameFilter = (name: string, isDir: boolean) => ?FilterResult

// The value returned from a NameFilter in case of match.
type FilterResult = {
  // The resulting name (different from the original one if the filter was of
  // the "from-to" kind).
  name: string;
  // The filter to apply to the next section of the path, if any.
  next: ?NameFilter;
}

const CONTINUE_MARKER = '/...'

function endsWith (path: string, end: string): boolean {
  return (path.indexOf(end) === path.length - end.length)
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
  return path.split('/')
}

var anyFilter: NameFilter = (name: string) => {
  return {name, next: anyFilter}
}

function starFilter (next: ?NameFilter) : NameFilter {
  if (next == null) {
    return anyFilter
  } else {
    return (name: string, isDir: boolean) => {
      return {name, next}
    }
  }
}

function doubleStarFilter (next: ?NameFilter) : NameFilter {
  function me (name: string, isDir: boolean) {
    if (isDir) {
      return {name, next: me}
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

function fromGlob (pattern: string, next: ?NameFilter) : NameFilter {
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
        return {name, next}
      } else {
        return null
      }
    }
  }
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
    splitPath
  },
  isAbsolute,
  fromGlob
}

module.exports = nameFilter