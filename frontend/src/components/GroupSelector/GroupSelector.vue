<template>
  <div class="group-selector">
    <el-dropdown trigger="click" @command="handleGroupChange">
      <div class="selected-group">
        <el-avatar 
          :size="32" 
          :src="currentGroup?.avatar_url || ''"
          class="group-avatar"
        >
          <el-icon><ChatLineRound /></el-icon>
        </el-avatar>
        <div class="group-info">
          <div class="group-name">{{ currentGroup?.title || '选择群组' }}</div>
          <div class="group-type" v-if="currentGroup">
            {{ currentGroup.member_count }} 成员 · {{ getGroupTypeLabel(currentGroup.chat_type) }}
          </div>
        </div>
        <el-icon class="dropdown-icon"><ArrowDown /></el-icon>
      </div>
      
      <template #dropdown>
        <el-dropdown-menu class="group-dropdown-menu">
          <!-- 搜索框 -->
          <div class="search-box">
            <el-input
              v-model="searchQuery"
              placeholder="搜索群组..."
              prefix-icon="Search"
              size="small"
              clearable
            />
          </div>
          
          <!-- 群组列表 -->
          <div class="groups-list">
            <el-dropdown-item
              v-for="group in filteredGroups"
              :key="group.id"
              :command="group.id"
              :class="{ active: currentGroup?.id === group.id }"
            >
              <div class="group-item">
                <el-avatar 
                  :size="28" 
                  :src="group.avatar_url || ''"
                >
                  <el-icon><ChatLineRound /></el-icon>
                </el-avatar>
                <div class="group-item-info">
                  <div class="group-item-name">{{ group.title }}</div>
                  <div class="group-item-meta">
                    {{ group.member_count }} 成员
                    <el-tag 
                      v-if="group.is_active" 
                      type="success" 
                      size="small"
                      effect="plain"
                    >
                      运行中
                    </el-tag>
                    <el-tag 
                      v-else 
                      type="info" 
                      size="small"
                      effect="plain"
                    >
                      已暂停
                    </el-tag>
                  </div>
                </div>
                <el-icon v-if="currentGroup?.id === group.id" class="check-icon"><Check /></el-icon>
              </div>
            </el-dropdown-item>
          </div>
          
          <!-- 空状态 -->
          <div v-if="filteredGroups.length === 0" class="empty-state">
            <el-icon><InfoFilled /></el-icon>
            <span>没有找到群组</span>
          </div>
          
          <!-- 底部操作 -->
          <div class="dropdown-footer">
            <el-button link size="small" @click="refreshGroups">
              <el-icon><Refresh /></el-icon>
              刷新列表
            </el-button>
            <el-button link size="small" type="primary" @click="goToGroups">
              管理群组
            </el-button>
          </div>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ChatLineRound, ArrowDown, Check, Search, Refresh, InfoFilled } from '@element-plus/icons-vue'
import api from '@/api'

interface Group {
  id: string
  chat_id: number
  title: string
  username?: string
  chat_type: string
  member_count: number
  is_active: boolean
  avatar_url?: string
  invite_link?: string
}

const props = defineProps<{
  modelValue?: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'change': [group: Group]
}>()

const router = useRouter()
const groups = ref<Group[]>([])
const currentGroupId = ref<string>(props.modelValue || '')
const searchQuery = ref('')
const loading = ref(false)

// 当前选中的群组
const currentGroup = computed(() => {
  return groups.value.find(g => g.id === currentGroupId.value)
})

// 过滤后的群组列表
const filteredGroups = computed(() => {
  if (!searchQuery.value) return groups.value
  const query = searchQuery.value.toLowerCase()
  return groups.value.filter(group => 
    group.title.toLowerCase().includes(query) ||
    group.username?.toLowerCase().includes(query)
  )
})

// 获取群组类型标签
const getGroupTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'group': '普通群组',
    'supergroup': '超级群组',
    'channel': '频道'
  }
  return labels[type] || type
}

// 加载群组列表
const loadGroups = async () => {
  loading.value = true
  try {
    const response = await api.get<{ data: Group[]; total: number; page: number; limit: number }>('/admin/groups')
    if (response.data) {
      groups.value = response.data || []
      
      // 如果没有选中群组，默认选中第一个
      if (!currentGroupId.value && groups.value.length > 0) {
        currentGroupId.value = groups.value[0].id
        emit('update:modelValue', currentGroupId.value)
        emit('change', groups.value[0])
      }
    }
  } catch (error) {
    console.error('加载群组列表失败:', error)
    ElMessage.error('加载群组列表失败')
  } finally {
    loading.value = false
  }
}

// 处理群组切换
const handleGroupChange = (groupId: string) => {
  currentGroupId.value = groupId
  const group = groups.value.find(g => g.id === groupId)
  if (group) {
    emit('update:modelValue', groupId)
    emit('change', group)
    
    // 保存到本地存储
    localStorage.setItem('selected_group_id', groupId)
    
    ElMessage.success(`已切换到: ${group.title}`)
  }
}

// 刷新群组列表
const refreshGroups = async () => {
  await loadGroups()
  ElMessage.success('群组列表已刷新')
}

// 跳转到群组管理
const goToGroups = () => {
  router.push('/groups')
}

// 监听 props 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal && newVal !== currentGroupId.value) {
    currentGroupId.value = newVal
  }
})

onMounted(() => {
  // 从本地存储恢复选中的群组
  const savedGroupId = localStorage.getItem('selected_group_id')
  if (savedGroupId) {
    currentGroupId.value = savedGroupId
  }
  
  loadGroups()
})
</script>

<style scoped lang="scss">
.group-selector {
  display: inline-block;
}

.selected-group {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 16px;
  background: #f5f7fa;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.3s;
  min-width: 240px;

  &:hover {
    background: #e4e7ed;
  }

  .group-avatar {
    flex-shrink: 0;
  }

  .group-info {
    flex: 1;
    min-width: 0;

    .group-name {
      font-weight: 500;
      font-size: 14px;
      color: #303133;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .group-type {
      font-size: 12px;
      color: #909399;
      margin-top: 2px;
    }
  }

  .dropdown-icon {
    color: #909399;
    transition: transform 0.3s;
  }

  &:hover .dropdown-icon {
    transform: rotate(180deg);
  }
}

.group-dropdown-menu {
  width: 320px;
  padding: 0;

  .search-box {
    padding: 12px;
    border-bottom: 1px solid #ebeef5;
  }

  .groups-list {
    max-height: 300px;
    overflow-y: auto;

    :deep(.el-dropdown-menu__item) {
      padding: 0;
      
      &.active {
        background: #ecf5ff;
      }

      &:hover {
        background: #f5f7fa;
      }
    }
  }

  .group-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 16px;
    width: 100%;

    .group-item-info {
      flex: 1;
      min-width: 0;

      .group-item-name {
        font-size: 14px;
        font-weight: 500;
        color: #303133;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }

      .group-item-meta {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 12px;
        color: #909399;
        margin-top: 4px;

        .el-tag {
          font-size: 11px;
          height: 18px;
          padding: 0 6px;
        }
      }
    }

    .check-icon {
      color: #409eff;
      font-size: 16px;
    }
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    padding: 32px 16px;
    color: #909399;

    .el-icon {
      font-size: 32px;
    }

    span {
      font-size: 13px;
    }
  }

  .dropdown-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 16px;
    border-top: 1px solid #ebeef5;
    background: #f5f7fa;
  }
}
</style>
