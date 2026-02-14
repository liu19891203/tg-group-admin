import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { handleError, ErrorType } from '@/utils/errorHandler'
import { cache } from '@/utils/cache'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

// 请求配置选项
interface RequestOptions {
  useCache?: boolean // 是否使用缓存
  cacheKey?: string // 缓存键
  cacheTime?: number // 缓存时间（毫秒）
  showError?: boolean // 是否显示错误消息
  skipAuthRedirect?: boolean // 跳过认证重定向
}

class ApiClient {
  private client: AxiosInstance

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('token')
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
        return config
      },
      (error: AxiosError) => {
        return Promise.reject(error)
      }
    )

    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        return response.data
      },
      (error: AxiosError) => {
        const errorType = this.getErrorType(error)
        
        // 认证错误处理
        if (errorType === ErrorType.AUTH && !error.config?.headers?.['X-Skip-Auth-Redirect']) {
          localStorage.removeItem('token')
          localStorage.removeItem('auth')
          window.location.href = '/login'
        }
        
        return Promise.reject(error)
      }
    )
  }

  // 获取错误类型
  private getErrorType(error: any): ErrorType {
    if (error.response) {
      const status = error.response.status
      if (status === 401 || status === 403) return ErrorType.AUTH
      if (status === 422 || status === 400) return ErrorType.VALIDATION
      if (status >= 500) return ErrorType.SERVER
    }
    if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
      return ErrorType.NETWORK
    }
    if (error.message?.includes('Network Error')) {
      return ErrorType.NETWORK
    }
    return ErrorType.UNKNOWN
  }

  async get<T>(url: string, params?: Record<string, unknown>, options: RequestOptions = {}): Promise<T> {
    const { useCache = false, cacheKey, cacheTime = 5 * 60 * 1000, showError = true } = options
    
    // 如果启用缓存，先尝试从缓存获取
    if (useCache) {
      const key = cacheKey || `${url}_${JSON.stringify(params || {})}`
      const cached = cache.get<T>(key)
      if (cached !== null) {
        return cached
      }
    }
    
    try {
      const response = await this.client.get(url, { params })
      const result = response as T
      
      // 存入缓存
      if (useCache) {
        const key = cacheKey || `${url}_${JSON.stringify(params || {})}`
        cache.set(key, result, cacheTime)
      }
      
      return result
    } catch (error) {
      if (showError) {
        handleError(error)
      }
      throw error
    }
  }

  async post<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { showError = true } = options
    
    try {
      const response = await this.client.post(url, data)
      // POST请求成功后清除相关缓存
      cache.clear()
      return response as T
    } catch (error) {
      if (showError) {
        handleError(error)
      }
      throw error
    }
  }

  async put<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { showError = true } = options
    
    try {
      const response = await this.client.put(url, data)
      // PUT请求成功后清除相关缓存
      cache.clear()
      return response as T
    } catch (error) {
      if (showError) {
        handleError(error)
      }
      throw error
    }
  }

  async delete<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { showError = true } = options
    
    try {
      const response = await this.client.delete(url, { data })
      // DELETE请求成功后清除相关缓存
      cache.clear()
      return response as T
    } catch (error) {
      if (showError) {
        handleError(error)
      }
      throw error
    }
  }

  async patch<T>(url: string, data?: unknown, options: RequestOptions = {}): Promise<T> {
    const { showError = true } = options
    
    try {
      const response = await this.client.patch(url, data)
      return response as T
    } catch (error) {
      if (showError) {
        handleError(error)
      }
      throw error
    }
  }

  // 清除缓存
  clearCache(): void {
    cache.clear()
  }
}

export const api = new ApiClient()

export default api
