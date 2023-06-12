/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/**
 * RangeList stores values against integer-ranges (low, high). Sorts
 * incoming ranges in a skip-list. The incoming ranges must not overlap
 * with any existing range already in the skip-list: That is, inserting
 * (5, 15) or (7, 9) in a list with (1, 10) already in it, is undefined,
 * operation. Ranges can be of arbitary spawns, with (min, max) =>
 * (Number.MIN_SAFE_INTEGER + 2, Number.MAX_SAFE_INTEGER - 2)
 * refs: archive.is/nl3G8 archive.is/ffCDr
 *
 * @implements {Store<K, V>}
 * @template K, V
 */
export class RangeList {
  constructor(maxlevel = 16) {
    /** @type {number} */
    this.maxlevel = Math.round(maxlevel);

    // threshold for iteration on searches
    /** @type {number} */
    this.maxiters = this.maxlevel ** 2;

    this.init();

    // if this.maxlevel = 16 (0x10), then:
    // maxflips = 0x8000 or 0b1000_0000_0000 (= 2**15)
    // bitmask => 0x4000 or 0b0100_0000_0000 (= 2**14)
    /** @type {number} */
    this.maxflips = Math.pow(2, this.maxlevel - 1);
    /** @type {number} */
    this.bitmask = Math.pow(2, this.maxlevel - 2);

    this.level = 0;
    this.len = 0;

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
    this.len = 0;

    // stats
    this.levelhisto = new Array(this.maxlevel);
    this.levelhisto.fill(0);
    this.iterhisto = [0];
    this.avgGetIter = 0;
  }

  /**
   * @param {Range} range
   * @param {V} aux
   * @param {boolean} selfcorrect
   * @returns {RangeList}
   */
  set(range, aux, selfcorrect = false) {
    // FIXME: reject overlapping ranges
    const node = new Node(range, aux);
    const lr = this.randomLevel(selfcorrect);
    let cur = this.head;
    const slots = [];
    // find slots at all levels to fit the incoming node in
    for (let i = this.level, j = 0; i >= 0; i--, j++) {
      // stop before the first slot greater than node.range
      while (cur.next[i].isLessThan(node)) cur = cur.next[i];

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

      this.levelhisto[i] += 1;
    }

    // when the incoming node's level is greater than the skip-list's level,
    // slot it between head and tail, then increment skip-list's level
    for (let i = slots.length; i <= lr; i++) {
      node.prev[i] = this.head;
      node.next[i] = this.tail;
      this.head.next[i] = node;
      // not needed given the current iteration order in xget never
      // goes from [ tail <==prev== head ] or [ tail ==next==> head ]
      // skip: this.head.prev[i] = tail
      // skip: this.tail.next[i] = head
      this.tail.prev[i] = node;
      this.level += 1;
      this.levelhisto[i] += 1;
    }

    this.len += 1;
    return this;
  }

  /**
   * get gets the value stored against an integer range (lo, hi)
   * @param {Range} range
   * @returns {V?}
   * @throws {Error} if maxiters is exceeded or if range is invalid
   */
  get(range) {
    const d = this.xget(range.lo, this.head);
    if (d[0] == null) return null;
    return d[0].value;
  }

  /**
   * search searches for key k, starting at cursor, cursornode
   * @param {Range} range
   * @param {Node<V>} cursornode
   * @returns {[V?, Node<V>]}
   * @throws {Error} if maxiters is exceeded or if range is invalid
   */
  search(range, cursornode) {
    const [node, cursor] = this.xget(range.lo, this.lca(cursornode, range.lo));
    if (node == null) return [null, cursor];
    else return [node.value, cursor];
  }

  /**
   * xget gets the skip-list node that has integer 'n' in its range
   * @param {number} n
   * @param {Node<V>} node
   * @returns {[Node<V>?, Node<V>]}
   * @throws {Error} if maxiters is exceeded or if n is not a number
   */
  xget(n, node) {
    let c = 0;
    let i = node.next.length - 1;
    while (i >= 0 && node !== this.tail) {
      if (c > this.maxiters) {
        throw new Error(`get fail: maxiters exceeded ${c}`);
      }
      c += 1;
      const cur = node.next[i];
      const eq = cur.contains(n);
      const lt = cur.lesser(n);
      const gt = cur.greater(n);

      logd("get node i/n/cur/<w>/lt/gt", node, i, n, cur, eq, lt, gt);

      if (eq) {
        // cur is the ans, if it is not the tail node
        // exclude tail, not a valid search result
        this.avgGetIter =
          this.avgGetIter > 0 ? Math.round((this.avgGetIter + c) / 2) : c;
        this.iterhisto[c] = (this.iterhisto[c] | 0) + 1;
        // returns [ans-node, iter-position]
        return cur === this.tail ? [null, node] : [cur, node];
      } else if (lt) {
        // for the next iteration, lookup siblings of cur
        node = cur;
      } else if (gt) {
        // for the next iteration, lookup siblings of node
        i -= 1;
      } else {
        throw new Error(`get fail: is n a number? ${n}`);
      }
    }

    // returns [ans-node, iter-position]
    return [null, node];
  }

  /**
   * @param {Range} range
   * @returns {boolean}
   */
  delete(range) {
    const res = this.xget(range.lo, this.head);
    const node = res[0];

    if (node == null) return false;

    // delete node from all its levels
    for (let i = 0; i < node.next.length; i++) {
      const predecessor = node.prev[i];
      const successor = node.next[i];
      predecessor.next[i] = successor;
      successor.prev[i] = predecessor;
    }

    this.len -= 1;

    return true;
  }

  /**
   * any lower common ancestor of node and n, a number;
   * such that node's range (lo, hi) is _immediately_ less than n
   * @param {Node<V>} node
   * @param {number} n
   * @returns {Node<V>}
   */
  lca(node, n) {
    let c = 0;
    // keep iterating backwards, till node.range is <= n
    do {
      if (node == null || c > this.maxiters) return this.head;
      if (node.lesser(n)) break;
      node = node.prev[node.prev.length - 1];
      c += 1;
    } while (node !== this.head);

    return node; // may be tail, in which case, there's no lca
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
    return this.len;
  }

  clear() {
    this.init();
  }

  stats() {
    return `length: ${this.len},
      level: ${this.level},
      maxflips: ${this.maxflips},
      maxiters: ${this.maxiters},
      avgGetIter: ${this.avgGetIter},
      iterhisto: ${this.iterhisto},
      levelhisto: ${this.levelhisto}`;
  }

  mkhead() {
    const minr = mkrange(Number.MIN_SAFE_INTEGER, Number.MIN_SAFE_INTEGER + 1);
    return new Node(minr, "__head__");
  }

  mktail() {
    const maxr = mkrange(Number.MAX_SAFE_INTEGER - 1, Number.MAX_SAFE_INTEGER);
    return new Node(maxr, "__tail__");
  }

  randomLevel(selfcorrect = false) {
    const cal = selfcorrect ? this.levelup() : -1;
    if (cal >= 0) return cal;

    // probability(c) heads (ex: c=4 => hhhh) is given by 1/(2**c)
    // coinflips => [0, maxflips); 0 inclusive, maxflips exclusive
    let coinflips = (Math.random() * this.maxflips) | 0;
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

  // selects level which is max way off from what is expected
  levelup() {
    // max-diff between no. of nodes expected at a level vs current
    let maxdiff = 0;
    // level i where max-diff is
    let maxi = -1;
    // tracks total no. of nodes across levels, from higher levels to lower
    let sum = 0;

    // levels are 1 indexed, arrays are 0 indexed, that is,
    // level[0] => L1, level[1] => L2, level[7] => L8, and so on
    for (let i = this.levelhisto.length; i > 0; i--) {
      // number of nodes that level i
      const n = this.levelhisto[i - 1] - sum;
      // expected number of nodes at level i, given len of the skip-list
      const exl = Math.round(2 ** -i * this.len);
      const diff = exl - n;
      if (diff > maxdiff) {
        maxdiff = diff;
        maxi = i - 1;
      }
      // a node which is on level[9] (L10) also exists at all other levels,
      // from 0..9 (L1..L10); that is, to get a count of nodes only on
      // level[0] (L1) but not on other levels, subtract out the sum of
      // nodes on all other levels, 1..9 (L2..L10)
      sum += n;
    }
    return maxi;
  }
}

/**
 * @template V
 */
export class Node {
  /**
   * @param {Range} range
   * @param {V} data
   */
  constructor(range, data) {
    /** @type {Range} */
    this.range = range;
    /** @type {V} */
    this.value = data;
    /** @type {Node<V>[]} */
    this.next = [];
    /** @type {Node<V>[]} */
    this.prev = [];
  }

  /**
   * @param {Node<V>} other
   * @returns {boolean}
   */
  isLessThan(other) {
    return this.range.hi < other.range.lo;
  }

  /**
   * @param {number} n
   * @returns {boolean}
   */
  contains(n) {
    return n <= this.range.hi && n >= this.range.lo;
  }

  /**
   * @param {number} n
   * @returns {boolean}
   */
  greater(n) {
    return this.range.hi > n;
  }

  /**
   * @param {number} n
   * @returns {boolean}
   */
  lesser(n) {
    return this.range.hi < n;
  }
}

export class Range {
  constructor(lo, hi) {
    /** @type {number} */
    this.lo = lo;
    /** @type {number} */
    this.hi = hi;
  }
}

/**
 * @param {number} lo
 * @param {number} hi
 * @returns {Range}
 */
export function mkrange(lo, hi) {
  return new Range(lo, hi);
}

// a perfectly-balanced clone just like Thanos would want it
export function balancedCopy(other) {
  const s = new RangeList(Math.log2(other.len));
  let it = other.head.next[0];
  while (it !== other.tail) {
    // ref archive.is/kwhnG
    s.set(it.range, it.value, /* self-correct*/ true);
    it = it.next[0];
  }
  return s;
}

function logd(...rest) {
  const debug = false;
  if (debug) console.debug("RangeList", ...rest);
}
