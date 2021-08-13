This is a least-frequently-used(LFU) cache implementation repository.<br>

1. Create lfu cache <br> 
    let cache = new LfuCache(lfuname, size).<br>
    lfuname(string) -> name to cache object.<br>
    size(integer) -> size denotes lfu cache data holding capacity.<br>
    If size is 5 then lfu can hold 5 uniqe key with data.<br>

2. Put to lfu cache <br> 
    let obj = {} <br> 
    obj.k = "key"     <br> 
    obj.n and obj.p is reserved keys for lfucache.     <br> 
    add your data to obj and pass to  <br> 
    example: 
    ````script
    obj.data = {}
    obj.data.value = "my test data"
    obj.map = new Map() <br> 
    obj.map.set("value","my map test data")
    obj.set = new Set()
    obj.set.add("my set test data")
    cache.Put(obj)
    ````
    While inserting into lfu cahche if cache is full then removes key which is not used for long time and add new key to cache. <br> 
    
3. Get from lfu cache <br> 
    let obj = cache.Get("key") <br> 
    if key found returns object saved against key else return False <br> 
    example
    ````
    {
        data: { value: 'my test data' },
        map: Map { 'value' => 'my map test data' },
        set: Set { 'my set test data' },
        k: 'key'
    }
    ````
