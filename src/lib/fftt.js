/* @flow */

import yaml from 'js-yaml'
import repository from './repo'
import {makeBuildGraph} from './tasks'
import ff from './fileFilter'

let cwd = process.cwd()

let graphFile = 'fftt.yaml'
let graphFileChanged = false
let targetTask = null

function err (message: string): void {
  throw new Error(message)
}

function processArg (arg: string): void {
  if (arg.charAt(0) === '.' || arg.charAt(0) === '/') {
    if (graphFileChanged) {
      err('Build file specified twice: ' + arg)
    } else {
      graphFileChanged = true
      graphFile = arg
    }
  } else {
    if (targetTask !== null) {
      err('Target task specified twice: ' + arg)
    } else {
      targetTask = arg
    }
  }
}

try {
  for (let argIndex = 2; argIndex < process.argv.length; argIndex++) {
    processArg(process.argv[argIndex])
  }

  graphFile = ff.join(cwd, graphFile)
  let repoBase = ff.dirname(graphFile)
  let repoRoot = ff.join(repoBase, 'repo')
  let repo = repository(ff, repoRoot)
  ff.readText(graphFile).then(graphText => {
    return yaml.safeLoad(graphText)
  }).then(graphData => {
    return makeBuildGraph(graphData)
  }).then(graph => {
    console.log('PARSED', graph)
  }).catch(e => {
    console.log(e.message)
    process.exit(1)
  })
} catch (e) {
  console.log(e.message)
  process.exit(1)
}
