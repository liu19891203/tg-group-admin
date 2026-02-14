import { createRouter, createWebHistory } from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { usePermissionsStore } from '@/stores/permissions'

// 权限级别映射
const PermissionLevels = {
  basic: ['verification', 'anti-ads', 'anti-spam', 'auto-delete', 'porn-detection', 'auto-ban'],
  intermediate: ['auto-reply', 'points', 'lottery', 'send-message', 'scheduled-messages'],
  advanced: ['group-members', 'channel-settings', 'commands', 'verified-users', 'invite-stats', 'chat-stats', 'crypto', 'super-tools']
}

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login/index.vue'),
    meta: { requiresAuth: false }
  },
  {
    path: '/',
    component: () => import('@/components/Layout/Layout.vue'),
    meta: { requiresAuth: true },
    children: [
      {
        path: '',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard/index.vue')
      },
      {
        path: 'groups',
        name: 'Groups',
        component: () => import('@/views/Groups/Groups.vue')
      },
      {
        path: 'group-members',
        name: 'GroupMembers',
        component: () => import('@/views/Groups/GroupMembers.vue')
      },
      {
        path: 'channel-settings',
        name: 'ChannelSettings',
        component: () => import('@/views/Groups/ChannelForward.vue')
      },
      {
        path: 'groups/:id',
        name: 'GroupDetail',
        component: () => import('@/views/Groups/GroupDetail.vue'),
        props: true
      },
      {
        path: 'groups/:id/config',
        name: 'GroupConfig',
        component: () => import('@/views/Groups/GroupConfig.vue'),
        props: true
      },
      {
        path: 'verification',
        name: 'Verification',
        component: () => import('@/views/Verification/index.vue')
      },
      {
        path: 'anti-ads',
        name: 'AntiAds',
        component: () => import('@/views/AntiAds/index.vue')
      },
      {
        path: 'auto-delete',
        name: 'AutoDelete',
        component: () => import('@/views/Security/AutoDelete.vue')
      },
      {
        path: 'porn-detection',
        name: 'PornDetection',
        component: () => import('@/views/Settings/PornDetection.vue')
      },
      {
        path: 'menu-permissions',
        name: 'MenuPermissions',
        component: () => import('@/views/MenuPermissions/index.vue')
      },
      {
        path: 'permissions',
        name: 'Permissions',
        component: () => import('@/views/Settings/Permissions.vue')
      },
      {
        path: 'auto-ban',
        name: 'AutoBan',
        component: () => import('@/views/Security/AutoBan.vue')
      },
      {
        path: 'auto-reply',
        name: 'AutoReply',
        component: () => import('@/views/AutoReply/index.vue')
      },
      {
        path: 'points',
        name: 'Points',
        component: () => import('@/views/Points/index.vue')
      },
      {
        path: 'lottery',
        name: 'Lottery',
        component: () => import('@/views/Lottery/index.vue')
      },
      {
        path: 'scheduled-messages',
        name: 'ScheduledMessages',
        component: () => import('@/views/ScheduledMessages/index.vue')
      },
      {
        path: 'commands',
        name: 'Commands',
        component: () => import('@/views/Commands/index.vue')
      },
      {
        path: 'anti-spam',
        name: 'AntiSpam',
        component: () => import('@/views/AntiSpam/index.vue')
      },
      {
        path: 'crypto',
        name: 'Crypto',
        component: () => import('@/views/Crypto/index.vue')
      },
      {
        path: 'chat-stats',
        name: 'ChatStats',
        component: () => import('@/views/ChatStats/index.vue')
      },
      {
        path: 'verified-users',
        name: 'VerifiedUsers',
        component: () => import('@/views/VerifiedUsers/index.vue')
      },
      {
        path: 'invite-stats',
        name: 'InviteStats',
        component: () => import('@/views/InviteStats/index.vue')
      },
      {
        path: 'messages',
        name: 'Messages',
        component: () => import('@/views/Messages/index.vue')
      },
      {
        path: 'send-message',
        name: 'SendMessage',
        component: () => import('@/views/Tools/SendMessage.vue')
      },
      {
        path: 'super-tools',
        name: 'SuperTools',
        component: () => import('@/views/Tools/SuperTools.vue')
      },
      {
        path: 'stats',
        name: 'Stats',
        component: () => import('@/views/Stats/index.vue')
      },
      {
        path: 'settings',
        name: 'Settings',
        component: () => import('@/views/Settings/index.vue')
      }
    ]
  },
  {
    path: '/:pathMatch(.*)*',
    name: 'NotFound',
    component: () => import('@/views/NotFound/index.vue')
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 获取路由所需的权限级别
const getRoutePermissionLevel = (path: string): string | null => {
  const cleanPath = path.replace(/^\//, '')
  
  if (PermissionLevels.basic.includes(cleanPath)) return 'basic'
  if (PermissionLevels.intermediate.includes(cleanPath)) return 'intermediate'
  if (PermissionLevels.advanced.includes(cleanPath)) return 'advanced'
  
  return null
}

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  
  // 检查认证
  if (to.meta.requiresAuth && !token) {
    next({ name: 'Login', query: { redirect: to.fullPath } })
    return
  }
  
  // 已登录用户访问登录页，重定向到首页
  if (to.name === 'Login' && token) {
    next({ name: 'Dashboard' })
    return
  }
  
  // 检查权限
  const requiredLevel = getRoutePermissionLevel(to.path)
  if (requiredLevel && token) {
    const permissionsStore = usePermissionsStore()
    const hasPermission = permissionsStore.hasMenuPermission(requiredLevel as any)
    
    if (!hasPermission) {
      // 无权限，重定向到无权限页面或首页
      next({ name: 'Dashboard', query: { noPermission: 'true' } })
      return
    }
  }
  
  next()
})

export default router
