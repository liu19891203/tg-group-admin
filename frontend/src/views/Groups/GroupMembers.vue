<template>
  <div class="group-members-page">
    <div class="page-header">
      <h2 class="page-title">群组成员</h2>
      <el-button type="primary" @click="showImportDialog">
        <el-icon><Download /></el-icon>
        导入成员
      </el-button>
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
      <!-- 统计卡片 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-value">{{ stats.total }}</div>
            <div class="stat-label">总成员</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-value">{{ stats.admins }}</div>
            <div class="stat-label">管理员</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-value">{{ stats.newToday }}</div>
            <div class="stat-label">今日新增</div>
          </el-card>
        </el-col>
        <el-col :span="6">
          <el-card class="stat-card">
            <div class="stat-value">{{ stats.accountChanges }}</div>
            <div class="stat-label">账号变更</div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 成员列表 -->
      <el-card class="members-card">
        <template #header>
          <div class="card-header">
            <div class="header-left">
              <el-input
                v-model="searchQuery"
                placeholder="搜索成员..."
                clearable
                style="width: 250px"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
              <el-select v-model="roleFilter" placeholder="角色筛选" clearable style="width: 120px; margin-left: 12px">
                <el-option label="全部" value="" />
                <el-option label="群主" value="owner" />
                <el-option label="管理员" value="admin" />
                <el-option label="成员" value="member" />
              </el-select>
            </div>
            <div class="header-right">
              <el-button link @click="showAccountChangeHistory">
                <el-icon><Timer /></el-icon>
                账号变更记录
              </el-button>
            </div>
          </div>
        </template>

        <el-table
          v-loading="loading"
          :data="members"
          style="width: 100%"
          stripe
        >
          <el-table-column label="用户信息" min-width="200">
            <template #default="{ row }">
              <div class="user-info">
                <el-avatar :size="40" :src="row.avatar_url">
                  <el-icon><UserFilled /></el-icon>
                </el-avatar>
                <div class="user-details">
                  <div class="nickname">{{ row.nickname || '未设置昵称' }}</div>
                  <div class="username">@{{ row.username || '无用户名' }}</div>
                </div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="角色" width="120">
            <template #default="{ row }">
              <el-tag :type="getRoleType(row.role)" effect="dark">
                {{ getRoleLabel(row.role) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="加入时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.joined_at) }}
            </template>
          </el-table-column>

          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="viewMemberDetail(row)">
                详情
              </el-button>
              <el-button link type="warning" @click="setMemberRole(row)">
                设置角色
              </el-button>
              <el-button link type="danger" @click="removeMember(row)">
                移除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 分页 -->
        <div class="pagination-container">
          <el-pagination
            v-model:current-page="currentPage"
            v-model:page-size="pageSize"
            :total="total"
            :page-sizes="[10, 20, 50, 100]"
            layout="total, sizes, prev, pager, next"
            @size-change="handleSizeChange"
            @current-change="handleCurrentChange"
          />
        </div>

        <el-empty v-if="!loading && members.length === 0" description="暂无成员" />
      </el-card>
    </template>

    <!-- 账号变更历史对话框 -->
    <el-dialog v-model="historyVisible" title="账号变更记录" width="700px">
      <el-timeline v-if="nicknameHistory.length > 0">
        <el-timeline-item
          v-for="item in nicknameHistory"
          :key="item.id"
          :timestamp="formatTime(item.changed_at)"
          type="info"
        >
          <el-card class="history-item">
            <div class="nickname-change">
              <span class="old-name">{{ item.old_nickname || '无昵称' }}</span>
              <el-icon><ArrowRight /></el-icon>
              <span class="new-name">{{ item.new_nickname || '无昵称' }}</span>
            </div>
            <div class="change-meta">
              用户ID: {{ item.telegram_user_id }}
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无昵称变更记录" />
    </el-dialog>

    <!-- 设置角色对话框 -->
    <el-dialog v-model="roleDialogVisible" title="设置成员角色" width="400px">
      <el-form :model="roleForm" label-width="80px">
        <el-form-item label="当前角色">
          <el-tag :type="getRoleType(roleForm.currentRole)">
            {{ getRoleLabel(roleForm.currentRole) }}
          </el-tag>
        </el-form-item>
        <el-form-item label="新角色">
          <el-select v-model="roleForm.newRole" placeholder="选择角色" style="width: 100%">
            <el-option label="成员" value="member" />
            <el-option label="管理员" value="admin" />
            <el-option label="群主" value="owner" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="roleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="confirmSetRole" :loading="settingRole">
          确定
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed, watch } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Download,
  Search,
  Timer,
  UserFilled,
  ArrowRight
} from '@element-plus/icons-vue'
import axios from 'axios'
import dayjs from 'dayjs'

interface GroupMember {
  id: string
  group_id: string
  telegram_user_id: number
  username: string
  nickname: string
  role: 'owner' | 'admin' | 'member'
  avatar_url?: string
  joined_at: string
  nickname_changed_at?: string
  username_changed_at?: string
}

interface NicknameHistoryItem {
  id: string
  telegram_user_id: number
  old_nickname: string
  new_nickname: string
  changed_at: string
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const loading = ref(false)
const members = ref<GroupMember[]>([])
const total = ref(0)
const currentPage = ref(1)
const pageSize = ref(20)
const searchQuery = ref('')
const roleFilter = ref('')

const stats = reactive({
  total: 0,
  admins: 0,
  newToday: 0,
  accountChanges: 0
})

const historyVisible = ref(false)
const nicknameHistory = ref<NicknameHistoryItem[]>([])

const roleDialogVisible = ref(false)
const settingRole = ref(false)
const roleForm = reactive({
  memberId: '',
  currentRole: '',
  newRole: ''
})

// 获取角色标签
const getRoleLabel = (role: string) => {
  const labels: Record<string, string> = {
    'owner': '群主',
    'admin': '管理员',
    'member': '成员'
  }
  return labels[role] || role
}

const getRoleType = (role: string) => {
  const types: Record<string, any> = {
    'owner': 'danger',
    'admin': 'warning',
    'member': ''
  }
  return types[role] || ''
}

// 格式化时间
const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

// 加载成员列表
const loadMembers = async () => {
  if (!selectedGroupId.value) return

  loading.value = true
  try {
    const params = new URLSearchParams({
      group_id: selectedGroupId.value,
      page: currentPage.value.toString(),
      limit: pageSize.value.toString()
    })

    if (searchQuery.value) {
      params.append('search', searchQuery.value)
    }
    if (roleFilter.value) {
      params.append('role', roleFilter.value)
    }

    const response = await axios.get(`/api/admin/group-members?${params}`)
    if (response.data.success) {
      members.value = response.data.data
      total.value = response.data.pagination.total
    }
  } catch (error) {
    console.error('加载成员失败:', error)
    ElMessage.error('加载成员失败')
  } finally {
    loading.value = false
  }
}

// 加载统计数据
const loadStats = async () => {
  if (!selectedGroupId.value) return

  try {
    // 这里应该调用专门的统计API，暂时用模拟数据
    stats.total = members.value.length
    stats.admins = members.value.filter(m => m.role === 'admin').length
    stats.newToday = members.value.filter(m => {
      const joinedDate = dayjs(m.joined_at)
      return joinedDate.isSame(dayjs(), 'day')
    }).length
    // 账号变更统计（昵称或用户名变更）
    stats.accountChanges = members.value.filter(m => {
      return m.nickname_changed_at || m.username_changed_at
    }).length
  } catch (error) {
    console.error('加载统计失败:', error)
  }
}

// 显示账号变更历史
const showAccountChangeHistory = async () => {
  if (!selectedGroupId.value) return

  try {
    const response = await axios.get(`/api/admin/account-change-history?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      nicknameHistory.value = response.data.data || []
      historyVisible.value = true
    }
  } catch (error) {
    console.error('加载账号变更历史失败:', error)
    ElMessage.error('加载失败')
  }
}

// 查看成员详情
const viewMemberDetail = (member: GroupMember) => {
  // 可以跳转到成员详情页或显示对话框
  ElMessage.info(`查看成员 ${member.nickname || member.username} 的详情`)
}

// 设置成员角色
const setMemberRole = (member: GroupMember) => {
  roleForm.memberId = member.id
  roleForm.currentRole = member.role
  roleForm.newRole = member.role
  roleDialogVisible.value = true
}

// 确认设置角色
const confirmSetRole = async () => {
  if (roleForm.newRole === roleForm.currentRole) {
    roleDialogVisible.value = false
    return
  }

  settingRole.value = true
  try {
    const response = await axios.put(`/api/admin/group-members?id=${roleForm.memberId}`, {
      role: roleForm.newRole
    })

    if (response.data.success) {
      ElMessage.success('角色设置成功')
      roleDialogVisible.value = false
      loadMembers()
    }
  } catch (error) {
    console.error('设置角色失败:', error)
    ElMessage.error('设置失败')
  } finally {
    settingRole.value = false
  }
}

// 移除成员
const removeMember = async (member: GroupMember) => {
  try {
    await ElMessageBox.confirm(
      `确定要移除成员 "${member.nickname || member.username}" 吗？`,
      '确认移除',
      {
        confirmButtonText: '移除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await axios.delete(`/api/admin/group-members?id=${member.id}`)

    if (response.data.success) {
      members.value = members.value.filter(m => m.id !== member.id)
      total.value--
      ElMessage.success('成员已移除')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('移除成员失败:', error)
      ElMessage.error('移除失败')
    }
  }
}

// 显示导入对话框
const showImportDialog = () => {
  ElMessage.info('导入功能开发中...')
}

// 分页处理
const handleSizeChange = (val: number) => {
  pageSize.value = val
  currentPage.value = 1
  loadMembers()
}

const handleCurrentChange = (val: number) => {
  currentPage.value = val
  loadMembers()
}

// 监听搜索和筛选
watch([searchQuery, roleFilter], () => {
  currentPage.value = 1
  loadMembers()
})

onMounted(() => {
  loadMembers()
})
</script>

<style scoped lang="scss">
.group-members-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }
  }

  .stats-row {
    margin-bottom: 24px;

    .stat-card {
      text-align: center;

      .stat-value {
        font-size: 32px;
        font-weight: 700;
        color: #409eff;
        margin-bottom: 8px;
      }

      .stat-label {
        font-size: 14px;
        color: #606266;
      }
    }
  }

  .members-card {
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;

      .header-left {
        display: flex;
        align-items: center;
      }
    }

    .user-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .user-details {
        .nickname {
          font-weight: 500;
          color: #303133;
        }

        .username {
          font-size: 12px;
          color: #909399;
        }
      }
    }

    .pagination-container {
      display: flex;
      justify-content: flex-end;
      margin-top: 20px;
    }
  }

  .history-item {
    .nickname-change {
      display: flex;
      align-items: center;
      gap: 12px;
      font-size: 14px;

      .old-name {
        color: #909399;
        text-decoration: line-through;
      }

      .new-name {
        color: #409eff;
        font-weight: 500;
      }
    }

    .change-meta {
      margin-top: 8px;
      font-size: 12px;
      color: #909399;
    }
  }

  .mb-4 {
    margin-bottom: 16px;
  }
}
</style>
