/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const minlives = 1 << 0; // 1
const maxlives = 1 << 14; // 16,384
const mincap = 1 << 5; // 32
const maxcap = 1 << 30; // 1,073,741,824
const minslots = 1 << 1; // 2

// Clock implements a LFU-like cache with "clock-hands" that sweep
// just the once over a ring-buffer to find a slot for an entry (key,
// value). As these hands sweep, they either countdown the lifetime
// of the slot (denoted by a number between 1 to #maxcount) or
// remove it if it is dead (null or count = 0). On a re-insertion
// (same key, any value), the entry's lifetime incremented, its value
// overriden. Lifetime increments with every cache-hit, as well.
//
// The hands sweep the ring independent of one another, while the
// choice of which hand should sweep the ring is made at random.
// This implementation spawns 1 hand per 256 slots, with a minimum
// of at least 2 hands (for ex, total cache capacity <= 512).
//
// refs:
// www-inst.eecs.berkeley.edu/~cs266/sp10/readings/smith78.pdf (page 11)
// power-of-k lru: news.ycombinator.com/item?id=19188642
export class Clock {
  constructor(cap, slotsperhand = 256, maxlife = 16, store) {
    if (store == null) throw new Error("missing underlying store");

    cap = this.bound(cap, mincap, maxcap);
    this.capacity = 2 ** Math.round(Math.log2(cap)); // always power-of-2
    slotsperhand = 2 ** Math.round(Math.log2(slotsperhand));
    // a ring buffer
    this.rb = new Array(this.capacity);
    // cache backed by this store
    this.store = store;

    // maxlives per cached kv entry
    this.maxcount = this.bound(maxlife, minlives, maxlives);
    // limit worst-case slot sweeps per-hand to a constant )
    this.totalhands = Math.max(
      minslots,
      Math.round(this.capacity / slotsperhand)
    );
    this.slotsperhand = this.capacity / this.totalhands;

    // k-hands for power-of-k admissions
    this.hands = new Array(this.totalhands);
    this.hands.fill(0);
  }

  next(n) {
    const base = n * this.slotsperhand;
    return base + ((this.hands[n] + 1) % this.slotsperhand);
  }

  cur(n) {
    const base = n * this.slotsperhand;
    return base + (this.hands[n] % this.slotsperhand);
  }

  prev(n) {
    const b = n * this.slotsperhand;
    return b + ((this.slotsperhand + this.hands[n] - 1) % this.slotsperhand);
  }

  bound(i, min, max) {
    // min inclusive, max exclusive
    i = i < min ? min : i;
    i = i >= max ? max - 1 : i;
    return i;
  }

  head(n) {
    n = this.bound(n, 0, this.totalhands);
    return this.cur(n);
  }

  incrHead(n) {
    n = this.bound(n, 0, this.totalhands);
    this.hands[n] = this.next(n);
    return this.hands[n];
  }

  decrHead(n) {
    n = this.bound(n, 0, this.totalhands);
    this.hands[n] = this.prev(n);
    return this.hands[n];
  }

  size() {
    return this.store.size();
  }

  evict(n, c) {
    logd("evict start, head/num/size", this.head(n), n, this.size());
    const start = this.head(n);
    let h = start;
    // countdown lifetime of alive slots as rb is sweeped for a dead slot
    do {
      const entry = this.rb[h];
      if (entry == null) return true; // empty slot

      entry.count -= c; // age down this slot
      if (entry.count <= 0) {
        logd("evict", h, entry);
        this.store.delete(entry.key); // evict if slot dead
        this.rb[h] = null;
        return true; // slot at hands[n] is free
      }
      h = this.incrHead(n);
    } while (h !== start); // one sweep complete

    return false; // no free slot
  }

  put(k, v, c = 1) {
    // do not store null k/v
    if (k == null || v == null) return false;

    const cached = this.store.get(k);
    if (cached != null) {
      // update cached entry
      cached.value = v;
      this.boost(cached.pos, c);
      return true;
    }

    const num = this.rolldice; // choose hand
    this.evict(num, c);
    const h = this.head(num); // current free slot at head
    const hasSlot = this.rb[h] == null;

    if (!hasSlot) return false;

    this.rb[h] = this.mkfreq(k, c);
    this.store.set(k, this.mkvalue(v, h));

    this.incrHead(num);
    return true;
  }

  val(k, c = 1) {
    const r = this.store.get(k);
    if (r == null) return null;

    logd("hit:", r.pos, "val:", r.value);

    this.boost(r.pos, c);
    return r.value;
  }

  boost(pos, amp = 0) {
    const me = this.rb[pos];
    me.count = Math.min(me.count + amp, this.maxcount);
  }

  get rolldice() {
    const max = this.totalhands; // exclusive
    const min = 0; // inclusive
    return Math.floor(Math.random() * (max - min)) + min;
  }

  mkfreq(k, c) {
    return { key: k, count: Math.min(c, this.maxcount) };
  }

  mkvalue(v, i) {
    return { value: v, pos: i };
  }
}

function logd(...rest) {
  const debug = false;
  if (debug) console.debug("Clock", ...rest);
}
