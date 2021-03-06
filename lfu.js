/*
 * Copyright (c) 2020 RethinkDNS and its authors.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */
 
var cmin = require('@serverless-dns/count-min-sketch')
var CreateError = require('@serverless-dns/error')

class LfuCache {
  constructor(lfuname, size, lfuUpdateCount, cmslen, cmswidht, cmsheight) {
    this.lfuname = lfuname
    this.lfuCachemap = new Map()
    this.lfuCachearray = []
    this.lfuCacheSize = size
    this.lfuCacheIndex = -1
    this.lfustart = -1
    this.lfuend = 0
    this.lfuUpdateCount = lfuUpdateCount <= 0 ? 0 : lfuUpdateCount
    this.cmslen = cmslen
    this.cmswidht = cmswidht
    this.cmsheight = cmsheight
    this.cms = cmin.createCountMinSketch(cmswidht, cmsheight)
    this.cmslencount = 0
  }
  Get(key) {
    let cachedata = false
    try {
      if (this.lfuCachemap.has(key)) {
        cachedata = this.lfuCachearray[this.lfuCachemap.get(key)]
      }
    }
    catch (e) {
      CreateError("lfu.js - GetFromCache", e)
    }
    return cachedata
  }
  Put(cachedata) {
    try {
      datatolfu.call(this, cachedata)
    }
    catch (e) {
      CreateError("lfu.js - PushToCache", e)
    }
  }
}

function removeaddlfuCache(key,data){
  try{
    let arraydata={}
    arraydata = data
    arraydata.n = this.lfustart
    arraydata.p = -1
    this.lfuCachemap.delete(this.lfuCachearray[this.lfuend].k)
    this.lfuCachearray[this.lfustart].p = this.lfuend
    this.lfustart = this.lfuend
    this.lfuend = this.lfuCachearray[this.lfuend].p
    this.lfuCachearray[this.lfuend].n = -1
    this.lfuCachemap.set(key,this.lfustart)
    this.lfuCachearray[this.lfustart] = arraydata
  }
  catch(e){
    CreateError("removeaddlfuCache -> "+this.objname,e)
  }
}

function updatelfucache(key,data){
  try{
    let accindex = this.lfuCachemap.get(key)
    if(accindex != this.lfustart){
      if(data.n==-1){
        this.lfuend = data.p;
        this.lfuCachearray[this.lfuend].n = -1
      }
      else{
        this.lfuCachearray[data.n].p = data.p
        this.lfuCachearray[data.p].n = data.n
      }
      data.p = -1
      data.n = this.lfustart
      this.lfuCachearray[this.lfustart].p = accindex
      this.lfustart = accindex
    }
  }
  catch(e){
    CreateError("updatelfucache -> "+this.objname,e)
  }
}

function simpleaddlurCache(key,data){
  try{
    let arraydata = {}
    arraydata = data
    if(this.lfuCacheIndex==-1){
      arraydata.n=-1;
      arraydata.p=-1;
      this.lfustart=0
      this.lfuend=0
      this.lfuCacheIndex++
    }
    else{
      this.lfuCacheIndex++
      arraydata.n=this.lfustart;
      arraydata.p=-1;
      this.lfuCachearray[this.lfustart].p=this.lfuCacheIndex
      this.lfustart = this.lfuCacheIndex
    }
    this.lfuCachemap.set(key,this.lfuCacheIndex)
    this.lfuCachearray[this.lfuCacheIndex]={}
    this.lfuCachearray[this.lfuCacheIndex] = arraydata
  }
  catch(e){
    CreateError("simpleaddlurCache -> "+this.objname,e)
  }
}

function datatolfu(data){
  try{
    if(this.lfuCachemap.has(data.k)){
      data = this.lfuCachearray[this.lfuCachemap.get(data.k)]       
      updatelfucache.call(this,data.k,data)   
    }
    else { 
      if(this.lfuCacheIndex > (this.lfuCacheSize-2)){
        let cmscount = this.cms.query(data.k)
        if(cmscount < this.lfuUpdateCount){
          if (cmscount == 0 ) { this.cmslencount++ }
          if(this.cmslencount>=this.cmslen){
            this.cmslencount=0
            this.cms = cmin.createCountMinSketch(this.cmswidht,this.cmsheight)
          }
          this.cms.update(data.k,1)
        }
        else{
          removeaddlfuCache.call(this,data.k,data)
        }
      }
      else{
        simpleaddlurCache.call(this,data.k,data)
      }              
    }
  }
  catch(e){
    CreateError("datatolfu -> "+this.objname,e)
  }
}



module.exports.LfuCache = LfuCache