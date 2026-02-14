import { ElMessage, ElNotification } from 'element-plus'

// 错误类型
export enum ErrorType {
  NETWORK = 'network',
  AUTH = 'auth',
  VALIDATION = 'validation',
  SERVER = 'server',
  UNKNOWN = 'unknown'
}

// 错误信息映射
const errorMessages: Record<string, string> = {
  'network-error': '网络连接失败，请检查网络后重试',
  'timeout': '请求超时，请稍后重试',
  'unauthorized': '登录已过期，请重新登录',
  'forbidden': '没有权限执行此操作',
  'not-found': '请求的资源不存在',
  'server-error': '服务器错误，请稍后重试',
  'validation-error': '数据验证失败，请检查输入',
  'default': '操作失败，请稍后重试'
}

// 错误处理选项
interface ErrorHandlerOptions {
  showMessage?: boolean
  showNotification?: boolean
  silent?: boolean
  callback?: (error: any) => void
}

// 获取错误类型
export const getErrorType = (error: any): ErrorType => {
  if (!error) return ErrorType.UNKNOWN
  
  if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
    return ErrorType.NETWORK
  }
  
  if (error.response) {
    const status = error.response.status
    if (status === 401) return ErrorType.AUTH
    if (status === 403) return ErrorType.AUTH
    if (status === 422 || status === 400) return ErrorType.VALIDATION
    if (status >= 500) return ErrorType.SERVER
  }
  
  if (error.message?.includes('Network Error')) {
    return ErrorType.NETWORK
  }
  
  return ErrorType.UNKNOWN
}

// 获取错误消息
export const getErrorMessage = (error: any): string => {
  if (!error) return errorMessages.default
  
  // 优先使用后端返回的错误消息
  if (error.response?.data?.error) {
    return error.response.data.error
  }
  
  if (error.response?.data?.message) {
    return error.response.data.message
  }
  
  // 根据错误类型返回默认消息
  const errorType = getErrorType(error)
  const typeMap: Record<ErrorType, string> = {
    [ErrorType.NETWORK]: errorMessages['network-error'],
    [ErrorType.AUTH]: errorMessages['unauthorized'],
    [ErrorType.VALIDATION]: errorMessages['validation-error'],
    [ErrorType.SERVER]: errorMessages['server-error'],
    [ErrorType.UNKNOWN]: errorMessages.default
  }
  
  return typeMap[errorType] || errorMessages.default
}

// 处理错误
export const handleError = (error: any, options: ErrorHandlerOptions = {}) => {
  const { showMessage = true, showNotification = false, silent = false, callback } = options
  
  if (silent) {
    console.error('Error (silent):', error)
    return
  }
  
  const errorType = getErrorType(error)
  const message = getErrorMessage(error)
  
  // 认证错误特殊处理
  if (errorType === ErrorType.AUTH) {
    // 清除登录状态
    localStorage.removeItem('token')
    localStorage.removeItem('auth')
    
    // 显示消息
    if (showMessage) {
      ElMessage.error(message)
    }
    
    // 重定向到登录页
    setTimeout(() => {
      window.location.href = '/login'
    }, 1500)
    
    return
  }
  
  // 显示错误消息
  if (showMessage) {
    ElMessage.error(message)
  }
  
  if (showNotification) {
    ElNotification.error({
      title: '错误',
      message: message,
      duration: 5000
    })
  }
  
  // 执行回调
  if (callback) {
    callback(error)
  }
  
  // 记录错误日志
  console.error('Error:', error)
}

// 包装异步函数，自动处理错误
export const withErrorHandling = <T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: ErrorHandlerOptions = {}
): T => {
  return (async (...args: any[]) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleError(error, options)
      throw error
    }
  }) as T
}

// 创建 API 错误处理器
export const createApiErrorHandler = (defaultOptions: ErrorHandlerOptions = {}) => {
  return (error: any, options: ErrorHandlerOptions = {}) => {
    handleError(error, { ...defaultOptions, ...options })
  }
}

export default {
  ErrorType,
  getErrorType,
  getErrorMessage,
  handleError,
  withErrorHandling,
  createApiErrorHandler
}
