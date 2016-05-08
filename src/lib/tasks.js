/* @flow */

import {join} from 'path'
import hash from './hash'
// import type {FileFilter, TreeNode, TreeNodeMap} from './fileFilter'

export type GlobArray = Array<string|GlobArray>
export type Glob = {
  from: string;
  files: GlobArray;
  to: string;
}

export type TaskArgument = {
  id: ?string;
  source: ?string;
  files: Glob;
}
export type TaskInput = Array<TaskArgument>

export type TaskCommand = {
  img: string;
  cmd: Array<string>;
  in: string;
  out: string;
  cwd: string;
  mem: boolean;
  ovr: boolean;
}

export type Task = {
  id: string;
  in: TaskInput;
  out: Glob;
  run: TaskCommand;
  hash: string;
}

export type BuildGraph = {
  repoRoot: string;
  sourceRoot: string;
  buildRoot: string;
  defaultTask: ?string;
  tasks: {[key: string]: Task}
}

function err (message: string): void {
  throw new Error(message)
}
function objString (o: any): string {
  return require('util').inspect(o)
}

function makeTaskArgument (data: any, taskId: string): TaskArgument {
  if (typeof data === 'string') {
    return {
      id: data,
      source: null,
      files: makeGlob(null, taskId)
    }
  }

  let arg = {
    id: data.id || null,
    source: data.source || null,
    files: makeGlob(data.files, taskId)
  }
  if (arg.id && typeof arg.id !== 'string') {
    err('Invalid id ' + objString(arg.id) + ' in argument in task ' + taskId)
  }
  if (arg.source && typeof arg.source !== 'string') {
    err('Invalid source ' + objString(arg.source) + ' in argument in task ' + taskId)
  }
  if (!(arg.id || arg.source)) {
    err('Argument in task' + taskId + ' has no id or source')
  }
  return arg
}

function makeTaskInput (data: any, taskId: string): TaskInput {
  if (!Array.isArray(data)) {
    data = [data]
  }
  return data.map(argData => makeTaskArgument(argData, taskId))
}

function isGlobArray (data: any): boolean {
  if (Array.isArray(data)) {
    for (let element of data) {
      if ((typeof element !== 'string') && !isGlobArray(element)) {
        return false
      }
    }
    return true
  } else {
    return false
  }
}

function makeGlob (data: any, taskId: string): Glob {
  if (!data) {
    return {
      from: '/',
      to: '/',
      files: ['**/*']
    }
  } else if (typeof data === 'string') {
    return {
      from: '/',
      to: '/',
      files: [data]
    }
  } else if (isGlobArray(data)) {
    return {
      from: '/',
      to: '/',
      files: data
    }
  } else if (typeof data === 'object' && !Array.isArray(data)) {
    let files = data.files
    if (!files) {
      files = ['**/*']
    } else if (typeof files === 'string') {
      files = [files]
    } else if (!isGlobArray(files)) {
      err('Invalid files specification ' + objString(files) + ' in task ' + taskId)
    }
    let glob = {
      from: data.from || '/',
      to: data.to || '/',
      files: files
    }
    if (typeof glob.from !== 'string') {
      err('Invalid from specification ' + objString(glob.from) + ' in task ' + taskId)
    }
    if (typeof glob.to !== 'string') {
      err('Invalid to specification ' + objString(glob.to) + ' in task ' + taskId)
    }
    return glob
  } else {
    err('Invalid glob ' + objString(data) + ' in task ' + taskId)
    return makeGlob(null, taskId)
  }
}

function makeTaskCommand (data: any, taskId: string): TaskCommand {
  let cmd = data.cmd
  if (typeof cmd === 'string') {
    cmd = [cmd]
  }
  if (!Array.isArray(cmd)) {
    err('Invalid cmd ' + objString(cmd) + ' in task ' + taskId)
  }
  cmd = cmd.map(cmdElement => {
    if (typeof cmdElement === 'number') {
      cmdElement = '' + cmdElement
    }
    if (typeof cmdElement !== 'string') {
      err('Invalid cmd element ' + objString(cmdElement) + ' in task ' + taskId)
    }
    return cmdElement
  })
  let command = {
    img: data.img,
    cmd: cmd,
    in: data.in || '/in',
    out: data.out || '/out',
    cwd: data.cwd || '/',
    mem: data.mem !== false,
    ovr: data.ovr === true
  }
  if (typeof command.in !== 'string') {
    err('Invalid "in" ' + objString(command.in) + ' in run in task ' + taskId)
  }
  if (typeof command.out !== 'string') {
    err('Invalid "out" ' + objString(command.out) + ' in run in task ' + taskId)
  }
  if (typeof command.cwd !== 'string') {
    err('Invalid "cwd" ' + objString(command.cwd) + ' in run in task ' + taskId)
  }
  return command
}

function pushGlobArrayParts (glob: any, parts: Array<string>): void {
  if (typeof glob === 'string') {
    parts.push(glob)
  } else {
    parts.push('[')
    for (let globPart of glob) {
      pushGlobArrayParts(globPart, parts)
    }
    parts.push(']')
  }
}
function flattenGlobArray (globArray: GlobArray): string {
  let parts = []
  pushGlobArrayParts(globArray, parts)
  return parts.join('/')
}
let runHashSteps = ['img', ['cmd', '[]'], 'in', 'out', 'cwd', 'mem', 'ovr']
let taskHashSteps = ['id', 'outFrom', 'outFiles', 'outTo', ['run', runHashSteps]]

function makeTask (data: any): Task {
  let taskId = data.id
  if (typeof taskId !== 'string') {
    err('Invalid id ' + objString(taskId) + ' in task ' + objString(data))
  }
  let task = {
    id: taskId,
    in: makeTaskInput(data.in, taskId),
    out: makeGlob(data.out, taskId),
    run: makeTaskCommand(data.run, taskId),
    hash: hash.EMPTY
  }
  let toHash = {
    id: task.id,
    outFrom: task.out.from,
    outTo: task.out.to,
    outFiles: flattenGlobArray(task.out.files),
    run: task.run
  }
  task.hash = hash.hashObject(taskHashSteps, toHash, 'T')
  return task
}

function makeBuildGraph (data: any, baseDir: string): BuildGraph {
  let hasDefault = false
  let graph = {
    repoRoot: '',
    sourceRoot: '',
    buildRoot: '',
    defaultTask: null,
    tasks: {}
  }
  if (!Array.isArray(data)) {
    err('Build file must be a YAML list')
  }
  for (let dataElement of data) {
    if (typeof dataElement.id === 'string') {
      let task = makeTask(dataElement)
      if (graph.tasks[task.id]) {
        err('Duplicate task ' + task.id)
      } else {
        graph.tasks[task.id] = task
      }
    } else if (typeof dataElement.env === 'string') {
      // Just skip env for now
    } else if (typeof dataElement.default === 'string') {
      if (hasDefault) {
        err('Default task already present: ' + dataElement.default)
      } else {
        hasDefault = true
        graph.defaultTask = dataElement.default
      }
    } else if (typeof dataElement.dirs === 'object') {
      let dirs = dataElement.dirs
      if (graph.repoRoot !== '' || graph.sourceRoot !== '' || graph.buildRoot !== '') {
        err('Cannot specify dirs more than once: ' + objString(dirs))
      }
      if (typeof dirs.repo === 'string') {
        graph.repoRoot = join(baseDir, dirs.repo)
      }
      if (typeof dirs.src === 'string') {
        graph.sourceRoot = dirs.src
      }
      if (typeof dirs.out === 'string') {
        graph.buildRoot = join(baseDir, dirs.out)
      }
    } else {
      err('Invalid build file element: ' + objString(dataElement))
    }
  }
  if (graph.repoRoot === '') {
    graph.repoRoot = join(baseDir, 'repo')
  }
  if (graph.sourceRoot === '') {
    graph.sourceRoot = baseDir
  }
  if (graph.buildRoot === '') {
    graph.buildRoot = join(baseDir, 'out')
  }

  for (let taskId of Object.keys(graph.tasks)) {
    let task = graph.tasks[taskId]
    for (let arg of task.in) {
      let id = arg.id
      if (id && !graph.tasks[id]) {
        err('Input ' + id + ' not found in task ' + task.id)
      }
    }
  }

  if (graph.defaultTask !== null && !graph.tasks[graph.defaultTask]) {
    err('Default task not found: ' + graph.defaultTask)
  }

  return graph
}

let internal = {
  isGlobArray,
  makeTaskArgument,
  makeTaskInput,
  makeTaskCommand,
  makeGlob,
  makeTask
}

export {
  internal,
  makeBuildGraph
}
