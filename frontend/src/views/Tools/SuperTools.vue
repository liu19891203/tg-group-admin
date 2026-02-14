<template>
  <div class="super-tools-page">
    <div class="page-header">
      <h2 class="page-title">超级傻瓜功能</h2>
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
      <!-- 状态概览 -->
      <el-row :gutter="20" class="stats-row">
        <el-col :span="8">
          <el-card class="stat-card warning">
            <div class="stat-value">{{ status.deleted_accounts_count || 0 }}</div>
            <div class="stat-label">已删除账户</div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="stat-card info">
            <div class="stat-value">{{ status.old_messages_count || 0 }}</div>
            <div class="stat-label">可清理历史消息</div>
          </el-card>
        </el-col>
        <el-col :span="8">
          <el-card class="stat-card success">
            <div class="stat-value">{{ status.last_cleanup || '从未' }}</div>
            <div class="stat-label">上次清理</div>
          </el-card>
        </el-col>
      </el-row>

      <!-- 工具列表 -->
      <el-row :gutter="20">
        <!-- 删除历史消息 -->
        <el-col :span="8">
          <el-card class="tool-card">
            <template #header>
              <div class="tool-header">
                <el-icon :size="24" color="#f56c6c"><Delete /></el-icon>
                <span>删除历史消息</span>
              </div>
            </template>
            
            <div class="tool-desc">
              批量删除群组中的历史消息，支持按时间、用户、消息类型筛选
            </div>

            <el-form :model="deleteHistoryForm" label-position="top">
              <el-form-item label="删除多少天前的消息">
                <el-input-number v-model="deleteHistoryForm.days" :min="1" :max="365" style="width: 100%" />
              </el-form-item>

              <el-form-item label="指定用户（可选）">
                <el-input v-model="deleteHistoryForm.user_id" placeholder="用户ID" />
              </el-form-item>

              <el-form-item>
                <el-button 
                  type="danger" 
                  @click="executeTool('delete_history', deleteHistoryForm)"
                  :loading="executing === 'delete_history'"
                  style="width: 100%"
                >
                  <el-icon><Delete /></el-icon>
                  开始删除
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>

        <!-- 踢出已删除账户 -->
        <el-col :span="8">
          <el-card class="tool-card">
            <template #header>
              <div class="tool-header">
                <el-icon :size="24" color="#e6a23c"><UserFilled /></el-icon>
                <span>踢出已删除账户</span>
              </div>
            </template>
            
            <div class="tool-desc">
              清理群组中已删除 Telegram 账户的成员，释放群组空间
            </div>

            <div class="tool-info">
              <el-statistic title="待清理账户" :value="status.deleted_accounts_count || 0" />
            </div>

            <el-button 
              type="warning" 
              @click="executeTool('kick_deleted_accounts', {})"
              :loading="executing === 'kick_deleted_accounts'"
              :disabled="!status.deleted_accounts_count"
              style="width: 100%; margin-top: 20px"
            >
              <el-icon><CircleClose /></el-icon>
              开始清理
            </el-button>
          </el-card>
        </el-col>

        <!-- 清理不活跃成员 -->
        <el-col :span="8">
          <el-card class="tool-card">
            <template #header>
              <div class="tool-header">
                <el-icon :size="24" color="#909399"><Timer /></el-icon>
                <span>清理不活跃成员</span>
              </div>
            </template>
            
            <div class="tool-desc">
              移除长期不活跃的群组成员，保持群组活跃度
            </div>

            <el-form :model="cleanInactiveForm" label-position="top">
              <el-form-item label="不活跃天数">
                <el-input-number v-model="cleanInactiveForm.inactive_days" :min="7" :max="365" style="width: 100%" />
                <div class="form-tip">超过此天数未发言的成员将被清理</div>
              </el-form-item>

              <el-form-item>
                <el-button 
                  type="info" 
                  @click="executeTool('clean_inactive', cleanInactiveForm)"
                  :loading="executing === 'clean_inactive'"
                  style="width: 100%"
                >
                  <el-icon><Remove /></el-icon>
                  开始清理
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>

      <!-- 操作日志 -->
      <el-card class="logs-card">
        <template #header>
          <div class="card-header">
            <span>操作日志</span>
            <el-button link @click="loadLogs">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </template>

        <el-timeline v-if="logs.length > 0">
          <el-timeline-item
            v-for="log in logs"
            :key="log.id"
            :timestamp="formatTime(log.created_at)"
            :type="getLogType(log.action)"
          >
            <el-card class="log-item">
              <div class="log-header">
                <el-tag :type="getLogType(log.action)" effect="dark">
                  {{ getActionLabel(log.action) }}
                </el-tag>
                <span class="log-time">{{ formatTime(log.created_at) }}</span>
              </div>
              <div class="log-result" v-if="log.result">
                <div v-if="log.result.deleted_count !== undefined">
                  成功删除: {{ log.result.deleted_count }} 条消息
                  <span v-if="log.result.failed_count > 0" class="fail-count">
                    失败: {{ log.result.failed_count }} 条
                  </span>
                </div>
                <div v-if="log.result.kicked_count !== undefined">
                  成功踢出: {{ log.result.kicked_count }} 人
                  <span v-if="log.result.failed_count > 0" class="fail-count">
                    失败: {{ log.result.failed_count }} 人
                  </span>
                </div>
              </div>
            </el-card>
          </el-timeline-item>
        </el-timeline>

        <el-empty v-else description="暂无操作记录" />
      </el-card>
    </template>

    <!-- 执行结果对话框 -->
    <el-dialog v-model="resultVisible" title="执行结果" width="400px">
      <div v-if="lastResult" class="result-content">
        <el-result
          :icon="lastResult.failed_count === 0 ? 'success' : 'warning'"
          :title="lastResult.failed_count === 0 ? '执行成功' : '部分成功'"
        >
          <template #sub-title>
            <div v-if="lastResult.deleted_count !== undefined">
              成功删除 {{ lastResult.deleted_count }} 条消息
              <div v-if="lastResult.failed_count > 0" class="fail-text">
                失败 {{ lastResult.failed_count }} 条
              </div>
            </div>
            <div v-if="lastResult.kicked_count !== undefined">
              成功踢出 {{ lastResult.kicked_count }} 人
              <div v-if="lastResult.failed_count > 0" class="fail-text">
                失败 {{ lastResult.failed_count }} 人
              </div>
            </div>
          </template>
        </el-result>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Delete,
  UserFilled,
  CircleClose,
  Timer,
  Remove,
  Refresh
} from '@element-plus/icons-vue'
import axios from 'axios'
import dayjs from 'dayjs'

interface SuperToolLog {
  id: string
  action: string
  params: any
  result: any
  created_at: string
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const loading = ref(false)
const executing = ref<string | null>(null)
const status = reactive({
  deleted_accounts_count: 0,
  old_messages_count: 0,
  last_cleanup: null as string | null
})

const logs = ref<SuperToolLog[]>([])
const resultVisible = ref(false)
const lastResult = ref<any>(null)

const deleteHistoryForm = reactive({
  days: 7,
  user_id: '',
  message_type: ''
})

const cleanInactiveForm = reactive({
  inactive_days: 30
})

// 获取操作标签
const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    'delete_history': '删除历史消息',
    'kick_deleted_accounts': '踢出已删除账户',
    'clean_inactive': '清理不活跃成员'
  }
  return labels[action] || action
}

const getLogType = (action: string) => {
  const types: Record<string, any> = {
    'delete_history': 'danger',
    'kick_deleted_accounts': 'warning',
    'clean_inactive': 'info'
  }
  return types[action] || ''
}

// 格式化时间
const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 加载状态
const loadStatus = async () => {
  if (!selectedGroupId.value) return

  try {
    const response = await axios.get(`/api/admin/super-tools?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      Object.assign(status, response.data.data)
    }
  } catch (error) {
    console.error('加载状态失败:', error)
  }
}

// 加载日志
const loadLogs = async () => {
  if (!selectedGroupId.value) return

  try {
    const response = await axios.get(`/api/admin/super-tools/logs?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      logs.value = response.data.data || []
    }
  } catch (error) {
    console.error('加载日志失败:', error)
  }
}

// 执行工具
const executeTool = async (action: string, params: any) => {
  const actionLabels: Record<string, string> = {
    'delete_history': '删除历史消息',
    'kick_deleted_accounts': '踢出已删除账户',
    'clean_inactive': '清理不活跃成员'
  }

  try {
    await ElMessageBox.confirm(
      `确定要执行 "${actionLabels[action]}" 操作吗？此操作不可撤销。`,
      '确认执行',
      {
        confirmButtonText: '确认执行',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    executing.value = action
    const response = await axios.post('/api/admin/super-tools', {
      group_id: selectedGroupId.value,
      action,
      params
    })

    if (response.data.success) {
      lastResult.value = response.data.data
      resultVisible.value = true
      loadStatus()
      loadLogs()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('执行失败:', error)
      ElMessage.error('执行失败')
    }
  } finally {
    executing.value = null
  }
}

onMounted(() => {
  loadStatus()
  loadLogs()
})
</script>

<style scoped lang="scss">
.super-tools-page {
  .page-header {
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

      &.warning .stat-value {
        color: #e6a23c;
      }

      &.info .stat-value {
        color: #409eff;
      }

      &.success .stat-value {
        color: #67c23a;
      }

      .stat-value {
        font-size: 32px;
        font-weight: 700;
        margin-bottom: 8px;
      }

      .stat-label {
        font-size: 14px;
        color: #606266;
      }
    }
  }

  .tool-card {
    height: 100%;

    .tool-header {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 16px;
    }

    .tool-desc {
      color: #606266;
      font-size: 14px;
      margin-bottom: 20px;
      line-height: 1.6;
    }

    .tool-info {
      background: #f5f7fa;
      padding: 16px;
      border-radius: 8px;
      text-align: center;
    }

    .form-tip {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
  }

  .logs-card {
    margin-top: 24px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .log-item {
      margin-bottom: 8px;

      .log-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;

        .log-time {
          font-size: 12px;
          color: #909399;
        }
      }

      .log-result {
        font-size: 14px;
        color: #606266;

        .fail-count {
          color: #f56c6c;
          margin-left: 12px;
        }
      }
    }
  }

  .result-content {
    .fail-text {
      color: #f56c6c;
      margin-top: 8px;
    }
  }

  .mb-4 {
    margin-bottom: 16px;
  }
}
</style>
