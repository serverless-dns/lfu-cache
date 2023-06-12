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

/**
 * A constant-time LFU cache for arbitary (key, value) pairs.
 * @implements {LfuBase<K, V>}
 */
export class LfuCache {
  constructor(id, capacity) {
    /** @type {string} */
    this.id = id;
    /** @type {O1<string, HashMap<string, any>>} */
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

  find(k, cursor, freq = 1) {
    const [c, v] = this.cache.search(k, cursor, freq);
    return new Result(c, v);
  }
}

/**
 * An approximate LFU cache for arbitary (key, value) pairs.
 * @implements {LfuBase<K, V>}
 */
export class ClockLfu {
  constructor(id, capacity) {
    /** @type {string} */
    this.id = id;
    /** @type {MultiClock<string, HashMap<string, any>>} */
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

  find(k, cursor, freq = 1) {
    const [c, v] = this.cache.search(k, cursor, freq);
    return new Result(c, v);
  }
}

/**
 * A constant-time LFU cache for arbitary (key, value) pairs.
 * @implements {LfuBase<K, V>}
 */
export class RangeLfu {
  constructor(id, capacity) {
    /** @type {string} */
    this.id = id;
    /** @type {O1<K, RangeList<K, V>} */
    this.cache = new O1({
      cap: capacity,
      freq: 16,
      store: (lvl) => new RangeList(lvl),
    });
  }

  get(n, freq = 1) {
    return this.cache.val(mkrange(n, n), freq) || false;
  }

  put(lo, hi, val, freq = 1) {
    return this.cache.put(mkrange(lo, hi), val, freq);
  }

  find(k, cursor, freq = 1) {
    const [c, v] = this.cache.search(mkrange(k, k), cursor, freq);
    return new Result(c, v);
  }
}

/**
 * An approximate LFU cache for (integer-range, value) pairs.
 * @implements {LfuBase<K, V>}
 */
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
    /** @type {string} */
    this.id = id;
    /** @type {MultiClock<K, RangeList<K, V>>} */
    this.cache = new MultiClock({
      cap: capacity,
      store: (lvl) => new RangeList(lvl),
    });
  }

  get(n, freq = 1) {
    return this.cache.val(mkrange(n, n), freq) || false;
  }

  put(lo, hi, val, freq = 1) {
    return this.cache.put(mkrange(lo, hi), val, freq);
  }

  find(k, cursor, freq = 1) {
    const [c, v] = this.cache.search(mkrange(k, k), cursor, freq);
    return new Result(c, v);
  }
}

/**
 * Interface for LFU caches.
 * @interface
 * @template K, V
 */
class LfuBase {
  constructor(id, capacity) {
    /** @type {string} */
    this.id = id;
    /** @type {number} */
    this.capacity = capacity;
    /** @type {LfuBase<K, Store<K, V>>} */
    this.cache = null;
    throw new Error("absract");
  }

  /**
   * @param {K} k
   * @param {number} freq
   * @returns {V}
   */
  get(k, freq) {}

  /**
   * @param {K} k
   * @param {V} v
   * @param {number} freq
   * @returns {boolean}
   */
  put(k, v, freq) {}

  /**
   * @param {K} k
   * @param {any} cursor
   * @param {number} freq
   * @returns {Result<V>}
   */
  find(k, cursor, freq) {}
}

/**
 * @template V
 */
export class Result {
  constructor(c, v) {
    /** @type {any} */
    this.cursor = c; // never null
    /** @type {V?} */
    this.value = v; // may be null
  }
}
