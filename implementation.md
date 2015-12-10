
Here are the implementation details for FFTT.


# Build environment

The build conceptually happens on three "host" machines.
Each machine could be a development workstation, a virtual machine, or a server in a build system, and the distinction between them is mostly conceptual, to clearly specify requirements for the three of them.
In practice two (or even all the three of them) could be the same machine.

That said, the different host roles are:

* The *docker* host, which is the one where the build tasks are executed (as docker containers). It must be a docker host, capable of running docker containers, and it must have efficient read only access to the repository (exposing it as a read only volume inside each build task container).
* The *build* host, which is the one that runs the FFTT build logic. It might or might not be the same as the *source* host and-or the *docker* host. If it is a docker container, it must be capable of running dockers on the
  Its requirements are:
  - A nodejs installation that can run FFTT.
  - Having efficient read-write access to the repository (it has the responsibility of checking file trees into the repository).
  - Having reasonably efficient read only access to the source tree (it must read it to check input trees into the repository).
  - The docker executable, and the ability to run dockers on the *docker* host (the *build* host could be a docker container, but it should be privileged and have access to a docker demon socket of the *docker* host).
* The *source* host, which is the one where the source tree is stored.
  The requirement for the source host are:
  - The ability to invoke FFTT on the *build* host.
  - The ability to share the source tree (read only) with the *build* host.
  - Likely, having access (even just read only) to the repository so that the build artifacts can be inspected and-or used.


# Build graph description

The build is described by a declarative yaml file that defines the graph (DAG) of build steps.
A yaml file has been picked instead of a plain javascript file because it is less expressive (it is not "turing complete" like javascript), but we think that the full expressiveness of javascript is not needed and would make the file less amenable to analysis.

Every build step is a "task", and must have a name unique in the whole build.
Each task can (optionally) have other tasks as input.
If it does not have any input it is considered an input (source) node in the graph.
Input nodes can take as input a directory from the source host (specified as a path relative to the build file) and a glob set that specifies which files are relevant for the build. In any case the result of an input step is an immutable file tree checked into the artifact repository.

The build file is an array of source and task nodes, where ordering is significant because a node can only have as input an already defined node. This is not a limiting constraint because the build graph must be acyclic anyway, and it makes the enforcement of this property simpler (and more explicit).

Another kind of graph node is the import of another build file, describing a build subgraph.
In this case one or more tasks can be passed as named arguments (imputs) to this subgraph, and they will be the values of the correspondingly named inputs in the imported graph.
The name of the "target" tasks of the subgraph must also be specified, and it defines what tasks the subgraph will compute.
They will then be available as intermediate values inside the main (importer) build file.
Of course file imports can be nested but they can not be recursive (FFTT will not check for this, and will likely crash in this case).

Each build task must also specify a docker run command, that is the implementation of the build step itself.
This command will implicitly receive arguments so that it will have the following volumes available:

* `/build/in`: the input file tree, mounted read only
* `/build/out`: an empty directory, where the task output is supposed to be stored

Optionally the system can be instructed to reproduce the contents of "in" inside the "out" directory, building a tree of directories (read write) which in turn contain symlinks to the files in the "in" tree.
Moreover, the working directory by default would be `/build`, but it could be set to be either `/build/in` or `/build/out`.
This should help integrating build steps that are implemented as mutations of the source tree, and are hard to configure in a different way.

Finally, every time a file tree is specified in the description of a task (either one of the inputs or the output), it is possible to declaratively specify a set of glob based "filter and move-rename" operations.
This makes it easy to limit the source files to the ones strictly needed for the build step, and likewise to select only the relevant files as output of the step.
These "filter and move" operations are subject to memoization like every other, and they are implemented internally "synthesizing" the resulting file trees into the repository, so in practice they are even cheaper than actual file copy or move operations.


# Artifact repository storage

## Directory layout

The repository is composed of several directories.
The design principles are the following:

* The repository stores several kind of "resources":
  - files
  - directories
  - build step memoization data
  - build results identified by the name of the build step
* Every file (identified by its contents) is stored in the repository only once; the same is true for directories.
* Every "use" of a resource is marked by a hard link to the file that describes that resource. Since resources are immutable the graph is a DAG: links will never form cycles.
* Even if we know by design that there are no cycles, hard links to directories must be avoided so for directories the convention is to have a hard link to the file that describes the directory contents (the one that is used to compute the directory hash).
* Hard links have the nice property that the target file keeps track of the incoming links, practically implementing reference counting. We can use this to implement repository cleanup (garbage collection) efficiently (reference counting is fine because, as stated above, there are no cycles).

Given these principles, the actual implementation is the following set of directories:

* `obj`: The raw contents of the repository
  - for files, a file whose name is the hash of the file contents (and whose data are, obviously, the contents of the file)
  - for directories, a json document that describes the directory contents (file names and their hashes).
  These files are used as hard link targets for reference counting (because we cannot hard link directories).

* `dir`: For each directory, it stores a directory named like the hash of the dir (the same used in `obj`).
  This directory in turn contains:
  - `hash`: a file that contains the hash value
  - `self`: a hard link to the file describing this directory in `obj`
  - `objs`: a directory containing, for every directory entry, one hard link named like the entry and pointing to the corresponding file in `obj`
  - `data`: a usable checkout of the directory (see further details below)

* `mem`: The memoization cache, containing one directory for every function (named as the hash of the function description).
  These directories in turn contain one `data` file (describing the function), and one directory for every computation of the function, named as the concatenation of the hashes of the inputs (and therefore, obviously, unique for every possible input).
  Each of these "computation result" directories in turn contains:
  - `ref`: a (possibly empty) file that describes this computation, and will be the target of hard links from computations that have this as input
  - `out`: a directory with the function result, with two files: `obj` (a hard link to the file describing the result in
    `obj`), and `dir` (a symlink to the result in `dir`)
  - `in`: a directory (possibly empty) referencing the inputs of this computation; each entry has as name the hash of the input, and as contents a `ref` hard link pointing to the `ref` of the input, and a `res` symlink pointing to the "result" of the input (the input *must* be another computation result, see below)
  - `log`: a directory containing two hard links, `stdout` and `stderr`, pointing to two files in `obj` and containing the output of the process that performed the step
  - `exit`: a file containing the exit code of the process that performed the step in unicode ("0" for success, as usual)

* `out`: The actual output directory of the build system.
  Each time a TTFF build is started, the target build step (or steps) should be specified, and those steps have names in the build file.
  The `out` directory contains one directory for each build target, named like its step in the build file.
  Inside these directories there is one directory for each successful build. The names of these directories are the versions of the build artifacts, computed as specified in the build file. Each of these directories contains a `ref` and `res` link pair (hard and sym), referring to the relevant entry in the memoization cache.
  In case of errors the directory is named "error-xyz" where xyz is the semver that the build would have had. These error directories should not be used as build artifacts but examining their logs might be useful.
  Every file and directory described so far is immutable, or at most some directory is "append only" (files or directories can be added to it, but nothing can be changed).
  As a special case, each "build target" directory in the `out` directory contains a `latest` symlink, pointing to the last successful build result. This symlink is changed at every successful build, and can be watched by a deployment agent to trigger restarts or redeployments of the build artifact.


## Directory checkout format

The `data` section of `dir` entries must be directly usable as a read-only version of the directory from a process that can access the repository in as a read-only file system.

It could be very tempting to implement every `data` directory as a directory containing links to the directory entries.
Maybe hard links for the files, and in any case symlinks to other `data` directories for subdirectories.
This would work, to some extent, but it would have the unpleasant property that every directory would have no notion of its "parent".
This would be "by design", because every directory could be reused inside different parents, so that space occupation would be minimal and anyway proportional only to the size of the directory itself, and not to the size of its subdirectories.
However this would make "cd .." commands fail in rather unintuitive ways during build steps.

Another approach, a bit more space consuming, would be to fully recreate the tree of subdirectories inside the `data` section of every `dir` entry.
This would make each directory have a unique (and correct) parent, so this is the approach that we are choosing.

Files can be linked; the choice is between symbolic and hard kinks.
Both would work fine, but at this point we are considering the scenario where the repository is accessed over a network file system like nfs. In this case, if the links are symbolic the network file system server can show the symlink (pointing to `obj`) to the client, and therefore the client will download the file only once (in `obj`), and use the links from everywhere else. Hard links, on the other hand, would not have this property: they would just look like regular files to the network file system, and the advantage of content addressable storage would be lost.

For these reasons the format of `data` directories in `dir` is trees of regular directories, referencing files in `obj` using relative symlinks.


## Garbage collection implementation

This implementation schema has the following interesting properties:

* `obj` contains only files, and these files are targets of hard links when they are used by something.
* `dir` contains only directories, which can be the target of symlinks when the directory is used by something (the user is also required to have a hard link to the directory in `obj` to increase its reference count)
* Each entry describing a computation result in `mem` has two kind of references:
  - one to a directory, which is the output of the computation and ultimately points to `dir` (and to `obj` for stdin and stderr)
  - then a set of references to other computation results, therefore pointing inside `mem`, and again implemented as a pair of a hard link (`ref`, to keep track of the reference count) and a symlink (`res`, the actual value)
* Each entry in `out` can also have references to entries in `mem`, implemented in the same way.

References go from `out`, to `mem`, and then to `obj` and `dir`, but never in the opposite direction.

We can observe that a file is usually referenced once by the directory where it "naturally" resides, plus one time by each "additional" hard link that references it.
Therefore a file with only *one* reference (refcount of 1) is referenced only by the directory where we are seeing it, and nothing else.

As a result we can implement a "cleanup" procedure that does the following:

* For each computation in `mem` in which `ref` has a refcount of 1, remove that result.
* For each function in `mem` that is empty (no results are listed), remove it entirely.
* For each directory entry in `obj` which has a refcount of 2, remove that entry and its corresponding one in `dir` (refcount is 2 because the directory description file is referenced by both `obj` and `dir`).
* For each file entry in `obj` which has a refcount of 1, remove that entry.
* Return the number of removed items.

To cleanup unused space the first step is removing whatever is not needed from `out`.
Then the "cleanup" procedure must be invoked repeatedly, until it does not remove anything.


# Description of the build file

## The `source` node

A `source` node looks like this:

```
- source:
  id: "node-name"
  path: "relative/path/to/directory"
  files: glob-set
```

It imports the files specified by `files`, from the path `path` (relative to the build file), into the value identified by `id` in the build graph.
`files` can be absent, in which case the '\*' glob will be assumed.
If `path` is absent this source node is supposed to be used as subgraph argument (see `import` below).

## The `task` node

A `task` looks like this:

```
- task:
  id: "node-name"
  ver: "x.y.z"
  in:
    - "node-id-1": glob-set
    - "node-id-2": glob-set
    - "node-id-n": glob-set
  out: glob-set
  run:
    img: "docker-image"
    cmd: ["cmd", "arg1", "arg2"]
    cwd: "in"|"out"              # optional, defaults to none which means "/build"
    mem: true|false              # optional, defaults to true
```

`id` is the node name, and `ver` is the version that will be used in naming the output of the build.

`in` defines the inputs (graph nodes) that concur in forming the input tree.
It is a sequence because the inputs are composed (like a set union) to form the input tree, and in case a file is present multiple times the last "copy" overwrites the previous ones (therefore ordering is significant).

`out` defines which files will be used to build the final output of the task.

Finally, `run` specifies the docker command that implements the build step.
Here setting `mem` to `false` flags the task as non deterministic, meaning that its result cannot be cached and must be recomputed every time.


## The `import` node

An `import` node looks like this:

```
- import:
  path: "relative/path/to/build-file"
  in:
    "local-node-id-1": "file-node-id-1"
    "local-node-id-2": "file-node-id-2"
    "local-node-id-n": "file-node-id-n"
  out:
    - "file-result-node-id-1": "local-node-id-1"
    - "file-result-node-id-2": "local-node-id-2"
    - "file-result-node-id-n": "local-node-id-n"
```

It is used to include an external build file, inserting it as a subgraph in the current build graph.
This subgraph will be evaluated normally, producing the selected outputs and naming them with the given local ids (so that they will be available as values in the current build).
However, in the input file, source nodes that are named as arguments in the `in` section will have the value of the corresponding nodes taken from the local file.


## Glob operations

A *glob-set* is described as a sequence of operations that specify files to copy from the source to the destination.
Each operation can have the following form:

* A single string, specifying a glob of files that must be included. In this case each file retains its relative path.
* A dictionary of this shape: `{from: "from-path", files: "glob", to: "to-path"}`, which means that glob is evaluated at path `from-path` and the resulting files will be put at path `to-path` (retaining their paths relative to `from-path`). Both `from-path` and `to-path` are optional, and if absent are equivalent to the empty path, but at least one must be present (otherwise the form should have been expressed as a single glob, like in the first case). `from-path` cannot be a glob (but this restriction will likely be lifted in the future, to allow copying files from multiple paths into a single directory).

As a special case, the glob set `['*']` can be abbreviated as `'*'`.


## Build arguments

At the start of a build file there can be an `args` section.
The section is written like this:

```
- args:
  "$arg-1$": "value-1"
  "$arg-2$": "value-2"
  "$arg-n$": "value-n"
```

Inside `run` sections, strings that contain arguments will have them replaced by the argument values.
Argument values can be overridden passing them on the command line when the build is invoked.
If an argument has a `null` default value, its value *must* be provided on the command line (in other words, every argument *must* have a non-null value).


## Default tasks

At the start of a build file there can be a `default` section (after the `args` section if it is present), to specify what to build.
The `default` can specify a single task, like this:

```
- default: "task-id"
```

or a set of tasks:

```
- default: ["tasd-id-1", "tasd-id-2", "tasd-id-n"]
```

If a default section is present, the specified tasks will be built if no task is specified on the command line.
If there is no default section one or more tasks *must* be specified on the command line.
