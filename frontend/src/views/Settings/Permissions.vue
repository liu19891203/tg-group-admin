<template>
  <div class="permissions-page">
    <div class="page-header">
      <h2 class="page-title">管理员权限管理</h2>
      <p class="page-desc">管理群组管理员及其权限级别</p>
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
      <el-card>
        <template #header>
          <div class="card-header">
            <span>管理员列表</span>
            <el-button type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              添加管理员
            </el-button>
          </div>
        </template>

        <el-table :data="adminList" stripe>
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
                  </div>
                  <div v-if="row.username" class="user-username">@{{ row.username }}</div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="权限级别" width="150">
            <template #default="{ row }">
              <el-tag :type="row.level === 10 ? 'danger' : 'primary'" size="small">
                {{ row.level === 10 ? '超级管理员' : '管理员' }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column prop="created_at" label="添加时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="150" fixed="right">
            <template #default="{ row }">
              <el-button 
                v-if="!row.is_owner" 
                type="primary" 
                link 
                @click="editAdmin(row)"
              >
                编辑
              </el-button>
              <el-button 
                v-if="!row.is_owner" 
                type="danger" 
                link 
                @click="removeAdmin(row)"
              >
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="adminList.length === 0" description="暂无管理员" />
      </el-card>
    </template>

    <!-- 添加管理员对话框 -->
    <el-dialog v-model="showAddDialog" title="添加管理员" width="500px">
      <el-form :model="adminForm" label-width="100px">
        <el-form-item label="选择用户">
          <el-select
            v-model="adminForm.user_id"
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
        <el-form-item label="权限级别">
          <el-radio-group v-model="adminForm.level">
            <el-radio :label="1">管理员</el-radio>
            <el-radio :label="10">超级管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="addAdmin" :loading="adding">添加</el-button>
      </template>
    </el-dialog>

    <!-- 编辑管理员对话框 -->
    <el-dialog v-model="showEditDialog" title="编辑管理员" width="500px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="用户">
          <span>{{ editForm.first_name }} (@{{ editForm.username || '无用户名' }})</span>
        </el-form-item>
        <el-form-item label="权限级别">
          <el-radio-group v-model="editForm.level">
            <el-radio :label="1">管理员</el-radio>
            <el-radio :label="10">超级管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showEditDialog = false">取消</el-button>
        <el-button type="primary" @click="updateAdmin" :loading="updating">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useGroupsStore } from '@/stores/groups'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'

const groupsStore = useGroupsStore()
const selectedGroupId = computed(() => groupsStore.selectedGroupId)

// 管理员列表
interface Admin {
  id: number
  first_name: string
  last_name?: string
  username?: string
  avatar_url?: string
  is_owner: boolean
  level: number
  created_at: string
}

const adminList = ref<Admin[]>([
  {
    id: 1,
    first_name: '群主用户',
    username: 'owner',
    avatar_url: '',
    is_owner: true,
    level: 10,
    created_at: '2024-01-01T00:00:00Z'
  },
  {
    id: 2,
    first_name: '普通管理员',
    username: 'admin',
    avatar_url: '',
    is_owner: false,
    level: 1,
    created_at: '2024-01-15T00:00:00Z'
  }
])

// 添加管理员
const showAddDialog = ref(false)
const adminForm = ref({
  user_id: null as number | null,
  level: 1
})
const searching = ref(false)
const searchResults = ref<any[]>([])
const adding = ref(false)

const searchUsers = async (query: string) => {
  if (query.length < 2) return
  searching.value = true
  try {
    // TODO: 调用API搜索用户
    await new Promise(resolve => setTimeout(resolve, 300))
    searchResults.value = [
      { id: 3, first_name: '王五', username: 'wangwu', avatar_url: '' },
      { id: 4, first_name: '赵六', username: 'zhaoliu', avatar_url: '' }
    ].filter(u => u.first_name.includes(query) || u.username?.includes(query))
  } finally {
    searching.value = false
  }
}

const addAdmin = async () => {
  if (!adminForm.value.user_id) {
    ElMessage.warning('请选择用户')
    return
  }
  adding.value = true
  try {
    const user = searchResults.value.find(u => u.id === adminForm.value.user_id)
    if (user) {
      adminList.value.push({
        ...user,
        is_owner: false,
        level: adminForm.value.level,
        created_at: new Date().toISOString()
      })
      ElMessage.success('添加成功')
      showAddDialog.value = false
      adminForm.value = { user_id: null, level: 1 }
    }
  } finally {
    adding.value = false
  }
}

// 编辑管理员
const showEditDialog = ref(false)
const editForm = ref({
  id: 0,
  first_name: '',
  username: '',
  level: 1
})
const updating = ref(false)

const editAdmin = (admin: Admin) => {
  editForm.value = {
    id: admin.id,
    first_name: admin.first_name,
    username: admin.username || '',
    level: admin.level
  }
  showEditDialog.value = true
}

const updateAdmin = async () => {
  updating.value = true
  try {
    const admin = adminList.value.find(a => a.id === editForm.value.id)
    if (admin) {
      admin.level = editForm.value.level
      ElMessage.success('更新成功')
      showEditDialog.value = false
    }
  } finally {
    updating.value = false
  }
}

// 移除管理员
const removeAdmin = (admin: Admin) => {
  ElMessageBox.confirm(
    `确定要移除 ${admin.first_name} 的管理员权限吗？`,
    '确认移除',
    { confirmButtonText: '确定', cancelButtonText: '取消', type: 'warning' }
  ).then(() => {
    adminList.value = adminList.value.filter(a => a.id !== admin.id)
    ElMessage.success('已移除')
  }).catch(() => {})
}

// 格式化时间
const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN')
}
</script>

<style scoped lang="scss">
.permissions-page {
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
