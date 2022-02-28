/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { LfuCache, RangeLfu, ClockLfu, RangeClockLfu } from "../lfu.js";

const size = 32;
const iter = (size * 1.5) | 0;
const idclock = "Clock";
const ido1 = "O1";

(async (main) => {
  const tag = "LfuTestMain";
  const t1 = Date.now();
  console.log(tag, t1, "begin");

  const out = await Promise.allSettled([
    lfuCacheTest(idclock, ClockLfu, size),
    lfuCacheTest(ido1, LfuCache, size),
    rangeLfuTest(idclock, RangeClockLfu, size),
    rangeLfuTest(ido1, RangeLfu, size),
  ]);
  const t2 = Date.now();

  console.log(tag, "outputs", out);
  console.log(tag, t2, "end", t2 - t1 + "ms");
})();

async function lfuCacheTest(id, Variant, size) {
  const tag = "LfuCacheTest/" + id;
  const isclock = id === idclock;

  console.log(tag, "---ack---");

  const c1 = new Variant(tag, size);
  for (let i = 0; i < iter; i++) {
    c1.put(i, "v" + i);
  }

  // test: no-such-key
  const falsyvalue = c1.get("nosuchkey");
  console.assert(!falsyvalue);

  // test: cached-key
  const key1 = iter - 1;
  const value1 = c1.get(key1);
  console.log(tag, "cached", "k:", key1, "v:", value1);
  console.assert(value1 != null);

  // test: evicted-key
  const key2 = 1;
  const value2 = c1.get(key2);
  console.log(tag, "evicted", "k:", key2, "v:", value2);
  // clock does randomized evictions
  if (!isclock) console.assert(!value2);

  console.log(tag, "---fin---");

  return tag + ":done";
}

async function rangeLfuTest(id, Variant, size) {
  const tag = "RangeLfuTest/" + id;
  const isclock = id === idclock;

  console.log(tag, "---ack---");

  const c = new Variant(tag, size);
  for (let i = 0; i < iter; i++) {
    c.put(i, i, "v" + i);
  }

  // test: no-such-key
  const nosuchkey = iter << 1;
  const falsyvalue = c.get(nosuchkey);
  console.assert(!falsyvalue);

  // test: cached-key
  const key1 = iter >> 1;
  const value1 = c.get(key1);
  console.log(tag, "cached", "k:", key1, "v:", value1);
  console.assert(value1 != null);

  // test: evicted-key
  const key2 = (iter * 0.1) | 0;
  const value2 = c.get(key2);
  console.log(tag, "evicted", "k:", key2, "v:", value2);
  // clock does randomized evictions
  if (!isclock) console.assert(!value2);

  const key3 = (iter >> 1) - 1;
  const cursor1 = c.find(key3, null);
  const key4 = (iter >> 2) + 1;
  const cursor2 = c.find(key4, cursor1);
  const key5 = iter - 1;
  const cursor3 = c.find(key5, cursor1);
  const cursor4 = c.find(key5, cursor2);
  const cursor5 = c.find(key5, null);
  console.log(tag, "find1", key3, "->", key5, "cursor:", cursor3.value);
  console.log(tag, "find2", key4, "->", key5, "cursor:", cursor4.value);
  console.log(tag, "find3", 0, "->", key5, "cursor:", cursor5.value);
  console.assert(cursor5.value === cursor4.value);
  console.assert(cursor5.value === cursor3.value);

  console.log(tag, "---fin---");

  return tag + ":done";
}
