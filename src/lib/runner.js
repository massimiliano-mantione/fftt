/* @flow */

import type {Workdir, Repo} from './repo'
import type {TaskCommand} from './tasks'
import type {FileFilter} from './fileFilter'

import {Transform} from 'stream'
import Docker from 'dockerode'
let docker = new Docker({socketPath: '/var/run/docker.sock'})

function makeTransform () {
  return new Transform({transform: (data, encoding, callback) => {
    callback(null, data)
  }})
}

function run (ff: FileFilter, r: Repo, wd: Workdir, cmd: TaskCommand): Promise<void> {
  return new Promise((resolve, reject) => {
    let streams = [makeTransform(), makeTransform()]
    streams[0].pipe(process.stdout)
    streams[0].pipe(ff.fs.createWriteStream(wd.stdout))
    streams[1].pipe(process.stderr)
    streams[1].pipe(ff.fs.createWriteStream(wd.stderr))

    let options = {
      Tty: false,
      WorkingDir: cmd.cwd,
      Volumes: {
        '/repo': {},
        '/env': {}
      },
      HostConfig: {
        Binds: [
          r.ROOT + ':/repo:ro',
          wd.env + ':/env'
        ]
      }
    }

    docker.run(cmd.img, cmd.cmd, streams, options, function (err, data, container) {
      // We remove the container immediately because we are only interested
      // in its output, whch is already stored in the volume.
      // We don't wait for the removal because it would just slow the build.
      // container.remove(err => {
      //   console.error('WARNING: cannot remove container:', err)
      // })
      let exitCode = '' + data.StatusCode
      ff.writeText(exitCode, wd.exit).then(() => {
        if (err) {
          reject(err)
        } else {
          if (exitCode === '0') {
            resolve()
          } else {
            reject('Container exit code: ' + exitCode)
          }
        }
      }).catch(err => {
        reject(err)
      })
    })
  })
}

export default run
