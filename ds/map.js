/*
 * Copyright (c) 2022 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class HashMap {
    constructor() {
        this.m = new Map();
    }

    get(k) {
        return this.m.get(k);
    }

    set(k, v) {
        return this.m.set(k, v);
    }

    delete(k, v) {
        return this.m.delete(k);
    }

    clear() {
        this.m.clear();
    }

    entries() {
        return this.m.entries();
    }
}