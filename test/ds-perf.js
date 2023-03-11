/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { HashMap } from "../ds/map.js";
import { RangeList, mkrange, balancedCopy } from "../ds/range-list.js";

const size = 2_000_000;
const rlExpectedP99ForSize1M = 1; // ms
const rlExpectedSumForSize1M = 5000; // ms
const hmExpectedP99ForSize1M = 0; // ms
const hmExpectedSumForSize1M = 500; // ms
const rlExpectedP99ForSize2M = 5; // ms
const rlExpectedSumForSize2M = 15000; // ms
const hmExpectedP99ForSize2M = 0; // ms
const hmExpectedSumForSize2M = 2000; // ms

(async (main) => {
  const tag = "DsPerfMain";
  const t1 = Date.now();
  console.log(tag, t1, "begin");

  const n = size;
  const r = spacedinput(n);
  const out = await Promise.allSettled([
    rangelistPerf(n, r),
    hashMapPerf(n, r),
    balancedRangeListPerf(n, r),
    rangelistPerf2(n, r),
  ]);
  const t2 = Date.now();

  console.log(tag, "outputs", out);
  console.log(tag, t2, "end", t2 - t1 + "ms");
})();

async function rangelistPerf(n, r) {
  const tag = "RangeListPerf";
  console.log(tag, "---ack---");

  const s = new RangeList(log2(n));

  // insert (range, value) pairs
  const ts1 = Date.now();
  r.forEach((i) => s.set(mkrange(i, i + 1), "r" + i));
  const ts2 = Date.now();

  console.log(tag, "setup duration", ts2 - ts1 + "ms");

  // retrieve values of all valid keys
  const t = [];
  const miss = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const x = s.get(mkrange(q, q));
    const t2 = Date.now();

    t.push(t2 - t1);

    if (x == null) miss.push(i);
  }

  console.log(tag, "get:avg(nodes-visited)", log2(n), "~=", s.avgGetIter);
  s.avgGetIter = 0; // reset

  // search nearby items, upto r.length no. of times
  const tf = [];
  const missf = [];
  for (let j = 0, i = 0, x = null; j < r.length; j++) {
    i = nearbyInt(i, 100, 0, n);

    const t1 = Date.now();
    x = s.search(mkrange(i, i), x)[1];
    const t2 = Date.now();
    tf.push(t2 - t1);

    if (x == null) missf.push(i);
  }

  console.log(tag, "find:avg(nodes-visited)", log2(n), "~=", s.avgGetIter);

  // delete all keys
  const td = [];
  const missd = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const ok = s.delete(mkrange(q, q));
    const t2 = Date.now();

    if (!ok) missf.push(i);

    td.push(t2 - t1);
  }

  logmissing(tag + " get:", miss);
  logmissing(tag + " del:", missd);
  logquantiles(tag, t, rlExpectedP99ForSize2M);
  logsums(tag, t, tf, rlExpectedSumForSize2M);
  logStoreStats(tag, s);

  console.log(tag, "---fin---");

  return tag + ":done";
}

async function balancedRangeListPerf(n, r) {
  const tag = "BalancedRangeListPerf";
  console.log(tag, "---ack---");

  let s = new RangeList(log2(n));

  // insert (range, value) pairs
  const ts1 = Date.now();
  r.forEach((i) => s.set(mkrange(i, i + 1), "r" + i));
  const ts2 = Date.now();

  console.log(tag, "setup duration", ts2 - ts1 + "ms");

  // balance rangelist
  const ts3 = Date.now();
  s = balancedCopy(s);
  const ts4 = Date.now();

  console.log(tag, "balance duration", ts4 - ts3 + "ms");

  // get values against all valid keys, randomly
  const t = [];
  const miss = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const x = s.get(mkrange(q, q));
    const t2 = Date.now();

    t.push(t2 - t1);

    if (x == null) miss.push(i);
  }

  console.log(tag, "get:avg(nodes-visited)", log2(n), "~=", s.avgGetIter);
  s.avgGetIter = 0; // reset

  // search nearby items, upto r.length no. of times
  const tf = [];
  const missf = [];
  for (let j = 0, i = 0, x = null; j < r.length; j++) {
    i = nearbyInt(i, 100, 0, n);

    const t1 = Date.now();
    x = s.search(mkrange(i, i), x)[1];
    const t2 = Date.now();
    tf.push(t2 - t1);

    if (x == null) missf.push(i);
  }

  console.log(tag, "find:avg(nodes-visited)", log2(n), "~=", s.avgGetIter);

  logmissing(tag + " get:", miss);
  logmissing(tag + " find:", missf);
  logquantiles(tag, t, rlExpectedP99ForSize2M);
  logsums(tag, t, tf, rlExpectedSumForSize2M);
  logStoreStats(tag, s);

  console.log(tag, "---fin---");

  return tag + ":done";
}

async function hashMapPerf(n, r) {
  const tag = "HashMapPerf";
  console.log(tag, "---ack---");

  const s = new HashMap();

  // insert (k, v) pairs
  const ot1 = Date.now();
  r.forEach((i) => s.set(i, "m" + i));
  const ot2 = Date.now();

  console.log(tag, "setup duration", ot2 - ot1 + "ms");

  // retrieve values of all valid keys
  const t = [];
  const miss = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const x = s.get(q);
    const t2 = Date.now();

    t.push(t2 - t1);

    if (x == null) miss.push(i);
  }

  // delete all keys
  const td = [];
  const missd = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const ok = s.delete(q);
    const t2 = Date.now();

    if (!ok) missd.push(i);

    td.push(t2 - t1);
  }

  logmissing(tag + " get:", miss);
  logmissing(tag + " del:", missd);
  logquantiles(tag, t, hmExpectedP99ForSize2M);
  logsums(tag, t, td, hmExpectedSumForSize2M);
  logStoreStats(tag, s);

  console.log(tag, "---fin---");

  return tag + ":done";
}

async function rangelistPerf2(n, r) {
  const tag = "RangeListPerf2";
  console.log(tag, "---ack---");

  const selfbalance = true;
  const s = new RangeList(log2(n));

  // insert (range, value) pairs
  const ts1 = Date.now();
  r.forEach((i) => s.set(mkrange(i, i + 1), "r" + i), selfbalance);
  const ts2 = Date.now();

  console.log(tag, "setup duration", ts2 - ts1 + "ms");

  // retrieve values of all valid keys
  const t = [];
  const miss = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const x = s.get(mkrange(q, q));
    const t2 = Date.now();

    t.push(t2 - t1);

    if (x == null) miss.push(i);
  }

  console.log(tag, "get:avg(nodes-visited)", log2(n), "~=", s.avgGetIter);
  s.avgGetIter = 0; // reset

  // search nearby items, upto r.length no. of times
  const tf = [];
  const missf = [];
  for (let j = 0, i = 0, x = null; j < r.length; j++) {
    i = nearbyInt(i, 100, 0, n);

    const t1 = Date.now();
    x = s.search(mkrange(i, i), x)[1];
    const t2 = Date.now();
    tf.push(t2 - t1);

    if (x == null) missf.push(i);
  }

  console.log(tag, "find:avg(nodes-visited)", log2(n), "~=", s.avgGetIter);

  // delete all keys
  const td = [];
  const missd = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const ok = s.delete(mkrange(q, q));
    const t2 = Date.now();

    if (!ok) missf.push(i);

    td.push(t2 - t1);
  }

  logmissing(tag + " get:", miss);
  logmissing(tag + " del:", missd);
  logquantiles(tag, t, rlExpectedP99ForSize2M);
  logsums(tag, t, tf, rlExpectedSumForSize2M);
  logStoreStats(tag, s);

  console.log(tag, "---fin---");

  return tag + ":done";
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const swap = arr[i];
    arr[i] = arr[j];
    arr[j] = swap;
  }
}

function spacedinput(n) {
  const r = [];
  for (let i = 0; r.length < n; i += 2) {
    r.push(i);
  }
  shuffle(r);
  return r;
}

function logmissing(id, m) {
  const n = m.length;
  console.log(id, n, "missing", m.slice(0, 10));
  console.assert(n === 0);
}

function logquantiles(id, t, expectedMaxP99) {
  t.sort((a, b) => a - b);

  const p90 = t[(t.length * 0.9) | 0];
  const p95 = t[(t.length * 0.95) | 0];
  const p96 = t[(t.length * 0.96) | 0];
  const p97 = t[(t.length * 0.97) | 0];
  const p98 = t[(t.length * 0.98) | 0];
  const p99 = t[(t.length * 0.99) | 0];
  const p999 = t[(t.length * 0.999) | 0];
  const p9999 = t[(t.length * 0.9999) | 0];
  const p100 = t[t.length - 1];

  console.log(id, "p90", p90, "p95", p95, "p96", p96, "p97", p97, "p98", p98);
  console.log(id, "p99", p99, "p99.9", p999, "p99.99", p9999, "p100", p100);
  console.assert(p99 <= expectedMaxP99);
}

function logsums(id, tg, td, expectedMaxP99) {
  const n = tg.length;
  const tget = tg.reduce((a, s) => a + s);
  const tdel = td.reduce((a, s) => a + s);

  console.log(id, "n:", n, "| get:", tget + "ms", "| del/find:", tdel + "ms");
  console.assert(tget <= expectedMaxP99);
}

function logStoreStats(id, s) {
  console.log(id, s.stats());
}

function nearbyInt(i, jump, min, max) {
  const vec = (Math.random() * jump) | 0;
  const add = vec % 2 === 0;
  const n = add ? i + vec : i - vec;

  if (n < min) return min + vec;
  if (n >= max) return max - vec;
  return n;
}

function log2(n) {
  return Math.round(Math.log2(n));
}
