import { defineStore } from 'pinia'
import api from '@/api'

interface User {
  id: string
  telegram_id: number
  username?: string
  display_name?: string
  level: number
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
    isAdmin: (state) => state.user?.level === 10
  },

  actions: {
    async login(token: string) {
      this.token = token
      this.isLoggedIn = true
      localStorage.setItem('token', token)
      
      await this.fetchUser()
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
      } else {
        throw new Error('登录失败')
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

    logout() {
      this.token = null
      this.user = null
      this.isLoggedIn = false
      localStorage.removeItem('token')
    }
  }
})
