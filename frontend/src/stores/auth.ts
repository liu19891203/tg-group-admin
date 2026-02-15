import { defineStore } from 'pinia'
import api from '@/api'

interface User {
  id: string
  telegram_id: number
  username?: string
  display_name?: string
  level: number
  permissions?: Record<string, boolean>
}

interface AuthState {
  token: string | null
  user: User | null
  isLoggedIn: boolean
}

interface LoginResponse {
  success: boolean
  token: string
  user: User
}

export const useAuthStore = defineStore('auth', {
  state: (): AuthState => ({
    token: localStorage.getItem('token'),
    user: null,
    isLoggedIn: !!localStorage.getItem('token')
  }),

  getters: {
    getToken: (state) => state.token,
    getUser: (state) => state.user,
    // 权限等级检查
    isSuperAdmin: (state) => state.user?.level === 10,
    isGroupAdmin: (state) => state.user?.level >= 5,
    isAdmin: (state) => state.user?.level >= 5,
    // 获取用户等级
    userLevel: (state) => state.user?.level || 0,
    // 检查特定权限
    hasPermission: (state) => (permission: string) => {
      if (state.user?.level === 10) return true // 超级管理员拥有所有权限
      return state.user?.permissions?.[permission] || false
    }
  },

  actions: {
    async login(token: string, user: User) {
      this.token = token
      this.user = user
      this.isLoggedIn = true
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))
    },

    async loginWithPassword(username: string, password: string) {
      const response = await api.post<LoginResponse>('/admin/login', {
        username,
        password
      })

      if (response.success && response.token) {
        this.token = response.token
        this.user = response.user
        this.isLoggedIn = true
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
      } else {
        throw new Error('登录失败')
      }
    },

    async loginWithTelegramCode(telegramId: string, code: string) {
      const response = await api.post<LoginResponse>('/admin/auth/verify-code', {
        telegramId,
        code
      })

      if (response.success && response.token) {
        this.token = response.token
        this.user = response.user
        this.isLoggedIn = true
        localStorage.setItem('token', response.token)
        localStorage.setItem('user', JSON.stringify(response.user))
      } else {
        throw new Error(response.error || '登录失败')
      }
    },

    async fetchUser() {
      try {
        const response = await api.get<{ data: User }>('/admin/auth/me')
        this.user = response.data
      } catch (error) {
        this.logout()
        throw error
      }
    },

    // 从 localStorage 恢复用户状态
    restoreFromStorage() {
      const token = localStorage.getItem('token')
      const userStr = localStorage.getItem('user')
      
      if (token && userStr) {
        try {
          const user = JSON.parse(userStr)
          this.token = token
          this.user = user
          this.isLoggedIn = true
        } catch (e) {
          this.logout()
        }
      }
    },

    logout() {
      this.token = null
      this.user = null
      this.isLoggedIn = false
      localStorage.removeItem('token')
      localStorage.removeItem('user')
    },

    // 检查用户是否可以管理特定群组
    async canManageGroup(groupId: string): Promise<boolean> {
      // 超级管理员可以管理所有群组
      if (this.user?.level === 10) return true
      
      // 群组管理员需要检查是否是该群组的管理员
      if (this.user?.level >= 5) {
        try {
          const response = await api.get<{ isAdmin: boolean }>(`/admin/groups/${groupId}/check-admin`)
          return response.isAdmin
        } catch {
          return false
        }
      }
      
      return false
    }
  }
})
