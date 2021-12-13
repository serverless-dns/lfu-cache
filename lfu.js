/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class LfuCache {
  constructor(id, capacity) {
    this.id = id;
    this.cache = new Clock(capacity);
  }

  Get(key) {
    let val = false;
    try {
      val = this.cache.val(key) || false;
    } catch (e) {
      console.log("Error: " + this.id + " -> Get");
      console.log(e.stack);
    }
    return val;
  }

  Put(key, val) {
    try {
      this.cache.put(key, val);
    } catch (e) {
      console.log("Error: " + this.id + " -> Put");
      console.log(e.stack);
    }
  }
}
