/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { RangeList, mkrange } from "./ds/range-list.js";
import { HashMap } from "./ds/map.js";
import { MultiClock } from "./strat/multi-clock.js";

// An approximate LFU cache for arbitary (key, value) pairs.
export class LfuCache {
  constructor(id, capacity) {
    this.id = id;
    this.cache = new MultiClock({
      cap: capacity,
      store: () => new HashMap(),
    });
  }

  get(key) {
    return this.cache.val(key) || false;
  }

  put(key, val) {
    return this.cache.put(key, val);
  }
}

// An approximate LFU cache for (integer-range, value) pairs.
export class RangeLfu {
  constructor(id, capacity) {
    // delete, set, get in skip-lists tend towards O(log n)
    // and so, higher the n, the lesser the performance hit.
    // For ex, a skip-list with 512 elements on average may
    // iterate through 9 elements = ln(512); and 'just' 18
    // iterations can search through 262144 elements. That
    // is, larger skip-lists perform better than numerous
    // (sharded) smaller skip-lists, and so: here, per clock
    // capacity (= shardsize * handsperclock), is a function
    // of the user requested capacity itself. Each clock is
    // backed by exactly one skip-list, which means it is of
    // the exact same capacity as the clock that contains it.
    const handsperclock = Math.max(2, log2(capacity));
    const shardsize = 256;
    const sklevel = log2(shardsize * handsperclock);

    this.id = id;
    this.cache = new MultiClock({
      cap: capacity,
      slotsperhand: shardsize,
      handsperclock: handsperclock,
      store: () => new RangeList(sklevel),
    });
  }

  get(n) {
    return this.cache.val(mkrange(n, n)) || false;
  }

  put(lo, hi, val) {
    return this.cache.put(mkrange(lo, hi), val);
  }
}

function log2(n) {
  return Math.floor(Math.log2(n));
}
