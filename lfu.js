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
    const shardsize = 256;
    const sklevel = log2(shardsize);

    this.id = id;
    this.cache = new MultiClock({
      cap: capacity,
      slotsperhand: shardsize,
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
