This is a least-frequently-used(LFU) cache implementation repository.
1. Create lfu cache
    let cache = new LfuCache(lfuname, size)
    lfuname(string) -> name to cache object.
    size(integer) -> size denotes lfu cache data holding capacity. If size is 5 then lfu can hold 5 uniqe key with data.

2. Put to lfu cache
    let obj = {}
    obj.k = "key"    
    obj.n and obj.p is reserved keys for lfucache.    
    add your data to obj and pass to 
    example: obj.data = {}
             obj.data.value = "my test data"
             obj.map = new Map()
             obj.map.set("value","my map test data")
             obj.set = new Set()
             obj.set.add("my set test data")
    cache.Put(obj)
    While inserting into lfu cahche if cache is full then removes key which is not used for long time and add new key to cache.
    
3. Get from lfu cache
    let obj = cache.Get("key")
    if key found returns object saved against key else return False
    example
    {
        data: { value: 'my test data' },
        map: Map { 'value' => 'my map test data' },
        set: Set { 'my set test data' },
        k: 'key'
    }