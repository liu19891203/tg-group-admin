<template>
  <div class="groups-page">
    <div class="page-header">
      <h2 class="page-title">群组管理</h2>
      <el-button type="primary" @click="refreshGroups">
        <el-icon><Refresh /></el-icon>
        刷新列表
      </el-button>
    </div>

    <el-card class="groups-card">
      <el-table
        v-loading="loading"
        :data="groups"
        style="width: 100%"
        stripe
      >
        <el-table-column label="群组" min-width="250">
          <template #default="{ row }">
            <div class="group-info">
              <el-avatar 
                :size="40" 
                :src="row.avatar_url || ''"
              >
                <el-icon><ChatLineRound /></el-icon>
              </el-avatar>
              <div class="group-details">
                <div class="group-name">{{ row.title }}</div>
                <div class="group-id">ID: {{ row.chat_id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="类型" width="120">
          <template #default="{ row }">
            <el-tag :type="getTypeTagType(row.chat_type)">
              {{ getTypeLabel(row.chat_type) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'info'" effect="light">
              {{ row.is_active ? '运行中' : '已暂停' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="成员数" width="100" align="center">
          <template #default="{ row }">
            <span class="member-count">{{ row.member_count || 0 }}</span>
          </template>
        </el-table-column>

        <el-table-column label="添加时间" width="180">
          <template #default="{ row }">
            {{ formatDate(row.created_at) }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <el-button 
              link 
              type="primary" 
              @click="selectGroup(row)"
            >
              选择
            </el-button>
            <el-button 
              link 
              :type="row.is_active ? 'warning' : 'success'" 
              @click="toggleStatus(row)"
            >
              {{ row.is_active ? '暂停' : '启动' }}
            </el-button>
            <el-button 
              link 
              type="danger" 
              @click="deleteGroup(row)"
            >
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty v-if="!loading && groups.length === 0" description="暂无群组">
        <template #description>
          <p>暂无群组数据</p>
          <p class="empty-tip">将机器人添加到 Telegram 群组即可自动同步</p>
        </template>
      </el-empty>
    </el-card>

    <!-- 群组统计 -->
    <el-row :gutter="20" class="stats-row">
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ groups.length }}</div>
          <div class="stat-label">总群组数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ activeGroups }}</div>
          <div class="stat-label">运行中</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ inactiveGroups }}</div>
          <div class="stat-label">已暂停</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card class="stat-card">
          <div class="stat-value">{{ totalMembers }}</div>
          <div class="stat-label">总成员数</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Refresh, ChatLineRound } from '@element-plus/icons-vue'
import axios from 'axios'

interface Group {
  id: string
  chat_id: number
  title: string
  username?: string
  chat_type: string
  member_count: number
  is_active: boolean
  avatar_url?: string
  created_at: string
}

const router = useRouter()
const groups = ref<Group[]>([])
const loading = ref(false)

// 统计数据
const activeGroups = computed(() => groups.value.filter(g => g.is_active).length)
const inactiveGroups = computed(() => groups.value.filter(g => !g.is_active).length)
const totalMembers = computed(() => 
  groups.value.reduce((sum, g) => sum + (g.member_count || 0), 0)
)

// 获取群组类型标签
const getTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'group': '普通群组',
    'supergroup': '超级群组',
    'channel': '频道'
  }
  return labels[type] || type
}

const getTypeTagType = (type: string) => {
  const types: Record<string, any> = {
    'group': '',
    'supergroup': 'success',
    'channel': 'warning'
  }
  return types[type] || ''
}

// 格式化日期
const formatDate = (date: string) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

// 加载群组列表
const loadGroups = async () => {
  loading.value = true
  try {
    const response = await axios.get('/api/admin/groups')
    if (response.data.success) {
      groups.value = response.data.data || []
    }
  } catch (error) {
    console.error('加载群组列表失败:', error)
    ElMessage.error('加载群组列表失败')
  } finally {
    loading.value = false
  }
}

// 刷新群组列表
const refreshGroups = async () => {
  await loadGroups()
  ElMessage.success('群组列表已刷新')
}

// 选择群组
const selectGroup = (group: Group) => {
  localStorage.setItem('selected_group_id', group.id)
  ElMessage.success(`已选择群组: ${group.title}`)
  router.push('/')
}

// 切换群组状态
const toggleStatus = async (group: Group) => {
  try {
    const newStatus = !group.is_active
    const response = await axios.put(`/api/admin/groups?id=${group.id}`, {
      is_active: newStatus
    })
    
    if (response.data.success) {
      group.is_active = newStatus
      ElMessage.success(newStatus ? '群组已启动' : '群组已暂停')
    }
  } catch (error) {
    console.error('切换状态失败:', error)
    ElMessage.error('操作失败')
  }
}

// 删除群组
const deleteGroup = async (group: Group) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除群组 "${group.title}" 吗？\n此操作不可恢复。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await axios.delete(`/api/admin/groups?id=${group.id}`)
    
    if (response.data.success) {
      groups.value = groups.value.filter(g => g.id !== group.id)
      ElMessage.success('群组已删除')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除群组失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadGroups()
})
</script>

<style scoped lang="scss">
.groups-page {
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

  .groups-card {
    margin-bottom: 24px;

    .group-info {
      display: flex;
      align-items: center;
      gap: 12px;

      .group-details {
        .group-name {
          font-weight: 500;
          color: #303133;
        }

        .group-id {
          font-size: 12px;
          color: #909399;
          margin-top: 4px;
        }
      }
    }

    .member-count {
      font-weight: 600;
      color: #409eff;
    }

    .empty-tip {
      font-size: 13px;
      color: #909399;
      margin-top: 8px;
    }
  }

  .stats-row {
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
}
</style>
