import type { Directive, DirectiveBinding } from 'vue'
import { usePermissionsStore } from '@/stores/permissions'

// 权限级别
export type PermissionLevel = 'basic' | 'intermediate' | 'advanced'

// 权限指令
export const permission: Directive = {
  mounted(el: HTMLElement, binding: DirectiveBinding<PermissionLevel | PermissionLevel[]>) {
    const permissionsStore = usePermissionsStore()
    const requiredPermissions = Array.isArray(binding.value) ? binding.value : [binding.value]
    
    // 检查是否有任意一个权限
    const hasPermission = requiredPermissions.some(level => 
      permissionsStore.hasMenuPermission(level)
    )
    
    if (!hasPermission) {
      // 无权限时隐藏元素
      el.style.display = 'none'
      // 或者可以移除元素
      // el.remove()
    }
  },
  updated(el: HTMLElement, binding: DirectiveBinding<PermissionLevel | PermissionLevel[]>) {
    const permissionsStore = usePermissionsStore()
    const requiredPermissions = Array.isArray(binding.value) ? binding.value : [binding.value]
    
    const hasPermission = requiredPermissions.some(level => 
      permissionsStore.hasMenuPermission(level)
    )
    
    if (hasPermission) {
      el.style.display = ''
    } else {
      el.style.display = 'none'
    }
  }
}

// 超级管理员权限指令
export const superAdmin: Directive = {
  mounted(el: HTMLElement) {
    const authStore = JSON.parse(localStorage.getItem('auth') || '{}')
    const isSuperAdmin = authStore.user?.level === 10 || authStore.user?.role === 'super_admin'
    
    if (!isSuperAdmin) {
      el.style.display = 'none'
    }
  }
}

// 导出所有指令
export default {
  permission,
  superAdmin
}
