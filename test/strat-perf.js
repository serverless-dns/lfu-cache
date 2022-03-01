/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

import { MultiClock } from "../strat/multi-clock.js";
import { O1 } from "../strat/o1.js";
import { HashMap } from "../ds/map.js";

const size = 1_000_000;
const o1ExpectedP99ForSize1M = 0; // ms
const o1ExpectedSumForSize1M = 800; // ms
const mcExpectedP99ForSize1M = 1; // ms
const mcExpectedSumForSize1M = 1400; // ms

(async (main) => {
  const tag = "StratPerfMain";
  const t1 = Date.now();
  console.log(tag, t1, "begin");

  const n = size;
  const out = await Promise.allSettled([o1Perf(n), mclockPerf(n)]);
  const t2 = Date.now();

  console.log(tag, "outputs", out);
  console.log(tag, t2, "end", t2 - t1 + "ms");
})();

async function o1Perf(n) {
  const tag = "O1Perf";
  console.log(tag, "---ack---");

  const s = new O1({
    cap: n,
    freq: 16,
    store: () => new HashMap(),
  });

  const r = spacedinput(n);

  const ts1 = Date.now();
  r.forEach((i) => s.put(i, "o1" + i));
  const ts2 = Date.now();

  console.log(tag, "put duration", ts2 - ts1 + "ms");

  const t = [];
  const miss = [];
  let x = null;
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    x = s.val(q);
    const t2 = Date.now();

    t.push(t2 - t1);

    if (x == null) miss.push(i);
  }

  logmissing(tag + " val:", miss);
  logquantiles(tag, t, o1ExpectedP99ForSize1M);
  logsums(tag, t, o1ExpectedSumForSize1M);

  console.log(tag, "---fin---");

  return tag + ":done";
}

async function mclockPerf(n) {
  const tag = "MultiClockPerf";
  console.log(tag, "---ack---");

  const s = new MultiClock({
    cap: n,
    store: () => new HashMap(),
  });

  const r = spacedinput(n);

  const ot1 = Date.now();
  const noput = new Set();
  r.forEach((i) => {
    const ok = s.put(i, "mc" + i);
    if (!ok) noput.add(i);
  });
  const ot2 = Date.now();

  console.log(tag, "put duration", ot2 - ot1 + "ms", "#noputs", noput.size);

  const t = [];
  let miss = [];
  for (let i = 0; i < r.length; i++) {
    const q = r[i];
    const t1 = Date.now();
    const x = s.val(q);
    const t2 = Date.now();

    t.push(t2 - t1);

    if (x == null) miss.push(i);
  }

  if (noput.size) miss = miss.filter((i) => !noput.has(i));

  logmissing(tag + " val:", miss, s.size());
  logquantiles(tag, t, mcExpectedP99ForSize1M);
  logsums(tag, t, mcExpectedSumForSize1M);

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

function logmissing(id, m, csize = size) {
  const n = size - (m.length + csize);
  console.log(id, n, "missing", m.slice(0, 10), "...", m.length);
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

function logsums(id, tg, expectedMaxP99) {
  const n = tg.length;
  const tget = tg.reduce((a, s) => a + s);

  console.log(id, "n:", n, "| get:", tget + "ms <=", expectedMaxP99 + "ms");
  console.assert(tget <= expectedMaxP99);
}
