// api/_lib/redis.js
const Redis = require('ioredis');

let redis = null;

function getRedis() {
  if (redis) return redis;

  const url = process.env.REDIS_URL || process.env.UPSTASH_REDIS_URL;

  if (url) {
    // Upstash-compatible URL (rediss://:password@host:port)
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      enableOfflineQueue: true,
      lazyConnect: true,
    });
    return redis;
  }

  // Поддержка Upstash REST (без бинарного протокола). Требуются
  // переменные UPSTASH_REDIS_REST_URL и UPSTASH_REDIS_REST_TOKEN
  const restUrl = process.env.UPSTASH_REDIS_REST_URL;
  const restToken = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (restUrl && restToken) {
    const base = restUrl.replace(/\/$/, '');

    async function call(command, ...args){
      const path = [command, ...args.map(x=>encodeURIComponent(String(x)))].join('/');
      const res = await fetch(`${base}/${path}`, { headers: { Authorization: `Bearer ${restToken}` } });
      if (!res.ok) throw new Error(`Upstash error: ${res.status}`);
      const data = await res.json();
      return data.result;
    }

    redis = {
      isUpstashRest: true,
      // scan для совместимости (используется как фолбэк, возвращает как обычный Redis: [cursor, keys])
      async scan(cursor='0', ...args){
        // Upstash REST не поддерживает SCAN natively в том же формате через универсальный endpoint.
        // Возвращаем пустой результат, чтобы код переключился на индекс.
        return ['0', []];
      },
      async hset(key, obj){
        const pairs = Object.entries(obj).flat();
        return call('hset', key, ...pairs);
      },
      async hgetall(key){
        const arr = await call('hgetall', key);
        if (!Array.isArray(arr)) return {};
        const out = {};
        for (let i=0; i<arr.length; i+=2){ out[arr[i]] = arr[i+1]; }
        return out;
      },
      async lpush(key, value){ return call('lpush', key, value); },
      async lrange(key, start, stop){ return call('lrange', key, start, stop); },
      async hincrby(key, field, inc){ return call('hincrby', key, field, inc); },
      async sadd(key, ...members){ return call('sadd', key, ...members); },
      async srem(key, ...members){ return call('srem', key, ...members); },
      async scard(key){ return call('scard', key); },
      async smembers(key){ return call('smembers', key); },
      async del(...keys){ return call('del', ...keys); },
    };
    return redis;
  }
  return null; // Фолбэк на in-memory будет в store.js
}

module.exports = { getRedis };