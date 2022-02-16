/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Clock } from "./clock.js";

const opts = {
  cap: 64,
  handsperclock: 2,
  slotsperhand: 256,
  maxlife: 32,
  store: null,
};

// Manages multiple Clocks that expand in size upto to total capacity.
export class MultiClock {
  constructor(overrides) {
    Object.assign(opts, overrides);

    if (opts.store == null) throw new Error("missing underlying store");

    this.slotsperhand = opts.slotsperhand; // must be power-of-2
    this.handsperclock = opts.handsperclock;
    this.maxlife = opts.maxlife;
    this.clockcap = this.slotsperhand * this.handsperclock;
    this.totalcap = 2 ** Math.round(Math.log2(opts.cap)); // power-of-2
    this.totalclocks = Math.round(this.totalcap / this.clockcap);

    this.clocks = [];
    this.idx = [];
    this.store = opts.store();

    this.expand();

    logd("sz", this.totalcap, "n", this.totalclocks, "l", this.clockcap);
  }

  iterlimit() {
    if (this.expandable()) {
      return Math.ceil(this.totalclocks * 0.1);
    } else {
      return Math.ceil(this.totalclocks * 0.05);
    }
  }

  expandable() {
    return this.size < this.totalclocks;
  }

  expand() {
    if (!this.expandable()) {
      logd("cannot expand further, size:", this.size);
      return null;
    }
    const x = this.mkclock();
    this.clocks.push(x);
    this.idx.push(this.size - 1);
    return x;
  }

  mkclock() {
    return new Clock(
      this.clockcap,
      this.slotsperhand,
      this.maxlife,
      this.store
    );
  }

  get size() {
    return this.clocks.length;
  }

  val(k, c = 1) {
    const [v, _] = this.xval(k, c);
    return v;
  }

  xval(k, c = 1) {
    let v = null;
    let clockidx = -1;
    // invalid key (k)
    if (k == null) return [v, clockidx];

    // change iteration order for variance
    this.shuffle();
    for (const i of this.idx) {
      const x = this.clocks[i];
      v = x.val(k, c);
      if (v != null) {
        clockidx = i;
        break;
      } // else: continue search
    }

    return [v, clockidx];
  }

  put(k, v, c = 1) {
    if (k == null || v == null) return false;

    // key (k) already cached, update value (v) with life (c)
    const [_, clockidx] = this.xval(k, 0);
    if (clockidx >= 0) {
      const x = this.clocks[clockidx];
      return x.put(k, v, c);
    }

    // reduce life of cached-items iff no expansion is possible
    // that is, find an empty slot without aging cached-items
    const down = this.expandable() ? 0 : c;
    const limit = this.iterlimit();
    // put value (v) in an empty slot, if any, in existing clocks
    for (const i of this.idx) {
      const x = this.clocks[i];
      const ok = x.put(k, v, down);
      // down may be 0, so if put succeeds, reinstate orig (c)
      if (ok && c !== down) {
        x.val(k, c);
        return true;
      }
      // do not sweep any more clocks for a slot
      if (i >= limit) break;
    }

    // make a new clock, and put value (v) with life (c)
    const x = this.expand();
    if (x != null) {
      return x.put(k, v, c);
    }

    return false;
  }

  // stackoverflow.com/a/12646864
  shuffle(odds = 2) {
    if (!this.yes(odds)) return;

    for (let i = this.idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = this.idx[i];
      this.idx[i] = this.idx[j];
      this.idx[j] = swap;
    }
  }

  yes(when) {
    const yes = true;
    const no = false;
    const len = when;

    const max = len + 1; // exclusive
    const min = 1; // inclusive
    const rand = Math.floor(Math.random() * (max - min)) + min;

    return rand % len === 0 ? yes : no;
  }
}

function logd(...rest) {
  const debug = false;
  if (debug) console.debug("MultiClock", ...rest);
}
