/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

// Clock2 implements a LFU-like cache with two distincts "clock-hands" that
// sweep in odd or even jumps over a ring-buffer to find "slots" for the
// entry to be cached. As these hands sweep, they either countdown the lifetime
// of the slot (denoted by a number between -1 to #maxcount) or remove it if it
// is dead (count = -1). On a re-insertion (same key, any value), it increments
// the lifetime-count and stores the new value. The clock-hands sweep the ring
// independently, while the choice to run one hand over another is random.
//
// refs:
// www-inst.eecs.berkeley.edu/~cs266/sp10/readings/smith78.pdf (page 11)
// power-of-2 lru: news.ycombinator.com/item?id=19188642
class Clock2 {

    // wrapN start and end define boundaries in rb for handN
    #wrap1start = null
    #wrap2start = null
    #wrap1end = null
    #wrap2end = null
    // no more than 16 lives
    #maxcount = 0xff

    constructor(cap) {
        // always even
        this.capacity = (cap % 2 == 0) ? cap : cap + 1
        // a ring buffer
        this.rb = new Array(this.capacity)
        this.rb.fill(null)
        // a cache
        this.store = new Map()
        // start and end wrap positions in rb head1/2
        this.#wrap1start = 0
        this.#wrap2start = 1
        this.#wrap1end = this.capacity - 1
        this.#wrap2end = this.capacity - 2
        // hand1 points to L1 entries
        this.hand1 = this.cur(this.#wrap1start)
        // hand2 points to L2 entries
        this.hand2 = this.cur(this.#wrap2start)
    }

    next(i, wrap) { // jump 2 places
        const n = i + 2
        return (n > this.capacity) ? wrap : (this.capacity + n) % this.capacity
    }

    cur(i) {
        return (this.capacity + i) % this.capacity
    }

    prev(i, wrap) { // back up 2 places
        const p = i - 2
        return (p < 0) ? wrap : (this.capacity + p) % this.capacity
    }

    head(toss) {
        const h = (toss) ? this.hand1 : this.hand2
        return this.cur(h)
    }

    get head1() {
        return this.cur(this.hand1)
    }

    get head2() {
        return this.cur(this.hand2)
    }

    incrHead(toss) {
        return (toss) ? this.incrHead1() : this.incrHead2()
    }

    decrHead(toss) {
        return (toss) ? this.decrHead1() : this.decrHead2()
    }

    incrHead1() {
        this.hand1 = this.next(this.hand1, this.#wrap1start)
        return this.hand1
    }

    decrHead1() {
        this.hand1 = this.prev(this.hand1, this.#wrap1end)
        return this.hand1
    }

    incrHead2() {
        this.hand2 = this.next(this.hand2, this.#wrap2start)
        return this.hand2
    }

    decrHead2() {
        this.hand2 = this.prev(this.hand2, this.#wrap2end)
        return this.hand2
    }

    get size() {
        return this.store.size;
    }

    evict(toss) {
        logd("evict start, head/toss/size", this.head(toss), toss, this.size)
        let h = this.head(toss)
        // countdown lifetime of alive slots as rb is sweeped for a dead slot
        while (this.rb[h] !== null && this.rb[h].count-- > 0) {
            h = this.incrHead(toss)
        }

        const cached = this.rb[h]
        logd("evict", h, cached)
        if (cached !== null) {
            this.store.delete(cached.key)
            this.rb[h] = null
        }
        return h
    }

    put(k, v, c = 1) {
        const cached = this.val(k)
        if (cached) {
            cached.value = v
            const at = this.rb[cached.pos]
            at.count = Math.max(at.count + c, this.#maxcount)
            return
        }
        const toss = this.cointoss // choose one hand or the other
        const slot = this.evict(toss)

        const ringv = { key: k, count: Math.max(c, this.#maxcount) }
        const storev = { value: v, pos: slot }
        this.rb[slot] = ringv
        this.store.set(k, storev)

        this.incrHead(toss)
    }

    val(k) {
        return this.store.get(k)
    }

    get cointoss() {
        const max = 2 // exclusive
        const min = 0 // inclusive
        return Math.floor(Math.random() * (max - min)) + min
    }

}

function logd() {
    const debug = false
    if (debug) console.debug(...arguments)
}

