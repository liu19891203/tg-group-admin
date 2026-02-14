import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'

// 权限级别
export type PermissionLevel = 'basic' | 'intermediate' | 'advanced'

// 用户权限
export interface UserPermission {
  id: number
  user_id: number
  group_id: string
  permissions: PermissionLevel[]
  created_at: string
  updated_at: string
}

// 当前用户权限状态
export interface PermissionState {
  userPermissions: UserPermission[]
  currentUserPermissions: PermissionLevel[]
  loading: boolean
}

export const usePermissionsStore = defineStore('permissions', () => {
  // State
  const userPermissions = ref<UserPermission[]>([])
  const currentUserPermissions = ref<PermissionLevel[]>(['basic', 'intermediate', 'advanced']) // 默认全部权限
  const loading = ref(false)

  // Getters
  const hasBasicPermission = computed(() => currentUserPermissions.value.includes('basic'))
  const hasIntermediatePermission = computed(() => currentUserPermissions.value.includes('intermediate'))
  const hasAdvancedPermission = computed(() => currentUserPermissions.value.includes('advanced'))
  
  // 检查是否有特定菜单权限
  const hasMenuPermission = (menuLevel: PermissionLevel) => {
    return currentUserPermissions.value.includes(menuLevel)
  }

  // Actions
  // 获取群组的用户权限列表
  const fetchUserPermissions = async (groupId: string) => {
    loading.value = true
    try {
      const response: any = await api.get(`/admin/menu-permissions?group_id=${groupId}`)
      userPermissions.value = response.data || []
      return response.data
    } catch (error) {
      console.error('Fetch user permissions error:', error)
      return []
    } finally {
      loading.value = false
    }
  }

  // 添加用户权限
  const addUserPermission = async (data: {
    group_id: string
    user_id: number
    permissions: PermissionLevel[]
  }) => {
    try {
      const response: any = await api.post('/admin/menu-permissions', data)
      if (response.success) {
        userPermissions.value.push(response.data)
      }
      return response
    } catch (error) {
      console.error('Add user permission error:', error)
      throw error
    }
  }

  // 更新用户权限
  const updateUserPermission = async (data: {
    id: number
    group_id: string
    permissions: PermissionLevel[]
  }) => {
    try {
      const response: any = await api.put('/admin/menu-permissions', data)
      if (response.success) {
        const index = userPermissions.value.findIndex(p => p.id === data.id)
        if (index !== -1) {
          userPermissions.value[index] = { ...userPermissions.value[index], ...response.data }
        }
      }
      return response
    } catch (error) {
      console.error('Update user permission error:', error)
      throw error
    }
  }

  // 移除用户权限
  const removeUserPermission = async (id: number) => {
    try {
      const response: any = await api.delete(`/admin/menu-permissions?id=${id}`)
      if (response.success) {
        userPermissions.value = userPermissions.value.filter(p => p.id !== id)
      }
      return response
    } catch (error) {
      console.error('Remove user permission error:', error)
      throw error
    }
  }

  // 设置当前用户权限（登录时调用）
  const setCurrentUserPermissions = (permissions: PermissionLevel[]) => {
    currentUserPermissions.value = permissions
  }

  // 检查路由权限
  const checkRoutePermission = (routePath: string): boolean => {
    // 路由权限映射
    const routePermissionMap: Record<string, PermissionLevel> = {
      '/verification': 'basic',
      '/anti-ads': 'basic',
      '/anti-spam': 'basic',
      '/auto-delete': 'basic',
      '/porn-detection': 'basic',
      '/auto-ban': 'basic',
      '/auto-reply': 'intermediate',
      '/points': 'intermediate',
      '/lottery': 'intermediate',
      '/send-message': 'intermediate',
      '/scheduled-messages': 'intermediate',
      '/group-members': 'advanced',
      '/channel-settings': 'advanced',
      '/commands': 'advanced',
      '/verified-users': 'advanced',
      '/invite-stats': 'advanced',
      '/chat-stats': 'advanced',
      '/crypto': 'advanced',
      '/super-tools': 'advanced'
    }

    const requiredLevel = routePermissionMap[routePath]
    if (!requiredLevel) return true // 没有配置的路由默认允许访问
    
    return hasMenuPermission(requiredLevel)
  }

  return {
    // State
    userPermissions,
    currentUserPermissions,
    loading,
    // Getters
    hasBasicPermission,
    hasIntermediatePermission,
    hasAdvancedPermission,
    hasMenuPermission,
    // Actions
    fetchUserPermissions,
    addUserPermission,
    updateUserPermission,
    removeUserPermission,
    setCurrentUserPermissions,
    checkRoutePermission
  }
})
