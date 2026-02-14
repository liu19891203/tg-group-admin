<template>
  <div class="groups-tab">
    <el-row :gutter="20">
      <el-col :span="24">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>群组列表</span>
              <el-button type="primary" @click="refreshGroups">
                <el-icon><Refresh /></el-icon>
                刷新列表
              </el-button>
            </div>
          </template>

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

            <el-table-column label="操作" width="250" fixed="right">
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
                  type="info"
                  @click="viewDetails(row)"
                >
                  详情
                </el-button>
                <el-button 
                  link 
                  type="danger" 
                  @click="removeGroup(row)"
                >
                  移除
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="groups.length === 0 && !loading" description="暂无群组数据" />
        </el-card>
      </el-col>
    </el-row>

    <!-- 群组详情对话框 -->
    <el-dialog
      v-model="showDetailDialog"
      title="群组详情"
      width="600px"
    >
      <el-descriptions :column="2" border v-if="selectedGroup">
        <el-descriptions-item label="群组名称" :span="2">
          {{ selectedGroup.title }}
        </el-descriptions-item>
        <el-descriptions-item label="群组ID">
          {{ selectedGroup.chat_id }}
        </el-descriptions-item>
        <el-descriptions-item label="群组类型">
          {{ getTypeLabel(selectedGroup.chat_type) }}
        </el-descriptions-item>
        <el-descriptions-item label="成员数量">
          {{ selectedGroup.member_count || 0 }}
        </el-descriptions-item>
        <el-descriptions-item label="当前状态">
          <el-tag :type="selectedGroup.is_active ? 'success' : 'info'">
            {{ selectedGroup.is_active ? '运行中' : '已暂停' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="添加时间">
          {{ formatDate(selectedGroup.created_at) }}
        </el-descriptions-item>
        <el-descriptions-item label="描述" :span="2">
          {{ selectedGroup.description || '暂无描述' }}
        </el-descriptions-item>
      </el-descriptions>
      <template #footer>
        <el-button @click="showDetailDialog = false">关闭</el-button>
        <el-button type="primary" @click="selectGroup(selectedGroup!); showDetailDialog = false">
          选择此群组
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Refresh,
  ChatLineRound
} from '@element-plus/icons-vue'
import axios from 'axios'
import dayjs from 'dayjs'

interface Group {
  id: string
  chat_id: string
  title: string
  chat_type: 'group' | 'supergroup' | 'channel'
  is_active: boolean
  member_count?: number
  avatar_url?: string
  description?: string
  created_at: string
}

const groups = ref<Group[]>([])
const loading = ref(false)
const showDetailDialog = ref(false)
const selectedGroup = ref<Group | null>(null)

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
const refreshGroups = () => {
  loadGroups()
  ElMessage.success('已刷新')
}

// 选择群组
const selectGroup = (group: Group) => {
  localStorage.setItem('selected_group_id', group.id)
  localStorage.setItem('selected_group_title', group.title)
  ElMessage.success(`已选择群组: ${group.title}`)
}

// 切换群组状态
const toggleStatus = async (group: Group) => {
  try {
    const response = await axios.post(`/api/admin/groups/${group.id}/toggle`, {
      is_active: !group.is_active
    })
    if (response.data.success) {
      group.is_active = !group.is_active
      ElMessage.success(group.is_active ? '群组已启动' : '群组已暂停')
    }
  } catch (error) {
    console.error('切换状态失败:', error)
    ElMessage.error('操作失败')
  }
}

// 查看详情
const viewDetails = (group: Group) => {
  selectedGroup.value = group
  showDetailDialog.value = true
}

// 移除群组
const removeGroup = async (group: Group) => {
  try {
    await ElMessageBox.confirm(
      `确定要移除群组 "${group.title}" 吗？此操作不会退出群组，只是从管理列表中移除。`,
      '确认移除',
      {
        confirmButtonText: '移除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )
    
    const response = await axios.delete(`/api/admin/groups/${group.id}`)
    if (response.data.success) {
      groups.value = groups.value.filter(g => g.id !== group.id)
      ElMessage.success('群组已移除')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('移除群组失败:', error)
      ElMessage.error('移除失败')
    }
  }
}

// 获取类型标签
const getTypeLabel = (type: string) => {
  const typeMap: Record<string, string> = {
    'group': '普通群组',
    'supergroup': '超级群组',
    'channel': '频道'
  }
  return typeMap[type] || type
}

// 获取类型标签样式
const getTypeTagType = (type: string) => {
  const typeMap: Record<string, any> = {
    'group': 'info',
    'supergroup': 'success',
    'channel': 'warning'
  }
  return typeMap[type] || 'info'
}

// 格式化日期
const formatDate = (date: string) => {
  return dayjs(date).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadGroups()
})
</script>

<style scoped lang="scss">
.groups-tab {
  padding: 10px 0;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.group-info {
  display: flex;
  align-items: center;
  gap: 12px;
  
  .group-details {
    .group-name {
      font-weight: 500;
      color: #303133;
      margin-bottom: 4px;
    }
    
    .group-id {
      font-size: 12px;
      color: #909399;
    }
  }
}

.member-count {
  font-weight: 600;
  color: #409eff;
}
</style>
