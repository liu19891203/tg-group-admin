<template>
  <el-container class="layout-container">
    <el-aside width="220px" class="sidebar" :class="{ collapsed: isCollapsed }">
      <div class="logo">
        <img src="/favicon.svg" alt="Logo" />
        <span v-if="!isCollapsed">TG Manager</span>
      </div>
      
      <!-- 群组选择器 -->
      <div v-if="!isCollapsed" class="group-selector-wrapper">
        <GroupSelector v-model="selectedGroupId" @change="handleGroupChange" />
      </div>
      
      <el-menu
        :default-active="activeMenu"
        :collapse="isCollapsed"
        router
        class="sidebar-menu"
      >
        <el-menu-item index="/">
          <el-icon><HomeFilled /></el-icon>
          <span>数据看板</span>
        </el-menu-item>
        
        <el-sub-menu v-if="permissionsStore.hasBasicPermission" index="security">
          <template #title>
            <el-icon><Lock /></el-icon>
            <span>初级功能</span>
          </template>
          <el-menu-item index="/verification">
            <el-icon><Key /></el-icon>
            <span>入群验证</span>
          </el-menu-item>
          <el-menu-item index="/anti-ads">
            <el-icon><Delete /></el-icon>
            <span>广告过滤</span>
          </el-menu-item>
          <el-menu-item index="/anti-spam">
            <el-icon><WarnTriangleFilled /></el-icon>
            <span>刷屏处理</span>
          </el-menu-item>
          <el-menu-item index="/auto-delete">
            <el-icon><Remove /></el-icon>
            <span>自动删除</span>
          </el-menu-item>
          <el-menu-item index="/porn-detection">
            <el-icon><Warning /></el-icon>
            <span>色情检测</span>
          </el-menu-item>
          <el-menu-item index="/auto-ban">
            <el-icon><CircleClose /></el-icon>
            <span>自动封禁</span>
          </el-menu-item>
        </el-sub-menu>
        
        <el-sub-menu v-if="permissionsStore.hasIntermediatePermission" index="interaction">
          <template #title>
            <el-icon><ChatLineRound /></el-icon>
            <span>中级功能</span>
          </template>
          <el-menu-item index="/auto-reply">
            <el-icon><ChatDotRound /></el-icon>
            <span>自动回复</span>
          </el-menu-item>
          <el-menu-item index="/points">
            <el-icon><Coin /></el-icon>
            <span>积分系统</span>
          </el-menu-item>
          <el-menu-item index="/lottery">
            <el-icon><Present /></el-icon>
            <span>抽奖活动</span>
          </el-menu-item>
          <el-menu-item index="/send-message">
            <el-icon><Promotion /></el-icon>
            <span>主动消息</span>
          </el-menu-item>
          <el-menu-item index="/scheduled-messages">
            <el-icon><Clock /></el-icon>
            <span>定时消息</span>
          </el-menu-item>
        </el-sub-menu>
        
        <el-sub-menu v-if="permissionsStore.hasAdvancedPermission" index="management">
          <template #title>
            <el-icon><Setting /></el-icon>
            <span>高级功能</span>
          </template>
          <el-menu-item index="/group-members">
            <el-icon><User /></el-icon>
            <span>群组成员</span>
          </el-menu-item>
          <el-menu-item index="/channel-settings">
            <el-icon><Link /></el-icon>
            <span>频道关联</span>
          </el-menu-item>
          <el-menu-item index="/commands">
            <el-icon><Document /></el-icon>
            <span>命令管理</span>
          </el-menu-item>
          <el-menu-item index="/verified-users">
            <el-icon><Medal /></el-icon>
            <span>认证用户</span>
          </el-menu-item>
          <el-menu-item index="/invite-stats">
            <el-icon><Link /></el-icon>
            <span>邀请统计</span>
          </el-menu-item>
          <el-menu-item index="/chat-stats">
            <el-icon><DataLine /></el-icon>
            <span>群聊统计</span>
          </el-menu-item>
          <el-menu-item index="/crypto">
            <el-icon><TrendCharts /></el-icon>
            <span>加密货币</span>
          </el-menu-item>
          <el-menu-item index="/super-tools">
            <el-icon><Tools /></el-icon>
            <span>超级工具</span>
          </el-menu-item>
        </el-sub-menu>
        
        <el-sub-menu index="admin">
          <template #title>
            <el-icon><UserFilled /></el-icon>
            <span>权限管理</span>
          </template>
          <el-menu-item index="/menu-permissions">
            <el-icon><Lock /></el-icon>
            <span>菜单权限</span>
          </el-menu-item>
          <el-menu-item index="/permissions">
            <el-icon><User /></el-icon>
            <span>管理员权限</span>
          </el-menu-item>
        </el-sub-menu>
        
        <el-menu-item index="/settings">
          <el-icon><Setting /></el-icon>
          <span>系统设置</span>
        </el-menu-item>
      </el-menu>
      
      <div class="sidebar-footer">
        <el-button :icon="isCollapsed ? 'Expand' : 'Fold'" @click="toggleCollapse" />
      </div>
    </el-aside>
    
    <el-container>
      <el-header class="header">
        <div class="header-left">
          <el-breadcrumb separator="/">
            <el-breadcrumb-item :to="{ path: '/' }">首页</el-breadcrumb-item>
            <el-breadcrumb-item>{{ currentPageTitle }}</el-breadcrumb-item>
          </el-breadcrumb>
        </div>
        
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-avatar :size="32" :src="userAvatar">
                <el-icon><UserFilled /></el-icon>
              </el-avatar>
              <span class="username">{{ userName }}</span>
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="profile">
                  <el-icon><User /></el-icon>
                  个人中心
                </el-dropdown-item>
                <el-dropdown-item command="settings">
                  <el-icon><Setting /></el-icon>
                  系统设置
                </el-dropdown-item>
                <el-dropdown-item divided command="logout">
                  <el-icon><SwitchButton /></el-icon>
                  退出登录
                </el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>
      
      <el-main class="main-content">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { usePermissionsStore } from '@/stores/permissions'
import GroupSelector from '@/components/GroupSelector/GroupSelector.vue'
import { ElMessage } from 'element-plus'
import { 
  HomeFilled, 
  User, 
  UserFilled, 
  ArrowDown, 
  Setting, 
  SwitchButton,
  Lock,
  Key,
  Delete,
  WarnTriangleFilled,
  Warning,
  ChatLineRound,
  ChatDotRound,
  Coin,
  Present,
  Clock,
  Document,
  Medal,
  Link,
  TrendCharts,
  DataLine,
  Remove,
  CircleClose,
  Promotion,
  Tools
} from '@element-plus/icons-vue'

const route = useRoute()
const router = useRouter()
const authStore = useAuthStore()
const permissionsStore = usePermissionsStore()

const isCollapsed = ref(false)
const selectedGroupId = ref('')

// 处理群组切换
const handleGroupChange = (group: any) => {
  ElMessage.success(`当前群组: ${group.title}`)
  // 这里可以触发全局事件或更新状态管理
}

const activeMenu = computed(() => route.path)
const currentPageTitle = computed(() => {
  const titles: Record<string, string> = {
    '/': '数据看板',
    '/groups': '群组列表',
    '/verification': '入群验证',
    '/anti-ads': '广告过滤',
    '/anti-spam': '刷屏处理',
    '/auto-reply': '自动回复',
    '/points': '积分系统',
    '/lottery': '抽奖活动',
    '/scheduled-messages': '定时消息',
    '/commands': '命令管理',
    '/verified-users': '认证用户',
    '/invite-stats': '邀请统计',
    '/crypto': '加密货币',
    '/chat-stats': '群聊统计',
    '/settings': '系统设置'
  }
  return titles[route.path] || route.meta.title || ''
})

const userName = computed(() => authStore.user?.display_name || '管理员')
const userAvatar = computed(() => '')

function toggleCollapse() {
  isCollapsed.value = !isCollapsed.value
}

function handleCommand(command: string) {
  switch (command) {
    case 'profile':
      break
    case 'settings':
      router.push('/settings')
      break
    case 'logout':
      authStore.logout()
      router.push('/login')
      break
  }
}
</script>

<style scoped lang="scss">
.layout-container {
  height: 100vh;
}

.sidebar {
  background: #304156;
  transition: width 0.3s;
  display: flex;
  flex-direction: column;
  
  &.collapsed {
    width: 64px !important;
  }
}

.logo {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: #fff;
  font-size: 18px;
  font-weight: bold;
  
  img {
    width: 32px;
    height: 32px;
  }
}

.group-selector-wrapper {
  padding: 0 16px 16px;
  
  :deep(.selected-group) {
    background: rgba(255, 255, 255, 0.1);
    
    &:hover {
      background: rgba(255, 255, 255, 0.15);
    }
    
    .group-name {
      color: #fff;
    }
    
    .group-type {
      color: rgba(255, 255, 255, 0.7);
    }
    
    .dropdown-icon {
      color: rgba(255, 255, 255, 0.7);
    }
  }
}

.sidebar-menu {
  border-right: none;
  background: transparent;
  flex: 1;
  overflow-y: auto;
  
  :deep(.el-menu-item),
  :deep(.el-sub-menu__title) {
    color: #bfcbd9;
    
    &:hover {
      background: #263445;
    }
    
    &.is-active {
      background: #409eff;
      color: #fff;
    }
  }
  
  :deep(.el-sub-menu) {
    .el-menu {
      background: #1f2d3d;
    }
    
    .el-menu-item {
      padding-left: 50px !important;
      
      &:hover {
        background: #263445;
      }
      
      &.is-active {
        background: #409eff;
        color: #fff;
      }
    }
  }
}

.sidebar-footer {
  height: 50px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-top: 1px solid #1f2d3d;
  flex-shrink: 0;
  
  .el-button {
    background: transparent;
    border: none;
    color: #bfcbd9;
  }
}

.header {
  background: #fff;
  box-shadow: 0 1px 4px rgba(0, 21, 41, 0.08);
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  
  .username {
    font-size: 14px;
    color: #303133;
  }
}

.main-content {
  background: #f5f7fa;
  padding: 20px;
}
</style>
