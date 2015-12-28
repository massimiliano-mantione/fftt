/* @flow */

module.exports = function (lab: any) : ((msg: string, test: () => ?Promise) => void) {
  return (msg: string, test: () => ?Promise) => {
    lab.it(msg, (done) => {
      let res = test()
      if (!res) {
        done()
      } else {
        // Assume res is a Promise
        res.done(() => { done() }, (err) => { done(err) })
      }
    })
  }
}
