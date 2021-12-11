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
      cachedata = this.lfuCachearray[this.lfuCachemap.get(key)];
    } catch (e) {
      console.log("Error At : LfuCache -> Get");
      console.log(e.stack);
    }
    return cachedata;
  }
  Put(cachedata) {
    try {
      this.datatolfu(cachedata);
    } catch (e) {
      console.log("Error At : LfuCache -> Put");
      console.log(e.stack);
    }
  }
}

LfuCache.prototype.removeaddlfuCache = function (key, data) {
  let arraydata = data;
  arraydata.n = this.lfustart;
  arraydata.p = -1;
  this.lfuCachemap.delete(this.lfuCachearray[this.lfuend].k);
  this.lfuCachearray[this.lfustart].p = this.lfuend;
  this.lfustart = this.lfuend;
  this.lfuend = this.lfuCachearray[this.lfuend].p;
  this.lfuCachearray[this.lfuend].n = -1;
  this.lfuCachemap.set(key, this.lfustart);
  this.lfuCachearray[this.lfustart] = arraydata;
};

LfuCache.prototype.updatelfucache = function (key, data) {
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
};

LfuCache.prototype.simpleaddlurCache = function (key, data) {
  let arraydata = {};
  arraydata = data;
  if (this.lfuCacheIndex == -1) {
    arraydata.n = -1;
    arraydata.p = -1;
    this.lfustart = 0;
    this.lfuend = 0;
    this.lfuCacheIndex++;
  } else {
    this.lfuCacheIndex++;
    arraydata.n = this.lfustart;
    arraydata.p = -1;
    this.lfuCachearray[this.lfustart].p = this.lfuCacheIndex;
    this.lfustart = this.lfuCacheIndex;
  }
  this.lfuCachemap.set(key, this.lfuCacheIndex);
  this.lfuCachearray[this.lfuCacheIndex] = {};
  this.lfuCachearray[this.lfuCacheIndex] = arraydata;
};

LfuCache.prototype.datatolfu = function (data) {
  if (this.lfuCachemap.has(data.k)) {
    data = this.lfuCachearray[this.lfuCachemap.get(data.k)];
    this.updatelfucache(data.k, data);
  } else {
    if (this.lfuCacheIndex > this.lfuCacheSize - 2) {
      this.removeaddlfuCache(data.k, data);
    } else {
      this.simpleaddlurCache(data.k, data);
    }
  }
};
