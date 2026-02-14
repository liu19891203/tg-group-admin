<template>
  <div class="menu-permissions-page">
    <div class="page-header">
      <h1 class="page-title">权限管理</h1>
      <p class="page-desc">为用户分配功能级别权限，控制可访问的菜单页面</p>
    </div>

    <el-alert
      v-if="!selectedGroupId"
      title="请先选择群组"
      type="warning"
      :closable="false"
      show-icon
      class="mb-4"
    />

    <template v-else>
      <!-- 用户列表 -->
      <el-card class="user-card">
        <template #header>
          <div class="card-header">
            <span>权限用户列表</span>
            <el-button type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              添加用户
            </el-button>
          </div>
        </template>

        <el-table :data="userPermissions" stripe>
          <el-table-column label="用户" min-width="200">
            <template #default="{ row }">
              <div class="user-cell">
                <el-avatar :size="40" :src="row.avatar_url">
                  {{ row.first_name?.charAt(0) || '?' }}
                </el-avatar>
                <div class="user-info">
                  <div class="user-name">
                    {{ row.first_name }} {{ row.last_name || '' }}
                    <el-tag v-if="row.is_owner" type="danger" size="small">群主</el-tag>
                    <el-tag v-else-if="row.is_admin" type="primary" size="small">管理员</el-tag>
                  </div>
                  <div v-if="row.username" class="user-username">@{{ row.username }}</div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="功能权限" width="300">
            <template #default="{ row }">
              <el-checkbox-group v-model="row.permissions" @change="saveUserPermissions(row)">
                <el-checkbox label="basic">
                  <el-tag size="small" type="success">初级</el-tag>
                </el-checkbox>
                <el-checkbox label="intermediate">
                  <el-tag size="small" type="warning">中级</el-tag>
                </el-checkbox>
                <el-checkbox label="advanced">
                  <el-tag size="small" type="danger">高级</el-tag>
                </el-checkbox>
              </el-checkbox-group>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="100" fixed="right">
            <template #default="{ row }">
              <el-button type="danger" link @click="removeUser(row)">
                <el-icon><Delete /></el-icon>
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="userPermissions.length === 0" description="暂无权限用户" />
      </el-card>

      <!-- 权限说明 -->
      <el-card class="info-card">
        <template #header>
          <span>权限说明</span>
        </template>
        <div class="permission-info">
          <div class="info-item">
            <el-tag type="success" size="small">初级功能</el-tag>
            <span>入群验证、广告过滤、刷屏处理、自动删除、色情检测、自动封禁</span>
          </div>
          <div class="info-item">
            <el-tag type="warning" size="small">中级功能</el-tag>
            <span>自动回复、积分系统、抽奖活动、主动消息、定时消息</span>
          </div>
          <div class="info-item">
            <el-tag type="danger" size="small">高级功能</el-tag>
            <span>群组成员、频道关联、命令管理、认证用户、邀请统计、群聊统计、加密货币、超级工具</span>
          </div>
          <el-divider />
          <div class="info-item system">
            <el-tag type="danger" effect="dark" size="small">系统设置</el-tag>
            <span>仅超级管理员可访问，包含机器人Token、数据库配置等敏感信息</span>
          </div>
        </div>
      </el-card>
    </template>

    <!-- 添加用户对话框 -->
    <el-dialog v-model="showAddDialog" title="添加权限用户" width="500px">
      <el-form :model="addForm" label-width="80px">
        <el-form-item label="选择用户">
          <el-select
            v-model="addForm.userId"
            filterable
            remote
            reserve-keyword
            placeholder="搜索用户名或ID"
            :remote-method="searchUsers"
            :loading="searching"
            style="width: 100%"
          >
            <el-option
              v-for="user in searchResults"
              :key="user.id"
              :label="`${user.first_name} (@${user.username || '无用户名'})`"
              :value="user.id"
            >
              <div class="search-user-item">
                <el-avatar :size="24" :src="user.avatar_url">
                  {{ user.first_name?.charAt(0) || '?' }}
                </el-avatar>
                <span>{{ user.first_name }}</span>
                <span class="username">@{{ user.username || '无用户名' }}</span>
              </div>
            </el-option>
          </el-select>
        </el-form-item>
        <el-form-item label="功能权限">
          <el-checkbox-group v-model="addForm.permissions">
            <el-checkbox label="basic">
              <el-tag size="small" type="success">初级</el-tag>
            </el-checkbox>
            <el-checkbox label="intermediate">
              <el-tag size="small" type="warning">中级</el-tag>
            </el-checkbox>
            <el-checkbox label="advanced">
              <el-tag size="small" type="danger">高级</el-tag>
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addUser" :loading="adding">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete } from '@element-plus/icons-vue'

const groupsStore = useGroupsStore()
const selectedGroupId = computed(() => groupsStore.selectedGroupId)

// 用户权限数据
interface UserPermission {
  id: number
  first_name: string
  last_name?: string
  username?: string
  avatar_url?: string
  is_owner: boolean
  is_admin: boolean
  permissions: string[]
}

const userPermissions = ref<UserPermission[]>([
  {
    id: 1,
    first_name: '张三',
    username: 'zhangsan',
    avatar_url: '',
    is_owner: false,
    is_admin: true,
    permissions: ['basic', 'intermediate']
  },
  {
    id: 2,
    first_name: '李四',
    username: 'lisi',
    avatar_url: '',
    is_owner: false,
    is_admin: true,
    permissions: ['advanced']
  }
])

// 保存用户权限
const saveUserPermissions = async (user: UserPermission) => {
  try {
    // TODO: 调用API保存
    await new Promise(resolve => setTimeout(resolve, 300))
    ElMessage.success(`已更新 ${user.first_name} 的权限`)
  } catch (error) {
    ElMessage.error('保存失败')
  }
}

// 移除用户
const removeUser = (user: UserPermission) => {
  ElMessageBox.confirm(
    `确定要移除 ${user.first_name} 的权限配置吗？`,
    '确认移除',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    userPermissions.value = userPermissions.value.filter(u => u.id !== user.id)
    ElMessage.success('已移除')
  }).catch(() => {})
}

// 添加用户
const showAddDialog = ref(false)
const addForm = ref({
  userId: null as number | null,
  permissions: [] as string[]
})
const searching = ref(false)
const searchResults = ref<any[]>([])
const adding = ref(false)

const searchUsers = async (query: string) => {
  if (query.length < 2) return
  searching.value = true
  try {
    // TODO: 调用API搜索
    await new Promise(resolve => setTimeout(resolve, 300))
    searchResults.value = [
      { id: 3, first_name: '王五', username: 'wangwu', avatar_url: '' },
      { id: 4, first_name: '赵六', username: 'zhaoliu', avatar_url: '' }
    ].filter(u => u.first_name.includes(query) || u.username?.includes(query))
  } finally {
    searching.value = false
  }
}

const addUser = async () => {
  if (!addForm.value.userId) {
    ElMessage.warning('请选择用户')
    return
  }
  adding.value = true
  try {
    const user = searchResults.value.find(u => u.id === addForm.value.userId)
    if (user) {
      userPermissions.value.push({
        ...user,
        is_owner: false,
        is_admin: true,
        permissions: [...addForm.value.permissions]
      })
      ElMessage.success('添加成功')
      showAddDialog.value = false
      addForm.value = { userId: null, permissions: [] }
    }
  } finally {
    adding.value = false
  }
}
</script>

<style scoped lang="scss">
.menu-permissions-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #303133;
    margin: 0 0 8px 0;
  }

  .page-desc {
    font-size: 14px;
    color: #909399;
    margin: 0;
  }
}

.mb-4 {
  margin-bottom: 16px;
}

.user-card {
  margin-bottom: 20px;

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 12px;

    .user-info {
      .user-name {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .user-username {
        font-size: 12px;
        color: #909399;
        margin-top: 2px;
      }
    }
  }
}

.info-card {
  .permission-info {
    display: flex;
    flex-direction: column;
    gap: 16px;

    .info-item {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;
      color: #606266;

      &.system {
        padding-top: 8px;
      }
    }
  }
}

.search-user-item {
  display: flex;
  align-items: center;
  gap: 8px;

  .username {
    color: #909399;
    font-size: 12px;
  }
}
</style>
