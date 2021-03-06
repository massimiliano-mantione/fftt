_Warning: reimplementation in progress_

_I am doing three main changes in this project:_

* _Store the repo in a DB_
* _Access the repo using fuse_
* _Switch from Flowtype to Typescript_

_The general concepts stay the same but I'll rewrite the README when the time comes_

# FFTT: Functional File Tree Transforms

A new concept of build tool.

A build is seen as a pure function that transforms a file tree (the source, or input) into another file tree (the build artifact, or output).

Both inputs and outputs are handled as immutable directory trees on disk.
To achieve this, every file tree is checked into a content addressable repository.
This repository is conceptually similar to git, with two main differences (which are why I did not reuse git for this):

* every directory and file can be used "as is", without a checkout operation
* directories in the repository use "structural sharing" in a way very similar to immutable data structures in functional programming languages: in this case, every file is present in the repository only once (identified by the hash of its contents), and every directory contains links to the files.

Every build step is a function that takes an immutable file tree as input, and produces another file tree that is in turn checked into the repository.
The function is implemented as a docker run command, and the input is mounted as a read only volume in the container so that it cannot be modified.
A fresh empty temporary directory is mounted as output volume, and just after the build step is done the build system checks it into the repository.
Therefore at the end of the build step both the input and output trees are in the repository, and accessible by their hash (content based, like in git).

The description of every build step can also be hashed.
It then becomes easy to cache the result of *applying* build steps to input trees (assuming that they are deterministic, which should be the case): the function is like `[hash(in), hash(step)] -> hash(out)`. This is conceptually equivalent to applying memoization to the build step functions.

A build is then just the functional composition of several build steps, and FFTT can perform only the steps that are needed because the inputs have changed (for all other steps the cached result will be used).
