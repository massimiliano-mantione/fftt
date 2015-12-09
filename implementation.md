
Here are the implementation details for FFTT.


# Build environment

The build happens on two "host" machines:
* The "source" host, which is the one where usually the source tree is stored. It could be a development workstation, or a server in a build system.
  The requirement for the source host are:
  - a nodejs installation that can run FFTT
  - the docker executable, that can talk to a suitable docker host
  - the ability to share the source tree with the docker host
* The "docker" host, which might or might not be the same as the source host. If the source host is a development workstation with an OS other than Linux, the docker host will likely be a boot2docker environment managed by the docker toolbox. The only requirement for the docker host is the ability to run docker containers.


# Build graph description

The build is described by a declarative yaml file that defines the graph (DAG) of build steps.
A yaml file has been picked instead of a plain javascript file because it is less expressive (it is not "turing complete" like javascript), but we think that the full expressiveness of javascript is not needed and would make the file less amenable to analysis.

Every build step is a "task", and must have a name unique in the whole build.
Each task can (optionally) have other tasks as input.
If it does not have any input it is considered an input node in the graph.
Input nodes can take as input a directory from the source host (specified as a path relative to the build file), and can (optionally) run a "pre-build" step that can mutate the source tree (for instance, to check out a particular git revision). In any case the result of an input step is an immutable file tree checked into the artifact repository.

The build file is an array of tasks, where ordering is significant because a task can only have as input an already defined task. This is not a limiting constraint because the build graph must be acyclic anyway, and it makes the enforcement of this property simpler (and more explicit).

A build step might be implemented as the import of another build file, describing a build subgraph.
In this case one or more tasks can be passed as named arguments (imputs) to this task, and they will be the values of the correspondingly named inputs in the imported graph.
The name of the "target" tasks of the subgraph must also be specified, and it defines what tasks the subgraph will compute.
They will then be available as intermediate values inside the main (importer) build file.
Of course file imports can be nested but they can not be recursive (FFTT will not check the error and will likely crash in this case).

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
  - for files, a file whose name is the hash of the file contents
  - for directories, a json document that describes the directory contents (file names and their hashes)
  These files are the hard link targets used for reference counting.

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

* For each computation in `mem` which has `ref` has a refcount of 1, remove that result.
* For each function in `mem` that is empty (no results are listed), remove it entirely.
* For each directory entry in `obj` which has `ref` has a refcount of 2, remove that entry and its corresponding one in `dir` (refcount is 2 because the file is referenced by `obj` and by `dir`).
* For each file entry in `obj` which has `ref` has a refcount of 1, remove that entry.
* Return the number of removed items.

To cleanup unused space the first step is removing whatever is not needed from `out`.
Then the "cleanup" procedure must be invoked repeatedly, until it does not remove anything.
