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

function fatal (e) {
  console.log(e)
  // if (e.stack) {
  //   console.log(e.stack)
  // }
  process.exit(1)
}

try {
  for (let argIndex = 2; argIndex < process.argv.length; argIndex++) {
    processArg(process.argv[argIndex])
  }

  graphFile = ff.join(cwd, graphFile)
  let baseDir = ff.dirname(graphFile)
  ff.readText(graphFile).then(graphText => {
    return yaml.safeLoad(graphText)
  }).then(graphData => {
    return makeBuildGraph(graphData, baseDir)
  }).then(graph => {
    if (!targetTask) {
      if (graph.defaultTask) {
        targetTask = graph.defaultTask
      } else {
        return Promise.reject('Target task not specified')
      }
    }
    let task = graph.tasks[targetTask]
    if (!task) {
      return Promise.reject('Cannot find task ' + targetTask)
    }
    return repository(ff, graph.repoRoot).then(repo => {
      let tag = new Date().toISOString()
      let outLink = ff.join(graph.buildRoot, 'latest')

      console.log('Starting build ' + tag)

      return repo.evaluateTask(task, graph, tag).then(() => {
        return ff.mkdirp(graph.buildRoot)
      }).then(() => {
        return ff.unlink(outLink).catch(err => {
          if (err.code === 'ENOENT') {
            return Promise.resolve()
          } else {
            return Promise.reject(err)
          }
        })
      }).then(() => {
        return ff.slink(ff.join(graph.repoRoot, 'out', tag), outLink)
      })
    })
  }).catch(e => {
    fatal(e)
  })
} catch (e) {
  fatal(e)
}
