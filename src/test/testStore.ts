import {
  Store
} from '../store'

import {
  expect
} from 'chai'

export default function testStore (description: string, s: Store): Promise<{}> {
  return new Promise((resolve, reject) => {
    describe(description, () => {
      it('Does not contain values when empty', () => {
        return s.getValue('foo').then(() => {
          throw new Error('unreachable')
        }).catch(() => {
          resolve()
        }).then(() => {
          return true
        })
      })

      let k1 = 'k1'
      let k2 = 'k2'
      let t1 = 't1'
      let t2 = 't2'
      let t3 = 't3'
      let t4 = 't4'
      let v1 = Buffer.from('v1')
      let v2 = Buffer.from('v2')

      it('Can add values', () => {
        return s.setValue(k1, v1).then(() => {
          return s.getValue(k1)
        }).then(v => {
          expect(v.toString()).to.equal('v1')
        }).then(() => {
          return s.setValue(k2, v2)
        }).then(() => {
          return s.getValue(k2)
        }).then(v => {
          expect(v.toString()).to.equal('v2')
        })
      })

      it('Can add references', () => {
        return s.setReference(k1, 1, 'n1', k2).then(() => {
          return s.getReferenceByIndex(k1, 1)
        }).then(r => {
          expect(r).to.equal(k2)
        }).then(() => {
          return s.getReferenceByName(k1, 'n1')
        }).then(r => {
          expect(r).to.equal(k2)
        })
      })

      it('Can add tags', () => {
        return s.setTag(t1, k1).then(() => {
          return s.setTag(t2, k1)
        }).then(() => {
          return s.setTag(t3, k1)
        }).then(() => {
          return s.setTag(t4, k1)
        }).then(() => {
          return s.getTag(t2)
        }).then(k => {
          expect(k).to.equal(k1)
        })
      })

      it('Can get tags by prefix', () => {
        return s.getTags('t').then(tags => {
          expect(tags[t1]).to.equal(k1)
          expect(tags[t2]).to.equal(k1)
          expect(tags[t3]).to.equal(k1)
          expect(tags[t4]).to.equal(k1)
          expect(tags['tt']).to.equal(undefined)
        })
      })

      it('Can get tags by interval', () => {
        return s.getTagsBetween('t2', 't4').then(tags => {
          expect(tags[t1]).to.equal(undefined)
          expect(tags[t2]).to.equal(k1)
          expect(tags[t3]).to.equal(k1)
          expect(tags[t4]).to.equal(undefined)
          expect(tags['tt']).to.equal(undefined)
        })
      })

      it('Can change generation', () => {
        return s.getGeneration().then(g => {
          expect(g).to.equal(1)
          return s.incrementGeneration()
        }).then((g) => {
          expect(g).to.equal(2)
          return s.setGeneration(3)
        }).then(() => {
          return s.getGeneration()
        }).then((g) => {
          expect(g).to.equal(3)
          return s.getValueGeneration(k1)
        }).then((g) => {
          expect(g).to.equal(1)
          return s.testAndTouchKey(k1)
        }).then(t => {
          expect(t).to.equal(true)
          return s.getValueGeneration(k1)
        }).then(g => {
          expect(g).to.equal(3)
          return s.testAndTouchKey('kk')
        }).then(t => {
          expect(t).to.equal(false)
        })
      })
    })
  })
}
