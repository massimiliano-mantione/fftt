/* @flow */

import type {TreeNode} from './util'
import type {NameFilter} from './nameFilter'
import * as util from './util'
import * as nameFilter from './nameFilter'

function treeFilter (tree: TreeNode, filter: NameFilter) : ?TreeNode {
  let filterResult = filter(tree.name, tree.isDir)
  if (filterResult) {
    let res = util.makeTreeNode(
        filterResult.name,
        tree.isDir,
        tree.isExe,
        [],
        tree.mtimeTicks,
        tree.hash)
    let nextFilter = filterResult.next
    if (tree.isDir) {
      tree.children.forEach((child) => {
        let filteredChild = treeFilter(child, nextFilter)
        if (filteredChild) {
          res.children.push(filteredChild)
        }
      })
    }

    if (filterResult.volatile && res.children.length === 0) {
      return null
    } else {
      return res
    }
  } else {
    return null
  }
}

module.exports = {
  nameFilter,
  filter: treeFilter
}
