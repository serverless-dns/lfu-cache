/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class LfuCache {
  constructor(lfuname, size) {
    this.lfuname = lfuname;
    this.lfuCachemap = new Map();
    this.lfuCachearray = [];
    this.lfuCacheSize = size;
    this.lfuCacheIndex = -1;
    this.lfustart = -1;
    this.lfuend = 0;
  }
  Get(key) {
    let cachedata = false;
    try {
      if (this.lfuCachemap.has(key)) {
        cachedata = this.lfuCachearray[this.lfuCachemap.get(key)];
        updatelfucache.call(this, cachedata.k, cachedata);
      }
    } catch (e) {
      console.log("Error At : LfuCache -> Get");
      console.log(e.stack);
      throw e;
    }
    return cachedata.data;
  }
  Put(key, data) {
    try {
      datatolfu.call(this, key, data);
    } catch (e) {
      console.log("Error At : LfuCache -> Put");
      console.log(e.stack);
      throw e;
    }
  }
}

function removeaddlfuCache(key, data) {
  try {
    data.n = this.lfustart;
    data.p = -1;
    this.lfuCachemap.delete(this.lfuCachearray[this.lfuend].k);
    this.lfuCachearray[this.lfustart].p = this.lfuend;
    this.lfustart = this.lfuend;
    this.lfuend = this.lfuCachearray[this.lfuend].p;
    this.lfuCachearray[this.lfuend].n = -1;
    this.lfuCachemap.set(key, this.lfustart);
    this.lfuCachearray[this.lfustart] = data;
  } catch (e) {
    console.log("Error At : LfuCache -> removeaddlfuCache");
    console.log(e.stack);
    throw e;
  }
}

function updatelfucache(key, data) {
  try {
    let accindex = this.lfuCachemap.get(key);
    if (accindex != this.lfustart) {
      if (data.n == -1) {
        this.lfuend = data.p;
        this.lfuCachearray[this.lfuend].n = -1;
      } else {
        this.lfuCachearray[data.n].p = data.p;
        this.lfuCachearray[data.p].n = data.n;
      }
      data.p = -1;
      data.n = this.lfustart;
      this.lfuCachearray[this.lfustart].p = accindex;
      this.lfustart = accindex;
    }
  } catch (e) {
    console.log("Error At : LfuCache -> updatelfucache");
    console.log(e.stack);
    throw e;
  }
}

function simpleaddlfuCache(key, data) {
  try {
    if (this.lfuCacheIndex == -1) {
      data.n = -1;
      data.p = -1;
      this.lfustart = 0;
      this.lfuend = 0;
      this.lfuCacheIndex++;
    } else {
      this.lfuCacheIndex++;
      data.n = this.lfustart;
      data.p = -1;
      this.lfuCachearray[this.lfustart].p = this.lfuCacheIndex;
      this.lfustart = this.lfuCacheIndex;
    }
    this.lfuCachemap.set(key, this.lfuCacheIndex);
    this.lfuCachearray[this.lfuCacheIndex] = {};
    this.lfuCachearray[this.lfuCacheIndex] = data;
  } catch (e) {
    console.log("Error At : LfuCache -> simpleaddlfuCache");
    console.log(e.stack);
    throw e;
  }
}

function datatolfu(key, data) {
  try {
    let cacheObj = {};
    if (this.lfuCachemap.has(key)) {
      cacheObj = this.lfuCachearray[this.lfuCachemap.get(key)];
      cacheObj.data = data;
      updatelfucache.call(this, key, cacheObj);
    } else {
      cacheObj.k = key;
      cacheObj.data = data;
      if (this.lfuCacheIndex > (this.lfuCacheSize - 2)) {
        removeaddlfuCache.call(this, key, cacheObj);
      } else {
        simpleaddlfuCache.call(this, key, cacheObj);
      }
    }
  } catch (e) {
    console.log("Error At : LfuCache -> datatolfu");
    console.log(e.stack);
    throw e;
  }
}
