<template>
  <div class="porn-detection-page">
    <div class="page-header">
      <h2 class="page-title">色情内容检测</h2>
      <p class="page-desc">配置群组色情内容检测的灵敏度和处理方式</p>
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
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="config-form"
      >
        <!-- 启用开关 -->
        <el-card class="section-card">
          <template #header>
            <div class="section-header">
              <span>功能开关</span>
              <el-switch v-model="form.enabled" active-text="启用检测" />
            </div>
          </template>

          <el-alert
            v-if="form.enabled"
            title="色情内容检测已启用"
            type="success"
            :closable="false"
            show-icon
            class="mb-4"
          />
          <el-alert
            v-else
            title="色情内容检测已禁用"
            type="info"
            :closable="false"
            show-icon
            class="mb-4"
          />
        </el-card>

        <!-- 灵敏度设置 -->
        <el-card class="section-card">
          <template #header>
            <span>灵敏度设置</span>
          </template>

          <el-form-item label="检测灵敏度">
            <el-radio-group v-model="form.sensitivity" size="large">
              <el-radio-button label="low">
                <el-icon><CircleCheck /></el-icon>
                宽松
              </el-radio-button>
              <el-radio-button label="medium">
                <el-icon><Warning /></el-icon>
                中等
              </el-radio-button>
              <el-radio-button label="high">
                <el-icon><CircleClose /></el-icon>
                严格
              </el-radio-button>
            </el-radio-group>
            <div class="form-tip">
              <template v-if="form.sensitivity === 'low'">
                宽松模式：仅检测明显的色情内容，误报率低
              </template>
              <template v-else-if="form.sensitivity === 'medium'">
                中等模式：平衡检测精度和误报率
              </template>
              <template v-else>
                严格模式：检测所有可疑内容，可能会误删正常图片
              </template>
            </div>
          </el-form-item>

          <el-form-item label="延迟删除时间（秒）">
            <el-slider
              v-model="form.delete_delay_seconds"
              :max="60"
              :step="5"
              show-stops
              show-input
            />
            <div class="form-tip">
              设置延迟时间后，违规消息会在指定时间后才被删除，给用户查看的机会
            </div>
          </el-form-item>
        </el-card>

        <!-- 检测类型 -->
        <el-card class="section-card">
          <template #header>
            <span>检测内容类型</span>
          </template>

          <el-form-item>
            <el-checkbox v-model="form.check_images" label="检测图片" border />
            <el-checkbox v-model="form.check_videos" label="检测视频" border />
            <el-checkbox v-model="form.check_stickers" label="检测贴纸" border />
            <el-checkbox v-model="form.check_documents" label="检测文档" border />
          </el-form-item>
        </el-card>

        <!-- 处理方式 -->
        <el-card class="section-card">
          <template #header>
            <span>处理方式</span>
          </template>

          <el-form-item label="检测到违规内容后的操作">
            <el-radio-group v-model="form.action" size="large">
              <el-radio-button label="delete">
                <el-icon><Delete /></el-icon>
                删除消息
              </el-radio-button>
              <el-radio-button label="mute">
                <el-icon><Mute /></el-icon>
                禁言用户
              </el-radio-button>
              <el-radio-button label="ban">
                <el-icon><Remove /></el-icon>
                封禁用户
              </el-radio-button>
              <el-radio-button label="warn">
                <el-icon><Warning /></el-icon>
                仅警告
              </el-radio-button>
            </el-radio-group>
          </el-form-item>

          <el-form-item v-if="form.action === 'mute'" label="禁言时长">
            <el-select v-model="form.mute_duration" style="width: 200px">
              <el-option label="1小时" :value="3600" />
              <el-option label="6小时" :value="21600" />
              <el-option label="12小时" :value="43200" />
              <el-option label="1天" :value="86400" />
              <el-option label="3天" :value="259200" />
              <el-option label="7天" :value="604800" />
            </el-select>
          </el-form-item>

          <el-form-item label="警告消息">
            <el-input
              v-model="form.warning_message"
              type="textarea"
              :rows="3"
              placeholder="输入警告消息内容"
            />
            <div class="form-tip">
              支持使用 {user} 表示用户名，{group} 表示群组名
            </div>
          </el-form-item>
        </el-card>

        <!-- 高级设置 -->
        <el-card class="section-card">
          <template #header>
            <span>高级设置</span>
          </template>

          <el-form-item>
            <el-checkbox v-model="form.notify_admins" label="通知管理员" />
            <div class="form-tip">检测到违规内容时向群组管理员发送通知</div>
          </el-form-item>

          <el-form-item>
            <el-checkbox v-model="form.log_only" label="仅记录不删除" />
            <div class="form-tip">只记录检测结果，不执行任何删除或惩罚操作</div>
          </el-form-item>

          <el-form-item label="白名单用户">
            <el-select
              v-model="form.whitelist_users"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="输入用户ID"
              style="width: 100%"
            />
            <div class="form-tip">白名单用户发送的内容不会被检测</div>
          </el-form-item>
        </el-card>

        <!-- 保存按钮 -->
        <div class="form-actions">
          <el-button type="primary" size="large" @click="handleSave" :loading="saving">
            <el-icon><Check /></el-icon>
            保存配置
          </el-button>
          <el-button size="large" @click="handleReset">
            <el-icon><RefreshLeft /></el-icon>
            重置
          </el-button>
        </div>
      </el-form>

      <!-- 检测日志 -->
      <el-card class="logs-card">
        <template #header>
          <div class="card-header">
            <span>检测日志</span>
            <el-button link @click="loadLogs">
              <el-icon><Refresh /></el-icon>
              刷新
            </el-button>
          </div>
        </template>

        <el-table :data="logs" v-loading="logsLoading" stripe>
          <el-table-column prop="created_at" label="时间" width="180">
            <template #default="{ row }">
              {{ formatTime(row.created_at) }}
            </template>
          </el-table-column>
          <el-table-column prop="telegram_user_id" label="用户ID" width="120" />
          <el-table-column prop="content_type" label="内容类型" width="100">
            <template #default="{ row }">
              <el-tag :type="getContentTypeType(row.content_type)">
                {{ getContentTypeLabel(row.content_type) }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column prop="detection_score" label="检测分数" width="120">
            <template #default="{ row }">
              <el-progress
                :percentage="Math.round(row.detection_score * 100)"
                :color="getScoreColor(row.detection_score)"
                :stroke-width="10"
              />
            </template>
          </el-table-column>
          <el-table-column prop="action_taken" label="处理结果" width="120">
            <template #default="{ row }">
              <el-tag :type="getActionType(row.action_taken)">
                {{ getActionLabel(row.action_taken) }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <el-empty v-if="logs.length === 0 && !logsLoading" description="暂无检测记录" />
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, FormInstance } from 'element-plus'
import {
  CircleCheck,
  Warning,
  CircleClose,
  Delete,
  Mute,
  Remove,
  Check,
  RefreshLeft,
  Refresh
} from '@element-plus/icons-vue'
import axios from 'axios'
import dayjs from 'dayjs'

interface PornDetectionLog {
  id: string
  telegram_user_id: string
  content_type: string
  detection_score: number
  action_taken: string
  created_at: string
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const formRef = ref<FormInstance>()
const loading = ref(false)
const saving = ref(false)
const logsLoading = ref(false)
const logs = ref<PornDetectionLog[]>([])

const form = reactive({
  enabled: false,
  sensitivity: 'medium',
  delete_delay_seconds: 0,
  action: 'delete',
  mute_duration: 3600,
  check_images: true,
  check_videos: true,
  check_stickers: true,
  check_documents: false,
  warning_message: '检测到违规内容，消息已被删除。',
  whitelist_users: [],
  notify_admins: true,
  log_only: false
})

const rules = {
  // 添加验证规则
}

// 获取内容类型标签
const getContentTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    'image': '图片',
    'video': '视频',
    'sticker': '贴纸',
    'document': '文档'
  }
  return labels[type] || type
}

const getContentTypeType = (type: string) => {
  const types: Record<string, any> = {
    'image': 'success',
    'video': 'warning',
    'sticker': 'info',
    'document': ''
  }
  return types[type] || ''
}

// 获取处理标签
const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    'delete': '删除',
    'mute': '禁言',
    'ban': '封禁',
    'warn': '警告'
  }
  return labels[action] || action
}

const getActionType = (action: string) => {
  const types: Record<string, any> = {
    'delete': 'danger',
    'mute': 'warning',
    'ban': 'danger',
    'warn': 'info'
  }
  return types[action] || ''
}

// 获取分数颜色
const getScoreColor = (score: number) => {
  if (score >= 0.8) return '#f56c6c'
  if (score >= 0.5) return '#e6a23c'
  return '#67c23a'
}

// 格式化时间
const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

// 加载配置
const loadConfig = async () => {
  if (!selectedGroupId.value) return

  loading.value = true
  try {
    const response = await axios.get(`/api/admin/porn-detection?group_id=${selectedGroupId.value}`)
    if (response.data.success && response.data.data) {
      Object.assign(form, response.data.data)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    ElMessage.error('加载配置失败')
  } finally {
    loading.value = false
  }
}

// 加载日志
const loadLogs = async () => {
  if (!selectedGroupId.value) return

  logsLoading.value = true
  try {
    const response = await axios.get(`/api/admin/porn-detection/logs?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      logs.value = response.data.data || []
    }
  } catch (error) {
    console.error('加载日志失败:', error)
  } finally {
    logsLoading.value = false
  }
}

// 保存配置
const handleSave = async () => {
  if (!selectedGroupId.value) {
    ElMessage.warning('请先选择群组')
    return
  }

  saving.value = true
  try {
    const response = await axios.post('/api/admin/porn-detection', {
      group_id: selectedGroupId.value,
      ...form
    })

    if (response.data.success) {
      ElMessage.success('保存成功')
    }
  } catch (error) {
    console.error('保存失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 重置
const handleReset = () => {
  loadConfig()
}

onMounted(() => {
  loadConfig()
  loadLogs()
})
</script>

<style scoped lang="scss">
.porn-detection-page {
  .page-header {
    margin-bottom: 24px;

    .page-title {
      margin: 0 0 8px 0;
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }

    .page-desc {
      margin: 0;
      color: #606266;
    }
  }

  .config-form {
    .section-card {
      margin-bottom: 20px;

      .section-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
    }

    .form-tip {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }

    .form-actions {
      display: flex;
      gap: 12px;
      justify-content: center;
      margin-top: 24px;
      padding: 24px;
      background: #f5f7fa;
      border-radius: 8px;
    }
  }

  .logs-card {
    margin-top: 24px;

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
  }

  .mb-4 {
    margin-bottom: 16px;
  }
}
</style>
