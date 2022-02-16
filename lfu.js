/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { RangeList, mkrange } from "./ds/range-list.js"
import { HashMap } from "./ds/map.js"
import { MultiClock } from "./strat/multi-clock.js"

// An approximate LFU cache
export class LfuCache {
  constructor(id, capacity) {
    this.id = id
    this.cache = new MultiClock({
      cap: capacity,
      store: () => new HashMap(),
    })
  }

  Get(key) {
    return this.cache.val(key) || false
  }

  Put(key, val) {
    return this.cache.put(key, val)
  }
}

export class RangeLfu {
  constructor(id, capacity) {
    this.id = id
    this.cache = new MultiClock({
      cap: capacity,
      store: () => new RangeList(log2(capacity)),
    })
  }

  Get(n) {
    return this.cache.val(n) || false
  }

  Put(lo, hi, val) {
    return this.cache.put(mkrange(lo, hi), val)
  }
}

function log2(n) {
  return Math.floor(Math.log2(n));
}
