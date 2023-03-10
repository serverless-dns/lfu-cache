/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

const minfreq = 1 << 2; // 4
const maxfreq = 1 << 7; // 128
const mincap = 1 << 5; // 32
const maxcap = 1 << 30; // 1,073,741,824

function defaults() {
  return {
    cap: mincap,
    freq: minfreq,
    store: null,
  };
}

// O1 roughly impls an O(1) LFU as described in arxiv.org/pdf/2110.11602.pdf
// Reminiscent of S4LRU but with var no of LRUs "freqslots" (not limited to 4)
// news.ycombinator.com/item?id=7692622
export class O1 {
  constructor(overrides) {
    const opts = Object.assign(defaults(), overrides);

    if (opts.store == null) throw new Error("missing store");

    // max entries in the cache
    this.capacity = this.bound(opts.cap, mincap, maxcap);
    // max no. of freqslots
    this.maxfrequency = this.bound(opts.freq, minfreq, maxfreq);
    // stores cached values
    const sklevel = log2(this.capacity);
    this.store = opts.store(sklevel);
    // tracks all cached entries of a particular age in a doubly linked-list
    this.freqslots = this.mkfreqslots();

    logd("created with cap", this.capacity, "freq", this.maxfrequency);
  }

  // put sets value v against key k with frequency f
  put(k, v, f = 1) {
    const cached = this.store.get(k);
    if (cached) {
      logd("put; cached-entry", k, "freq", cached.freq);
      // freq of an entry can be well beyond maxfrequency
      cached.freq += f;
      cached.value = v;
      this.move(cached.freq, cached.node);
      return true;
    }

    // cache at capacity, evict youngest cached entry, age down others
    if (this.store.size() >= this.capacity) {
      // iterate from youngest to oldest freqslot queues
      for (let i = 2; i < this.maxfrequency; i++) {
        const demote = this.pop(i);
        // age down the youngest in all freqslot queues
        if (demote) this.push(i - f, demote);
      }
      const youngest = this.pop(0);

      logd("at capacity, evict", youngest);
      // nothing to evict, no capacity to execute this put
      if (youngest == null) return false;
      // evict the most youngest cache entry
      this.store.delete(youngest.key);
    }

    logd("put; new-entry", k, "freq", f);
    const node = this.push(f, mknode(k));
    this.store.set(k, mkentry(node, v, f));
    return true;
  }

  // val gets cached entry by key k, if any; increments its freq by f
  val(k, f = 1) {
    const entry = this.store.get(k);
    if (entry) {
      logd("cache-hit; cached-entry:", k, "freq:", entry.freq);
      entry.freq += f;
      this.move(entry.freq, entry.node);
      return entry.value;
    }
    logd("cache-miss", k);
    return null;
  }

  // search searches for key k, starting at cursor it
  search(k, it, f = 1) {
    const cursor = it != null ? it.cursor : null;
    const res = this.store.search(k, cursor);
    const ans = res[0];
    const cur = res[1];
    if (ans) {
      const entry = ans.value;
      logd("search-hit; key:", k, "freq:", entry.freq);
      entry.freq += f;
      this.move(entry.freq, entry.node);
      return mkcursor(cur, entry.value);
    }
    logd("search-miss", k);
    return mkcursor(cur, null);
  }

  size() {
    return this.store.size();
  }

  // moves node from its current freqslot queue to the front of freqslot, f
  move(f, node) {
    this.delink(node);
    const c = this.bound(f - 1, 0, this.maxfrequency);
    const q = this.freqslots[c];
    return this.link(q, node);
  }

  // push adds node to the front of freqslot queue, f
  push(f, node) {
    const c = this.bound(f - 1, 0, this.maxfrequency);
    // c may be equal to f, in that case, node is moved to the front
    const q = this.freqslots[c];
    return this.link(q, node);
  }

  // pop removes node from the tail of freqslot queue, f
  pop(f) {
    const c = this.bound(f - 1, 0, this.maxfrequency);
    const q = this.freqslots[c];
    const lastnode = q.tail.prev;
    // tail points to head, ie zero nodes
    if (lastnode === q.head) return null;
    return this.delink(lastnode);
  }

  // deletes node from its current freqslot queue
  delink(node) {
    if (q.head === node || q.tail === node) return null;
    node.next.prev = node.prev;
    node.prev.next = node.next;
    node.next = null;
    node.prev = null;
    return node;
  }

  // inserts node to the head of the freqslot queue, q
  link(q, node) {
    node.prev = q.head;
    node.next = q.head.next;
    q.head.next.prev = node;
    q.head.next = node;
    return node;
  }

  // mkfreqdll makes a doubly linked list for freqslot queues
  mkfreqdll() {
    const h = mkhead();
    const t = mktail();
    h.prev = t;
    h.next = t;
    t.prev = h;
    t.next = h;
    return { head: h, tail: t };
  }

  // mkfreqslots makes maxfrequency number of freqslot queues
  mkfreqslots() {
    const slots = new Array(this.maxfrequency);
    for (let i = 0; i < this.maxfrequency; i++) {
      slots[i] = this.mkfreqdll();
    }
    return slots;
  }

  // bound clamps n within [min, max)
  bound(n, min, max) {
    if (n < min) return min;
    if (n >= max) return max - 1;
    return n;
  }
}

function mkhead() {
  return mknode("head");
}

function mktail() {
  return mknode("tail");
}

function mknode(k) {
  return {
    next: null,
    prev: null,
    key: k,
  };
}

function mkentry(n, v, f) {
  return {
    node: n,
    value: v,
    freq: f,
  };
}

function mkcursor(snode, value) {
  return {
    value: value, // may be null
    cursor: snode, // never null
  };
}

function log2(n) {
  return Math.round(Math.log2(n));
}

function logd(...rest) {
  const debug = false;
  if (debug) console.debug("O1", ...rest);
}
