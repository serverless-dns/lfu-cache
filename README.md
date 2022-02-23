Least Frequently Used cache implementations.

`/strat` contains an approximate implementation of the _Clock_ algorithm, which increments
frequency on cache-hits and decrements frequency of items in the same 'clock' where a newer
entry seeks admission into, which helps avoid starvation. Another algorithm, _O1_ implements
a constant-time LFU, but the flip side is it consumes a bit extra memory compared to _Clock_
but is much simpler to reason about.

`/ds` contains implementations of underlying stores supporting the cache: A `HashMap` backed
by the native `Map`, and a restrictive `RangeList` backed by a Skip List.

That is, `Clock.js`, `MultiClock.js`, `O1.js` instances can be backed by either `HashMap`
for point queries, or by `RangeList` for range queries.

`lfu.js` serves as the entrypoint to construct and interact with these LFUs.

```js
  import { LfuCache, RangeLfu } from "@serverless-dns/lfu.js";

  const lfu = new LfuCache("L1", 10)
  lfu.put(1, "a") // 1 -> "a"
  const v = lfu.get("a") // v = "a"

  const rgcache = new RangeLfu("R1", 10)
  rgcache.put(1, 10, "a") // (1, 10) -> "a"
  const v = rgcache.get(5) // v = "a"
````
