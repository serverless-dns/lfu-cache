/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// RangeList stores values against integer-ranges (low, high). It implements
// a skip-list to store the incoming ranges in a sorted order. The ranges
// to be inserted must not overlap with any existing ranges: That is,
// inserting (5, 15) or (7, 9) in a list with (1, 10) already in it,
// is an illegal, unsupported operation. Ranges can be of arbitary spawns,
// though, the min and max supported values are governed by
// Number.MIN_SAFE_INTEGER + 2 and Number.MAX_SAFE_INTEGER - 2.
// ref: archive.is/nl3G8 (impl) and archive.is/ffCDr (analysis)
export class RangeList {
  constructor(maxlevel = 16) {
    this.init();
    this.maxlevel = maxlevel;

    // if this.maxlevel = 16 (0x10), then:
    // maxlevel = 0x8000 or 0b1000_0000_0000 (= 2**15)
    // bitmask => 0x4000 or 0b0100_0000_0000 (= 2**14)
    this.maxflips = Math.pow(2, this.maxlevel - 1);
    this.bitmask = Math.pow(2, this.maxlevel - 2);

    logd("lvl", this.maxlevel, "h/t", this.head.range, this.tail.range);
  }

  init() {
    this.head = this.mkhead();
    this.tail = this.mktail();

    this.head.next[0] = this.tail;
    this.head.prev[0] = this.tail;
    this.tail.next[0] = this.head;
    this.tail.prev[0] = this.head;

    this.level = 0;
    this.length = 0;
  }

  // FIXME: reject overlapping ranges
  set(range, aux) {
    const node = mknode(range, aux);
    const lr = this.randomLevel();
    let cur = this.head;
    const slots = [];
    // find slots at all levels to fit the incoming node in
    for (let i = this.level, j = 0; i >= 0; i--, j++) {
      // stop before the first slot greater than node.range
      while (lowl(cur.next[i], node)) cur = cur.next[i];

      slots[j] = cur;
    }

    logd("set lr/node/slots:", lr, node, slots);

    for (let i = slots.length - 1, j = 0; i >= 0; i--, j++) {
      // ignore slots greater than the incoming node's level
      // as they can't be linked as a predecessor to it
      if (i > lr) continue;

      const predecessor = slots[j];
      const successor = slots[j].next[i];
      node.next[i] = successor;
      node.prev[i] = predecessor;
      predecessor.next[i] = node;
      successor.prev[i] = node;
    }

    // when the incoming node's level is greater than the skip-list's level,
    // slot it between head and tail, then increment skip-list's level
    for (let i = slots.length; i <= lr; i++) {
      node.prev[i] = this.head;
      node.next[i] = this.tail;
      this.head.next[i] = node;
      this.tail.prev[i] = node;
      this.level += 1;
    }

    this.length += 1;
  }

  // get gets the value stored against an integer range (lo, hi)
  get(range) {
    const d = this.xget(range.lo);
    if (d && d.value) return d.value;
    return null;
  }

  // xget gets the skip-list node that has integer 'n' in its range
  xget(n) {
    let i = this.level;
    // exclude head from search
    let node = this.head;
    while (i >= 0 && node !== this.tail) {
      const cur = node.next[i];
      const eq = nodeContainsN(cur, n);
      const lt = nodeLessThanN(cur, n);
      const gt = nodeGreaterThanN(cur, n);

      logd("get i/n/cur/<w>/lt/gt", i, n, cur, eq, lt, gt);

      if (eq) {
        // cur is the ans, if it is not the tail node
        // exclude tail, not a valid search result
        return cur === this.tail ? null : cur;
      } else if (lt) {
        // for the next iteration, lookup siblings of cur
        node = cur;
      } else if (gt) {
        // for the next iteration, lookup siblings of node
        i -= 1;
      } else {
        throw new Error("get fail: is n a number?", n);
      }
    }

    return null;
  }

  delete(range) {
    const node = this.xget(range.lo);
    if (node == null) return false;

    // delete node from all its levels
    for (let i = 0; i < node.next.length; i++) {
      const predecessor = node.prev[i];
      const successor = node.next[i];
      predecessor.next[i] = successor;
      successor.prev[i] = predecessor;
    }

    this.length -= 1;

    return true;
  }

  entries() {
    const kv = [];

    let x = this.head.next[0];
    while (x !== this.tail) {
      kv.push(x);
      x = x.next[0];
    }

    return kv;
  }

  size() {
    return this.length;
  }

  clear() {
    this.init();
  }

  mkhead() {
    const minr = mkrange(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER + 1);
    return mknode(minr, "head");
  }

  mktail() {
    const maxr = mkrange(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER);
    return mknode(maxr, "tail");
  }

  // faster coinflips from ticki.github.io/blog/skip-lists-done-right
  randomLevel() {
    // TODO: Math.trunc instead of Math.floor?
    // probability(c) heads (ex: c=4 => hhhh) is given by 1/(2**c)
    // coinflips => (0, maxflips]; 0 inclusive, maxflips exclusive
    let coinflips = Math.floor(Math.random() * this.maxflips);
    let level = 0;
    do {
      // msb more random than lsb;
      // github.com/ocaml/ocaml/blob/389121d3/runtime/lf_skiplist.c#L86
      const msbset = (coinflips & this.bitmask) === this.bitmask;
      if (!msbset) break;
      level += 1;
      // truncate coinflips to one les than bitmask bits
      coinflips = coinflips & (this.bitmask - 1);
      // bitwise ops, ex: coinflips << 1, are limited to int32 range,
      // using them will cause overflow when this.maxlevel > 30
      coinflips *= 2;
    } while (coinflips > 0);

    return level;
  }
}

export function mkrange(lo, hi) {
  return {
    lo: lo,
    hi: hi,
  };
}

function lowl(left, right) {
  return left.range.hi < right.range.lo;
}

function mknode(range, data) {
  return {
    range: range,
    value: data,
    next: [],
    prev: [],
  };
}

function nodeContainsN(node, n) {
  return n <= node.range.hi && n >= node.range.lo;
}

function nodeGreaterThanN(node, n) {
  return node.range.hi > n;
}

function nodeLessThanN(node, n) {
  return node.range.hi < n;
}

function logd(...rest) {
  const debug = false;
  if (debug) console.debug("RangeList", ...rest);
}
