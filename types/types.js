/* @flow */

declare module 'any-promise' {declare var exports : Promise}
declare module 'mock-fs' {declare var exports : any}

type Lab = {
  script: () => {
    describe : function;
    it : function;
    before : function;
    after : function;
    beforeEach : function;
    afterEach : function;
  }
}
declare module 'lab' {declare var exports : Lab}

type Code = {
  expect: function;
}
declare module 'code' {declare var exports : Code}

type Util = {
  copy: (source: string, target: string) => Promise<void>;
  readText: (sourcePath: string) => Promise<string>;
  writeText: (text: string, targetPath: string) => Promise<void>;
  stat: () => Promise<any>;
  makeTreeNode: (name: string, isDir: boolean, isExe: boolean, mtimeTicks: number, hash: string, children: Array<TreeNode>) => TreeNode;
  cloneTreeNode: (node: TreeNode) => TreeNode;
  fromFs: (fs: any) => Util;
}
type TreeNode = {
  name: string;
  isDir: boolean;
  isExe: boolean;
  mtimeTicks: number;
  hash: ?string;
  children: ?Array<TreeNode>;
}
