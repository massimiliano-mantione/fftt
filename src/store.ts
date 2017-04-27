
export type StoreKey = string
export type StoreValue = Uint8Array
export type StoreReference = {
  from: StoreKey
  to: StoreKey
  index: number
  name: string
}
export type TagValues = {
  [tag: string]: StoreKey
}

export type ReadStore = {
  getValue: (k: StoreKey) => Promise<StoreValue>,
  getReferenceByIndex: (k: StoreKey, index: number) => Promise<StoreKey>,
  getReferenceByName: (k: StoreKey, name: string) => Promise<StoreKey>,
  getTag: (tag: string) => Promise<StoreKey>,
  getTags: (prefix: string) => Promise<TagValues>,
  getTagsBetween: (start: string, end: string) => Promise<TagValues>
}

export type WriteStore = {
  getGeneration: () => Promise<number>,
  setGeneration: (g: number) => Promise<void>,
  incrementGeneration: () => Promise<number>,
  getValueGeneration: (k: StoreKey) => Promise<number>,
  testAndTouchKey: (k: StoreKey) => Promise<boolean>,
  setValue: (k: StoreKey, v: StoreValue) => Promise<void>,
  setReference: (k: StoreKey, index: number | null, name: string | null, target: StoreKey) => Promise<void>,
  setTag: (tag: string, v: StoreKey) => Promise<void>,
  commit: () => Promise<void>,
  collectGarbage: () => Promise<boolean>
}

export type Store = ReadStore & WriteStore

export function readStore (s: Store): ReadStore {
  let {
    getValue,
    getReferenceByIndex,
    getReferenceByName,
    getTag,
    getTags,
    getTagsBetween
  } = s
  return {
    getValue,
    getReferenceByIndex,
    getReferenceByName,
    getTag,
    getTags,
    getTagsBetween
  }
}

export function writeStore (s: Store): WriteStore {
  let {
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
  } = s
  return {
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
