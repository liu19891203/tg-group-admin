import { defineStore } from 'pinia'
import api from '@/api'

interface Group {
  id: string
  chat_id: number
  chat_type: string
  title: string
  username?: string
  is_active: boolean
  member_count: number
  linked_channel_id?: number
  created_at?: string
  updated_at?: string
  config?: GroupConfig
}

interface GroupConfig {
  id: string
  group_id: string
  basic?: Record<string, unknown>
  welcome_config?: Record<string, unknown>
  verification?: Record<string, unknown>
  verification_config?: Record<string, unknown>
  antiAds?: Record<string, unknown>
  anti_ads_config?: Record<string, unknown>
  autoReply?: Record<string, unknown>
  auto_reply_config?: Record<string, unknown>
  autoDelete?: Record<string, unknown>
  auto_delete_config?: Record<string, unknown>
  antiSpam?: Record<string, unknown>
  anti_spam_config?: Record<string, unknown>
  points?: Record<string, unknown>
  points_config?: Record<string, unknown>
  commands?: Record<string, unknown>
  commands_config?: Record<string, unknown>
  crypto_config?: Record<string, unknown>
}

interface GroupsState {
  groups: Group[]
  currentGroup: Group | null
  currentConfig: GroupConfig | null
  selectedGroupId: string
  loading: boolean
  total: number
  page: number
  limit: number
}

export const useGroupsStore = defineStore('groups', {
  state: (): GroupsState => ({
    groups: [],
    currentGroup: null,
    currentConfig: null,
    selectedGroupId: '',
    loading: false,
    total: 0,
    page: 1,
    limit: 20
  }),

  actions: {
    async fetchGroups(params?: Record<string, unknown>) {
      this.loading = true
      try {
        const response = await api.get<{
          data: Group[]
          total: number
          page: number
          limit: number
        }>('/admin/groups', {
          page: this.page,
          limit: this.limit,
          ...params
        })
        this.groups = response.data
        this.total = response.total
        this.page = response.page
        this.limit = response.limit
      } finally {
        this.loading = false
      }
    },

    async fetchGroup(id: string) {
      this.loading = true
      try {
        const response = await api.get<{ data: Group & { group_configs: GroupConfig } }>(
          `/admin/groups/${id}`
        )
        this.currentGroup = response.data
        this.currentConfig = response.data.group_configs
        return response.data
      } finally {
        this.loading = false
      }
    },

    async createGroup(data: Partial<Group>) {
      const response = await api.post<{ data: Group }>('/admin/groups', data)
      await this.fetchGroups()
      return response.data
    },

    async updateGroup(id: string, data: Partial<Group>) {
      const response = await api.put<{ data: Group }>(`/admin/groups/${id}`, data)
      await this.fetchGroups()
      return response.data
    },

    async deleteGroup(id: string) {
      await api.delete(`/admin/groups/${id}`)
      await this.fetchGroups()
    },

    async updateConfig(id: string, config: Partial<GroupConfig>) {
      const response = await api.put<{ data: GroupConfig }>(
        `/admin/groups/${id}/config`,
        config
      )
      this.currentConfig = response.data
      return response.data
    }
  }
})
