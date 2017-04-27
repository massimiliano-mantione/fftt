import {
  Store,
  StoreKey,
  StoreValue,
  TagValues
} from './store'

type Value = {
  key: StoreKey,
  value: StoreValue,
  generation: number,
  indexedReferences: {
    [index: number]: StoreKey
  },
  namedReferences: {
    [name: string]: StoreKey
  }
}

export default function memoryStore (): Store {
  let values: {
    [key: string]: Value
  } = {}
  let tags: {
    [tag: string]: StoreKey
  } = {}
  let generation = 1

  function getValue (k: StoreKey): Promise<StoreValue> {
    let v = values[k]
    if (v) {
      return Promise.resolve(v.value)
    } else {
      return Promise.reject('Key not found: ' + k)
    }
  }

  function getReferenceByIndex (k: StoreKey, index: number): Promise<StoreKey> {
    let v = values[k]
    if (v) {
      let r = v.indexedReferences[index]
      if (r) {
        return Promise.resolve(r)
      } else {
        return Promise.reject('Reference not found: ' + index)
      }
    } else {
      return Promise.reject('Key not found: ' + k)
    }
  }

  function getReferenceByName (k: StoreKey, name: string): Promise<StoreKey> {
    let v = values[k]
    if (v) {
      let r = v.namedReferences[name]
      if (r) {
        return Promise.resolve(r)
      } else {
        return Promise.reject('Reference not found: ' + name)
      }
    } else {
      return Promise.reject('Key not found: ' + k)
    }
  }

  function getTag (tag: string): Promise<StoreKey> {
    let t = tags[tag]
    if (t) {
      return Promise.resolve(t)
    } else {
      return Promise.reject('Tag not found: ' + tag)
    }
  }

  function getTags (prefix: string): Promise<TagValues> {
    let result = {}
    Object.keys(tags).forEach((t) => {
      if (t.startsWith(prefix)) {
        result[t] = tags[t]
      }
    })
    return Promise.resolve(result)
  }

  function getTagsBetween (start: string, end: string): Promise<TagValues> {
    let result = {}
    Object.keys(tags).forEach((t) => {
      if (t.localeCompare(start) >= 0 && t.localeCompare(end) < 0) {
        result[t] = tags[t]
      }
    })
    return Promise.resolve(result)
  }

  function getGeneration (): Promise<number> {
    return Promise.resolve(generation)
  }

  function setGeneration (g: number): Promise<void> {
    generation = g
    return Promise.resolve()
  }

  function incrementGeneration (): Promise<number> {
    generation += 1
    return Promise.resolve(generation)
  }

  function getValueGeneration (k: StoreKey): Promise<number> {
    let v = values[k]
    if (v) {
      return Promise.resolve(v.generation)
    } else {
      return Promise.reject('Key not found: ' + k)
    }
  }

  function testAndTouchKey (k: StoreKey): Promise<boolean> {
    let v = values[k]
    if (v) {
      v.generation = generation
      return Promise.resolve(true)
    } else {
      return Promise.resolve(false)
    }
  }

  function setValue (k: StoreKey, v: StoreValue): Promise<void> {
    let val = values[k]
    if (val) {
      val.value = v
      val.generation = generation
    } else {
      values[k] = {
        key: k,
        value: v,
        generation: generation,
        indexedReferences: {},
        namedReferences: {}
      }
    }
    return Promise.resolve()
  }

  function setReference (k: StoreKey, index: number | null, name: string | null, target: StoreKey): Promise<void> {
    let v = values[k]
    if (v) {
      if (index !== null) {
        v.indexedReferences[index] = target
      }
      if (name !== null) {
        v.namedReferences[name] = target
      }
      return Promise.resolve()
    } else {
      return Promise.reject('Key not found: ' + k)
    }
  }

  function setTag (tag: string, v: StoreKey): Promise<void> {
    tags[tag] = v
    return Promise.resolve()
  }

  function commit (): Promise<void> {
    return Promise.resolve()
  }

  function collectGarbage (): Promise<boolean> {
    return Promise.resolve(false)
  }

  return {
    getValue,
    getReferenceByIndex,
    getReferenceByName,
    getTag,
    getTags,
    getTagsBetween,
    getGeneration,
    setGeneration,
    incrementGeneration,
    getValueGeneration,
    testAndTouchKey,
    setValue,
    setReference,
    setTag,
    commit,
    collectGarbage
  }
}
