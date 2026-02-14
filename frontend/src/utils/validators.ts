import type { FormItemRule } from 'element-plus'

// 验证规则类型
export type ValidationRule = FormItemRule | FormItemRule[]

// 必填验证
export const required = (message = '此项为必填项', trigger: string | string[] = 'blur'): FormItemRule => ({
  required: true,
  message,
  trigger
})

// 字符串长度验证
export const length = (min: number, max: number, message?: string, trigger = 'blur'): FormItemRule => ({
  min,
  max,
  message: message || `长度应在 ${min} 到 ${max} 个字符之间`,
  trigger
})

// 邮箱验证
export const email = (message = '请输入有效的邮箱地址', trigger = 'blur'): FormItemRule => ({
  type: 'email',
  message,
  trigger
})

// URL验证
export const url = (message = '请输入有效的URL地址', trigger = 'blur'): FormItemRule => ({
  type: 'url',
  message,
  trigger
})

// 手机号验证（中国大陆）
export const mobile = (message = '请输入有效的手机号码', trigger = 'blur'): FormItemRule => ({
  pattern: /^1[3-9]\d{9}$/,
  message,
  trigger
})

// 数字验证
export const number = (message = '请输入数字', trigger = 'blur'): FormItemRule => ({
  pattern: /^-?\d+(\.\d+)?$/,
  message,
  trigger
})

// 整数验证
export const integer = (message = '请输入整数', trigger = 'blur'): FormItemRule => ({
  pattern: /^-?\d+$/,
  message,
  trigger
})

// 正整数验证
export const positiveInteger = (message = '请输入正整数', trigger = 'blur'): FormItemRule => ({
  pattern: /^[1-9]\d*$/,
  message,
  trigger
})

// 范围验证
export const range = (min: number, max: number, message?: string, trigger = 'blur'): FormItemRule => ({
  validator: (_rule: any, value: any, callback: Function) => {
    if (value === undefined || value === null || value === '') {
      callback()
      return
    }
    const num = Number(value)
    if (isNaN(num)) {
      callback(new Error('请输入数字'))
    } else if (num < min || num > max) {
      callback(new Error(message || `数值应在 ${min} 到 ${max} 之间`))
    } else {
      callback()
    }
  },
  trigger
})

// 正则验证
export const pattern = (regex: RegExp, message: string, trigger = 'blur'): FormItemRule => ({
  pattern: regex,
  message,
  trigger
})

// 自定义验证器
export const validator = (
  fn: (rule: any, value: any, callback: Function) => void,
  trigger = 'blur'
): FormItemRule => ({
  validator: fn,
  trigger
})

// Telegram用户名验证
export const telegramUsername = (message = '请输入有效的Telegram用户名', trigger = 'blur'): FormItemRule => ({
  pattern: /^[a-zA-Z0-9_]{5,32}$/,
  message,
  trigger
})

// Telegram群组ID验证
export const telegramGroupId = (message = '请输入有效的群组ID', trigger = 'blur'): FormItemRule => ({
  pattern: /^-100\d{10,}$/,
  message,
  trigger
})

// 加密货币地址验证
export const cryptoAddress = (chain: string, message?: string, trigger = 'blur'): FormItemRule => {
  const patterns: Record<string, RegExp> = {
    'ERC20': /^0x[a-fA-F0-9]{40}$/,
    'TRC20': /^T[a-zA-Z0-9]{33}$/,
    'BEP20': /^0x[a-fA-F0-9]{40}$/,
    'BEP2': /^bnb[a-zA-Z0-9]{39}$/,
    'SOL': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
    'BTC': /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/
  }
  
  return {
    pattern: patterns[chain] || /.*/,
    message: message || `请输入有效的 ${chain} 地址`,
    trigger
  }
}

// 自动检测链类型并验证地址
export const cryptoAddressAuto = (message = '请输入有效的加密货币地址', trigger = 'blur'): FormItemRule => {
  return {
    validator: (_rule: any, value: string, callback: Function) => {
      if (!value) {
        callback()
        return
      }
      
      const patterns: Record<string, RegExp> = {
        'ERC20': /^0x[a-fA-F0-9]{40}$/,
        'TRC20': /^T[a-zA-Z0-9]{33}$/,
        'BEP20': /^0x[a-fA-F0-9]{40}$/,
        'BEP2': /^bnb[a-zA-Z0-9]{39}$/,
        'SOL': /^[1-9A-HJ-NP-Za-km-z]{32,44}$/,
        'BTC': /^(1|3|bc1)[a-zA-Z0-9]{25,62}$/
      }
      
      const isValid = Object.values(patterns).some(pattern => pattern.test(value))
      
      if (isValid) {
        callback()
      } else {
        callback(new Error(message))
      }
    },
    trigger
  }
}

// 时间格式验证
export const timeFormat = (message = '请输入有效的时间格式 (HH:mm)', trigger = 'blur'): FormItemRule => ({
  pattern: /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/,
  message,
  trigger
})

// Cron表达式验证（简化版）
export const cronExpression = (message = '请输入有效的Cron表达式', trigger = 'blur'): FormItemRule => ({
  pattern: /^[\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]+ [\d*,/-]?$/,
  message,
  trigger
})

// 组合验证规则
export const combine = (...rules: FormItemRule[]): FormItemRule[] => rules

// 常用表单验证规则集合
export const formRules = {
  // 群组名称
  groupName: [required('请输入群组名称'), length(2, 100)],
  
  // 欢迎消息
  welcomeMessage: [length(0, 2000, '欢迎消息不能超过2000字符')],
  
  // 验证时间
  verificationTime: [required('请输入验证时间'), range(30, 300, '验证时间应在30-300秒之间')],
  
  // 积分数量
  points: [required('请输入积分数量'), positiveInteger('积分必须是正整数')],
  
  // 抽奖奖品
  lotteryPrize: [required('请输入奖品名称'), length(1, 100)],
  
  // 定时消息内容
  scheduledMessage: [required('请输入消息内容'), length(1, 2000)],
  
  // 关键词
  keyword: [required('请输入关键词'), length(1, 50)],
  
  // 回复内容
  replyContent: [required('请输入回复内容'), length(1, 1000)],
  
  // 命令
  command: [required('请输入命令'), pattern(/^[a-zA-Z0-9_]+$/, '命令只能包含字母、数字和下划线')],
  
  // 邀请奖励积分
  inviteReward: [range(0, 10000, '奖励积分应在0-10000之间')],
  
  // 封禁时长
  banDuration: [range(1, 999999, '封禁时长应在1-999999分钟之间')]
}

export default {
  required,
  length,
  email,
  url,
  mobile,
  number,
  integer,
  positiveInteger,
  range,
  pattern,
  validator,
  telegramUsername,
  telegramGroupId,
  cryptoAddress,
  cryptoAddressAuto,
  timeFormat,
  cronExpression,
  combine,
  formRules
}
