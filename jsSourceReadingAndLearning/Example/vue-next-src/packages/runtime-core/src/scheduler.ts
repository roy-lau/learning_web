import { ErrorCodes, callWithErrorHandling } from './errorHandling'
import { isArray } from '@vue/shared'

const queue: Function[] = []
const postFlushCbs: Function[] = []
const p = Promise.resolve() // 参考 https://developer.mozilla.org/zh-CN/docs/Web/JavaScript/Reference/Global_Objects/Promise/resolve

let isFlushing = false
/**
 * 异步 Promise 函数
 * @param  {()=> void}        fn 传入函数回调
 * @return {Promise<void>}    返回 Promise
 *
 * 如果传入了回调函数，返回 Promise.resolve().then(fn)
 * 如果未传入了回调函数，返回静态 Promise.resolve()
 *
 */
export function nextTick(fn?: () => void): Promise<void> {
  return fn ? p.then(fn) : p
}

export function queueJob(job: () => void) {
  if (!queue.includes(job)) {
    queue.push(job)
    if (!isFlushing) {
      nextTick(flushJobs)
    }
  }
}

export function queuePostFlushCb(cb: Function | Function[]) {
  if (!isArray(cb)) {
    postFlushCbs.push(cb)
  } else {
    postFlushCbs.push(...cb)
  }

  if (!isFlushing) {
    nextTick(flushJobs)
  }
}

const dedupe = (cbs: Function[]): Function[] => [...new Set(cbs)]

export function flushPostFlushCbs() {
  if (postFlushCbs.length) {
    const cbs = dedupe(postFlushCbs)
    postFlushCbs.length = 0
    for (let i = 0; i < cbs.length; i++) {
      cbs[i]()
    }
  }
}

const RECURSION_LIMIT = 100
type JobCountMap = Map<Function, number>

function flushJobs(seenJobs?: JobCountMap) {
  isFlushing = true
  let job
  if (__DEV__) {
    seenJobs = seenJobs || new Map()
  }
  while ((job = queue.shift())) {
    if (__DEV__) {
      const seen = seenJobs!
      if (!seen.has(job)) {
        seen.set(job, 1)
      } else {
        const count = seen.get(job)!
        if (count > RECURSION_LIMIT) {
          throw new Error(
            'Maximum recursive updates exceeded. ' +
              "You may have code that is mutating state in your component's " +
              'render function or updated hook.'
          )
        } else {
          seen.set(job, count + 1)
        }
      }
    }
    callWithErrorHandling(job, null, ErrorCodes.SCHEDULER)
  }
  flushPostFlushCbs()
  isFlushing = false
  // some postFlushCb queued jobs!
  // keep flushing until it drains.
  if (queue.length) {
    flushJobs(seenJobs)
  }
}
