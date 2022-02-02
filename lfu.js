/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
import { MultiClock } from "./multi-clock.js"

// An approximate LFU cache
export class LfuCache {
  constructor(id, capacity) {
    this.id = id
    this.cache = new MultiClock(capacity)
  }

  Get(key) {
    return this.cache.val(key) || false
  }

  Put(key, val) {
    return this.cache.put(key, val)
  }
}

