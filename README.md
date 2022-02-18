Least Frequently Used cache implementations.

`/strat` contains an approximate implementation of the _Clock_ algorithm, which increments
frequency on cache-hits and decrements frequency of items in the same 'clock' where a newer
entry seeks admission into, which helps avoid starvation.

`/ds` contains implementations of underlying stores supporting the cache: A `HashMap` backed
by the native `Map`, and a restrictive `RangeList` backed by a Skip List.

That is, `Clock.js` or `MultiClock.js` instances can be backed by either `HashMap` for point
queries, or by `RangeList` for range queries.

`lfu.js` serves as the entrypoint to construct and interact with these LFUs.

```js
  const lfu = new LfuCache("L1", 10)
  lfu.put(1, "a") // 1 -> "a"
  const v = lfu.get("a") // v = "a"

  const rgcache = new RangeLfu("R1", 10)
  rgcache.put(1, 10, "a") // (1, 10) -> "a"
  const v = rgcache.get(5) // v = "a"
````
