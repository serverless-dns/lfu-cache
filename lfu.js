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
import { O1 } from "./strat/o1.js";

// A constant-time LFU cache for arbitary (key, value) pairs.
export class LfuCache {
  constructor(id, capacity) {
    this.id = id;
    this.cache = new O1({
      cap: capacity,
      freq: 16,
      store: () => new HashMap(),
    });
  }

  get(key, freq = 1) {
    return this.cache.val(key, freq) || false;
  }

  put(key, val, freq = 1) {
    return this.cache.put(key, val, freq);
  }

  find(n, cursor, freq = 1) {
    return this.cache.search(n, cursor, freq);
  }
}

// An approximate LFU cache for arbitary (key, value) pairs.
export class ClockLfu {
  constructor(id, capacity) {
    this.id = id;
    this.cache = new MultiClock({
      cap: capacity,
      store: () => new HashMap(),
    });
  }

  get(key, freq = 1) {
    return this.cache.val(key, freq) || false;
  }

  put(key, val, freq = 1) {
    return this.cache.put(key, val, freq);
  }

  find(n, cursor, freq = 1) {
    return this.cache.search(n, cursor, freq);
  }
}

// A constant-time LFU cache for arbitary (key, value) pairs.
export class RangeLfu {
  constructor(id, capacity) {
    this.id = id;
    const sklevel = log2(capacity);

    this.cache = new O1({
      cap: capacity,
      freq: 16,
      store: () => new RangeList(sklevel),
    });
  }

  get(n, freq = 1) {
    return this.cache.val(mkrange(n, n), freq) || false;
  }

  put(lo, hi, val, freq = 1) {
    return this.cache.put(mkrange(lo, hi), val, freq);
  }

  find(n, cursor, freq = 1) {
    return this.cache.search(mkrange(n, n), cursor, freq);
  }
}

// An approximate LFU cache for (integer-range, value) pairs.
export class RangeClockLfu {
  constructor(id, capacity) {
    // delete, set, get in skip-lists tend towards O(log n)
    // and so, higher the n, the lesser the performance hit.
    // For ex, a skip-list with 512 elements on average may
    // iterate through 9 elements = ln(512); and 'just' 18
    // iterations can search through 262144 elements. That
    // is, larger skip-lists perform better than numerous
    // (sharded) smaller skip-lists, and so: here, per clock
    // capacity (slotsperclock * handsperclock) is propotional
    // to user requested capacity itself. Each clock is backed
    // by exactly one skip-list, which means it is of the exact
    // same capacity as the Clock that contains it.
    const sklevel = log2(capacity);

    this.id = id;
    this.cache = new MultiClock({
      cap: capacity,
      store: () => new RangeList(sklevel),
    });
  }

  get(n, freq = 1) {
    return this.cache.val(mkrange(n, n), freq) || false;
  }

  put(lo, hi, val, freq = 1) {
    return this.cache.put(mkrange(lo, hi), val, freq);
  }

  find(n, cursor, freq = 1) {
    return this.cache.search(mkrange(n, n), cursor, freq);
  }
}

function log2(n) {
  return Math.round(Math.log2(n));
}
