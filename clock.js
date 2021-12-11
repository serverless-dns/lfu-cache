/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Clock implements a LFU-like cache with "clock-hands" that sweep
// clockwise over a ring-buffer to find a slot for new entries (key,
// value). As these hands sweep, they either countdown the lifetime
// of the slot (denoted by a number between -1 to #maxcount) or
// remove it if it is dead (null or count = -1). On a re-insertion
// (same key, any value), its lifetime is incremented, its value is
// overriden. Lifetime increments with every cache-hit, as well.
//
// The hands sweep the ring independent of one another, while the
// choice of which hand should sweep the ring is made at random.
// This implementation spawns 1 hand per 256 slots, with a minimum
// of at least 2 hands (for ex, total cache capacity <= 512).
//
// refs:
// www-inst.eecs.berkeley.edu/~cs266/sp10/readings/smith78.pdf (page 11)
// power-of-2 lru: news.ycombinator.com/item?id=19188642
class Clock {

   #maxcount
   #totalhands

    constructor(cap) {
        // always power-of-2
        this.capacity = Math.pow(2, Math.round(Math.log2(cap)))
        // a ring buffer
        this.rb = new Array(this.capacity)
        this.rb.fill(null)
        // a cache
        this.store = new Map()

        this.#maxcount = 16 // max life per kv
        const slots = 256 // slots per hand
        this.#totalhands = Math.max(2, Math.round(this.capacity / slots))

        this.hands = new Array(this.#totalhands)
        for (let i = 0; i < this.#totalhands; i++) this.hands[i] = i
    }

    next(i) {
        const n = i + this.#totalhands
        return (this.capacity + n) % this.capacity
    }

    cur(i) {
        return (this.capacity + i) % this.capacity
    }

    prev(i) {
        const p = i - this.#totalhands
        return (this.capacity + p) % this.capacity
    }

    bound(i, min, max) { // min inclusive, max exclusive
        i = (i < min) ? min : i
        i = (i > max) ? max - 1 : i
        return i
    }

    head(n) {
        n = this.bound(n, 0, this.#totalhands)
        const h = this.hands[n]
        return this.cur(h)
    }

    incrHead(n) {
        n = this.bound(n, 0, this.#totalhands)
        this.hands[n] = this.next(this.hands[n])
        return this.hands[n]
    }

    decrHead(n) {
        n = this.bound(n, 0, this.#totalhands)
        this.hands[n] = this.prev(this.hands[n])
        return this.hand[n]
    }

    get size() {
        return this.store.size;
    }

    evict(n) {
        logd("evict start, head/toss/size", this.head(n), n, this.size)
        let h = this.head(n)
        // countdown lifetime of alive slots as rb is sweeped for a dead slot
        while (this.rb[h] !== null && this.rb[h].count-- > 0) {
            h = this.incrHead(n)
        }

        const cached = this.rb[h]
        if (cached !== null) {
            logd("evict", h, cached)
            this.store.delete(cached.key)
            this.rb[h] = null
        }
        return h
    }

    put(k, v, c = 1) {
        const cached = this.store.get(k)
        if (cached) {
            cached.value = v
            const at = this.rb[cached.pos]
            at.count = Math.min(at.count + c, this.#maxcount)
            return
        }
        const num = this.rolldice
        const slot = this.evict(num)

        const ringv = { key: k, count: Math.min(c, this.#maxcount) }
        const storev = { value: v, pos: slot }
        this.rb[slot] = ringv
        this.store.set(k, storev)

        this.incrHead(num)
    }

    val(k, c = 1) {
        const r = this.store.get(k)
        if (!r) return null
        const at = this.rb[r.pos]
        at.count = Math.min(at.count + c, this.#maxcount)
        return r.value
    }

    get rolldice() {
        const max = this.#totalhands // exclusive
        const min = 0 // inclusive
        return Math.floor(Math.random() * (max - min)) + min
    }

}

function logd() {
    const debug = false
    if (debug) console.debug(...arguments)
}

