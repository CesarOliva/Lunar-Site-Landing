/** Caché LRU mínima (un Map conserva el orden de inserción: el primero es el menos reciente). */
export class LruCache {
  constructor(maxEntries) {
    this.maxEntries = maxEntries
    this.map = new Map()
    this.hits = 0
    this.misses = 0
  }

  get(key) {
    if (!this.map.has(key)) {
      this.misses += 1
      return undefined
    }
    this.hits += 1
    const value = this.map.get(key)
    this.map.delete(key)
    this.map.set(key, value)
    return value
  }

  set(key, value) {
    this.map.delete(key)
    this.map.set(key, value)
    while (this.map.size > this.maxEntries) this.map.delete(this.map.keys().next().value)
  }

  delete(key) {
    this.map.delete(key)
  }

  get size() {
    return this.map.size
  }

  stats() {
    return { size: this.map.size, hits: this.hits, misses: this.misses }
  }
}
