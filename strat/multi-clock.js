/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { Clock } from "./clock.js";

function defaults() {
  return {
    cap: 64,
    maxlife: 32,
    maxsweep: 256,
    store: null,
  };
}

// Manages multiple Clocks that expand in size upto tototal capacity.
// Roughly, it is similar to, but not quite, a tiered vector of Clocks:
// www.cs.brown.edu/cgc/jdsl/papers/tiered-vector.pdf
export class MultiClock {
  constructor(overrides) {
    const opts = Object.assign(defaults(), overrides);

    if (opts.store == null) throw new Error("missing underlying store");

    this.totalclocks = Math.round(Math.log10(opts.cap));

    // opts.cap must be divisible by totalclocks
    opts.cap = multipleofn(opts.cap, this.totalclocks);
    // ccap must be divisible by 2
    const ccap = multipleofn(opts.cap / this.totalclocks, 2);
    // must be divisible by maxsweep
    const maxsweep = ccap > opts.maxsweep ? opts.maxsweep : ccap / 2;

    this.clockcap = multipleofn(ccap, maxsweep);
    this.totalcap = this.totalclocks * this.clockcap;
    this.handsperclock = Math.max(2, this.clockcap / maxsweep);
    this.maxlife = opts.maxlife;

    this.clocks = [];
    this.idx = [];
    this.store = opts.store;

    this.expand();

    logd("sz", this.totalcap, "n", this.totalclocks, "cc", this.clockcap);
  }

  expandable() {
    return this.length < this.totalclocks;
  }

  expand() {
    if (!this.expandable()) {
      logd("cannot expand further, size:", this.length);
      return null;
    }
    const x = this.mkclock();
    this.clocks.push(x);
    this.idx.push(this.length - 1);
    return x;
  }

  mkclock() {
    const sklevel = log2(this.clockcap);

    return new Clock(
      this.clockcap,
      this.slotsperhand,
      this.maxlife,
      this.store(sklevel)
    );
  }

  get length() {
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

  // search searches for key k, starting at cursor _
  search(k, _, c = 1) {
    const v = this.val(k, c);
    // cursor _ is unused in Clocks
    return [_, v];
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
    // put value (v) in an empty slot, if any, in existing clocks
    for (const i of this.idx) {
      const x = this.clocks[i];
      const ok = x.put(k, v, down);
      if (ok) {
        // down is 0, reinstate count (c)
        if (c !== down) x.val(k, c);
        return true;
      }
    }

    // make a new clock, and put value (v) with life (c)
    const x = this.expand();
    if (x != null) {
      return x.put(k, v, c);
    }

    return false;
  }

  size() {
    let s = 0;
    for (const c of this.clocks) {
      s += c.size();
    }
    return s;
  }

  entries() {
    let kv = [];
    for (const c of this.clocks) {
      kv = kv.concat(c.entries());
    }
    return kv;
  }

  // stackoverflow.com/a/12646864
  shuffle(odds = 5) {
    if (!this.yes(odds)) return;

    for (let i = this.idx.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const swap = this.idx[i];
      this.idx[i] = this.idx[j];
      this.idx[j] = swap;
    }
  }

  yes(when) {
    const y = true;
    const n = false;
    const len = when;

    const max = len + 1; // exclusive
    const min = 1; // inclusive
    const rand = Math.floor(Math.random() * (max - min)) + min;

    return rand % len === 0 ? y : n;
  }
}

function multipleofn(i, n) {
  return i + (n - (i % n));
}

function log2(n) {
  return Math.round(Math.log2(n));
}

function logd(...rest) {
  const debug = false;
  if (debug) console.debug("MultiClock", ...rest);
}
