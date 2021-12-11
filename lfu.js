/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

export class LfuCache {
  constructor(lfuName, size) {
    this.lfuName = lfuName;
    this.lfuCacheMap = new Map();
    this.lfuCacheArray = [];
    this.lfuCacheSize = size;
    this.lfuCacheIndex = -1;
    this.lfustart = -1;
    this.lfuend = 0;
  }
  Get(key) {
    let cacheData = false;
    try {
      cacheData = this.lfuCacheArray[this.lfuCacheMap.get(key)];
    } catch (e) {
      console.log("Error At : LfuCache -> Get");
      console.log(e.stack);
    }
    return cacheData;
  }
  Put(cacheData) {
    try {
      this.dataToLfu(cacheData);
    } catch (e) {
      console.log("Error At : LfuCache -> Put");
      console.log(e.stack);
    }
  }
}

LfuCache.prototype.removeAddLfuCache = function (key, data) {
  let arraydata = data;
  arraydata.n = this.lfustart;
  arraydata.p = -1;
  this.lfuCacheMap.delete(this.lfuCacheArray[this.lfuend].k);
  this.lfuCacheArray[this.lfustart].p = this.lfuend;
  this.lfustart = this.lfuend;
  this.lfuend = this.lfuCacheArray[this.lfuend].p;
  this.lfuCacheArray[this.lfuend].n = -1;
  this.lfuCacheMap.set(key, this.lfustart);
  this.lfuCacheArray[this.lfustart] = arraydata;
};

LfuCache.prototype.updateLfuCache = function (key, data) {
  let accindex = this.lfuCacheMap.get(key);
  if (accindex != this.lfustart) {
    if (data.n == -1) {
      this.lfuend = data.p;
      this.lfuCacheArray[this.lfuend].n = -1;
    } else {
      this.lfuCacheArray[data.n].p = data.p;
      this.lfuCacheArray[data.p].n = data.n;
    }
    data.p = -1;
    data.n = this.lfustart;
    this.lfuCacheArray[this.lfustart].p = accindex;
    this.lfustart = accindex;
  }
};

LfuCache.prototype.simpleAddLruCache = function (key, data) {
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
    this.lfuCacheArray[this.lfustart].p = this.lfuCacheIndex;
    this.lfustart = this.lfuCacheIndex;
  }
  this.lfuCacheMap.set(key, this.lfuCacheIndex);
  this.lfuCacheArray[this.lfuCacheIndex] = {};
  this.lfuCacheArray[this.lfuCacheIndex] = arraydata;
};

LfuCache.prototype.dataToLfu = function (value) {
  if (this.lfuCacheMap.has(value.k)) {
    let oldValue = this.lfuCacheArray[this.lfuCacheMap.get(value.k)];
    oldValue.data = value.data;
    this.updateLfuCache(value.k, oldValue);
  } else {
    if (this.lfuCacheIndex > this.lfuCacheSize - 2) {
      this.removeAddLfuCache(value.k, value);
    } else {
      this.simpleAddLruCache(value.k, value);
    }
  }
};
