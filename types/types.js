/* @flow */

declare module 'any-promise' {declare var exports : Promise}
declare module 'mock-fs' {declare var exports : any}

type Code = {
  expect: function;
}
declare module 'code' {declare var exports : Code}
