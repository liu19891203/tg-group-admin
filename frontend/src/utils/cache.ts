// 缓存管理工具

interface CacheItem<T> {
  data: T
  timestamp: number
  expireTime: number
}

interface CacheOptions {
  expireTime?: number // 过期时间（毫秒）
  prefix?: string // 键前缀
}

class CacheManager {
  private prefix: string
  private defaultExpireTime: number

  constructor(options: CacheOptions = {}) {
    this.prefix = options.prefix || 'tg_bot_'
    this.defaultExpireTime = options.expireTime || 5 * 60 * 1000 // 默认5分钟
  }

  // 生成完整键名
  private getKey(key: string): string {
    return `${this.prefix}${key}`
  }

  // 设置缓存
  set<T>(key: string, data: T, expireTime?: number): void {
    const item: CacheItem<T> = {
      data,
      timestamp: Date.now(),
      expireTime: expireTime || this.defaultExpireTime
    }
    
    try {
      localStorage.setItem(this.getKey(key), JSON.stringify(item))
    } catch (error) {
      console.error('Cache set error:', error)
      // 如果存储失败，清理过期缓存
      this.clearExpired()
    }
  }

  // 获取缓存
  get<T>(key: string): T | null {
    try {
      const itemStr = localStorage.getItem(this.getKey(key))
      if (!itemStr) return null

      const item: CacheItem<T> = JSON.parse(itemStr)
      
      // 检查是否过期
      if (Date.now() - item.timestamp > item.expireTime) {
        this.remove(key)
        return null
      }

      return item.data
    } catch (error) {
      console.error('Cache get error:', error)
      return null
    }
  }

  // 移除缓存
  remove(key: string): void {
    try {
      localStorage.removeItem(this.getKey(key))
    } catch (error) {
      console.error('Cache remove error:', error)
    }
  }

  // 检查缓存是否存在且有效
  has(key: string): boolean {
    return this.get(key) !== null
  }

  // 清空所有缓存
  clear(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          localStorage.removeItem(key)
        }
      })
    } catch (error) {
      console.error('Cache clear error:', error)
    }
  }

  // 清理过期缓存
  clearExpired(): void {
    try {
      const keys = Object.keys(localStorage)
      keys.forEach(key => {
        if (key.startsWith(this.prefix)) {
          try {
            const itemStr = localStorage.getItem(key)
            if (itemStr) {
              const item: CacheItem<any> = JSON.parse(itemStr)
              if (Date.now() - item.timestamp > item.expireTime) {
                localStorage.removeItem(key)
              }
            }
          } catch (e) {
            // 解析失败，删除该键
            localStorage.removeItem(key)
          }
        }
      })
    } catch (error) {
      console.error('Cache clearExpired error:', error)
    }
  }

  // 获取缓存信息
  getInfo(key: string): { createdAt: Date; expireAt: Date; remainingTime: number } | null {
    try {
      const itemStr = localStorage.getItem(this.getKey(key))
      if (!itemStr) return null

      const item: CacheItem<any> = JSON.parse(itemStr)
      const createdAt = new Date(item.timestamp)
      const expireAt = new Date(item.timestamp + item.expireTime)
      const remainingTime = Math.max(0, item.expireTime - (Date.now() - item.timestamp))

      return { createdAt, expireAt, remainingTime }
    } catch (error) {
      console.error('Cache getInfo error:', error)
      return null
    }
  }
}

// 创建默认实例
export const cache = new CacheManager()

// 创建带缓存的异步函数包装器
export const withCache = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  keyGenerator: (...args: Parameters<T>) => string,
  options: CacheOptions = {}
): T => {
  const cacheManager = new CacheManager(options)

  return (async (...args: Parameters<T>): Promise<ReturnType<T>> => {
    const key = keyGenerator(...args)
    
    // 尝试从缓存获取
    const cached = cacheManager.get<ReturnType<T>>(key)
    if (cached !== null) {
      return cached
    }

    // 执行原函数
    const result = await fn(...args)
    
    // 存入缓存
    cacheManager.set(key, result)
    
    return result
  }) as T
}

// 记忆化函数（内存缓存）
export const memoize = <T extends (...args: any[]) => any>(
  fn: T,
  keyGenerator?: (...args: Parameters<T>) => string
): T => {
  const cache = new Map<string, ReturnType<T>>()

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args)
    
    if (cache.has(key)) {
      return cache.get(key)!
    }

    const result = fn(...args)
    cache.set(key, result)
    return result
  }) as T
}

export default CacheManager
