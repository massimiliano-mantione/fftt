/* @flow */

type LabFunctionDone = (done: () => void) => void

type LabItOptions = {
  timeout: ?number;
  parallel: ?bool;
  skip: ?bool;
  only: ?bool;
}
type LabTimeoutOptions = {
  timeout: ?number;
}

type LabScript = {
  describe: (msg: string, options: (() => void) | LabItOptions, code: ?(() => void)) => void;
  it: (msg: string, options: LabFunctionDone | LabItOptions, code: ?LabFunctionDone) => void;
  before: (code: LabFunctionDone, options: ?LabTimeoutOptions) => void;
  after: (code: LabFunctionDone, options: ?LabTimeoutOptions) => void;
  beforeEach: (code: LabFunctionDone, options: ?LabTimeoutOptions) => void;
  afterEach: (code: LabFunctionDone, options: ?LabTimeoutOptions) => void;
}

export type Lab = {
  script: () => LabScript
}
declare module 'lab' { declare var exports : Lab }

type LabFunctionPromise = (() => ?Promise<any>)
type LabScriptPromise = {
  describe: (msg: string, options: (() => void) | Object, code: ?(() => void)) => void;
  it: (msg: string, options: LabFunctionPromise | Object, code: ?LabFunctionPromise) => void;
  before: (code: LabFunctionPromise) => void;
  after: (code: LabFunctionPromise) => void;
  beforeEach: (code: LabFunctionPromise) => void;
  afterEach: (code: LabFunctionPromise) => void;
}

function wrapCode (test: LabFunctionPromise): LabFunctionDone {
  return (done: () => void) => {
    let res = test()
    if (!res) {
      done()
    } else {
      // Assume res is a Promise
      res
        .then(() => { done() })
        .catch((err) => { done(err) })
    }
  }
}

module.exports = function (lab: LabScript) : LabScriptPromise {
  return {
    describe: lab.describe,
    it: function (msg: string, options: LabFunctionPromise | LabItOptions, code: ?LabFunctionPromise) : void {
      if (!code && typeof options === 'function') {
        lab.it(msg, wrapCode(options))
      } else if (typeof options === 'object' && typeof code === 'function') {
        lab.it(msg, options, wrapCode(code))
      } else {
        throw new Error('Wrong arg types: options ' + (typeof options) + ', code ' + (typeof code))
      }
    },
    before: function (code: LabFunctionPromise) : void {
      lab.before(wrapCode(code))
    },
    after: function (code: LabFunctionPromise) : void {
      lab.after(wrapCode(code))
    },
    beforeEach: function (code: LabFunctionPromise) : void {
      lab.beforeEach(wrapCode(code))
    },
    afterEach: function (code: LabFunctionPromise) : void {
      lab.afterEach(wrapCode(code))
    }
  }
}
