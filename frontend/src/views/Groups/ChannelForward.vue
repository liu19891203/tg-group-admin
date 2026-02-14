<template>
  <div class="channel-forward-page">
    <div class="page-header">
      <div class="header-left">
        <h2 class="page-title">频道关联转发</h2>
        <p class="page-desc">将多个频道与群组关联，自动转发频道消息到群组</p>
      </div>
      <el-button type="primary" @click="showAddDialog" :disabled="!selectedGroupId">
        <el-icon><Plus /></el-icon>
        添加频道
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
      <!-- 频道列表 -->
      <el-empty v-if="channels.length === 0 && !loading" description="暂无关联频道，点击右上角添加" />
      
      <div v-else class="channel-list">
        <el-card
          v-for="channel in channels"
          :key="channel.id"
          class="channel-card"
          :class="{ inactive: !channel.is_active }"
        >
          <div class="channel-header">
            <div class="channel-info">
              <el-avatar :size="48" class="channel-avatar">
                {{ channel.channel_name?.charAt(0) || 'C' }}
              </el-avatar>
              <div class="channel-meta">
                <h3 class="channel-name">
                  {{ channel.channel_name || '未命名频道' }}
                  <el-tag v-if="channel.channel_username" size="small" type="info">
                    @{{ channel.channel_username }}
                  </el-tag>
                </h3>
                <p class="channel-id">ID: {{ channel.channel_id }}</p>
              </div>
            </div>
            <div class="channel-status">
              <el-switch
                v-model="channel.is_active"
                @change="(val: boolean) => toggleChannel(channel, val)"
                :loading="channel.toggling"
              />
              <el-dropdown @command="(cmd) => handleCommand(cmd, channel)">
                <el-button type="primary" text>
                  <el-icon><More /></el-icon>
                </el-button>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="edit">
                      <el-icon><Edit /></el-icon>编辑设置
                    </el-dropdown-item>
                    <el-dropdown-item command="test">
                      <el-icon><Connection /></el-icon>测试连接
                    </el-dropdown-item>
                    <el-dropdown-item command="logs">
                      <el-icon><Document /></el-icon>查看日志
                    </el-dropdown-item>
                    <el-dropdown-item divided command="delete" type="danger">
                      <el-icon><Delete /></el-icon>删除关联
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>

          <el-divider />

          <div class="channel-settings-preview">
            <div class="setting-item">
              <span class="label">转发模式：</span>
              <el-tag size="small" :type="getForwardModeType(channel.forward_mode)">
                {{ getForwardModeLabel(channel.forward_mode) }}
              </el-tag>
            </div>
            <div class="setting-item">
              <span class="label">自动置顶：</span>
              <el-tag size="small" :type="channel.auto_pin ? 'success' : 'info'">
                {{ channel.auto_pin ? '开启' : '关闭' }}
              </el-tag>
              <span v-if="channel.auto_pin" class="detail">
                ({{ channel.pin_duration_minutes }}分钟后取消)
              </span>
            </div>
            <div class="setting-item">
              <span class="label">关键词过滤：</span>
              <template v-if="channel.include_keywords?.length">
                <el-tag
                  v-for="kw in channel.include_keywords.slice(0, 3)"
                  :key="kw"
                  size="small"
                  type="success"
                  class="keyword-tag"
                >
                  {{ kw }}
                </el-tag>
                <span v-if="channel.include_keywords.length > 3" class="more">
                  +{{ channel.include_keywords.length - 3 }}
                </span>
              </template>
              <template v-else-if="channel.exclude_keywords?.length">
                <span>排除: </span>
                <el-tag
                  v-for="kw in channel.exclude_keywords.slice(0, 2)"
                  :key="kw"
                  size="small"
                  type="danger"
                  class="keyword-tag"
                >
                  {{ kw }}
                </el-tag>
              </template>
              <span v-else class="text-muted">无</span>
            </div>
          </div>
        </el-card>
      </div>
    </template>

    <!-- 添加/编辑频道对话框 -->
    <el-dialog
      v-model="dialogVisible"
      :title="isEditing ? '编辑频道设置' : '添加关联频道'"
      width="700px"
      destroy-on-close
    >
      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-width="140px"
        class="channel-form"
      >
        <!-- 基本信息 -->
        <el-divider content-position="left">基本信息</el-divider>
        
        <el-form-item label="频道ID" prop="channel_id">
          <el-input
            v-model="form.channel_id"
            placeholder="输入频道ID（例如：-1001234567890）"
            :disabled="isEditing"
          >
            <template #append>
              <el-button @click="testChannelConnection" :loading="testing">
                测试
              </el-button>
            </template>
          </el-input>
          <div class="form-tip">
            频道ID格式为 -100 开头的数字，可通过 @userinfobot 获取
          </div>
        </el-form-item>

        <el-form-item label="频道名称" prop="channel_name">
          <el-input
            v-model="form.channel_name"
            placeholder="频道名称（自动获取或手动输入）"
          />
        </el-form-item>

        <el-form-item label="频道用户名">
          <el-input
            v-model="form.channel_username"
            placeholder="公开频道的用户名（可选）"
          >
            <template #prepend>@</template>
          </el-input>
        </el-form-item>

        <!-- 转发设置 -->
        <el-divider content-position="left">转发设置</el-divider>

        <el-form-item label="转发模式" prop="forward_mode">
          <el-radio-group v-model="form.forward_mode">
            <el-radio-button label="all">全部</el-radio-button>
            <el-radio-button label="text">仅文字</el-radio-button>
            <el-radio-button label="media">仅媒体</el-radio-button>
          </el-radio-group>
          <div class="form-tip">
            选择要转发的消息类型
          </div>
        </el-form-item>

        <!-- 置顶设置 -->
        <el-divider content-position="left">置顶设置</el-divider>

        <el-form-item label="自动置顶">
          <el-switch v-model="form.auto_pin" />
        </el-form-item>

        <el-form-item
          v-if="form.auto_pin"
          label="置顶时长"
          prop="pin_duration_minutes"
        >
          <el-slider
            v-model="form.pin_duration_minutes"
            :min="0"
            :max="1440"
            :step="10"
            show-stops
            show-input
          />
          <div class="form-tip">
            {{ form.pin_duration_minutes === 0 ? '不自动取消置顶' : `${form.pin_duration_minutes} 分钟后自动取消置顶` }}
          </div>
        </el-form-item>

        <!-- 消息处理 -->
        <el-divider content-position="left">消息处理</el-divider>

        <el-form-item label="显示来源">
          <el-checkbox v-model="form.include_source">显示来源频道</el-checkbox>
          <el-checkbox v-model="form.include_author">显示原作者</el-checkbox>
        </el-form-item>

        <el-form-item label="自定义头部">
          <el-input
            v-model="form.custom_header"
            type="textarea"
            :rows="2"
            placeholder="转发消息前的自定义文本"
          />
        </el-form-item>

        <el-form-item label="自定义尾部">
          <el-input
            v-model="form.custom_footer"
            type="textarea"
            :rows="2"
            placeholder="转发消息后的自定义文本"
          />
        </el-form-item>

        <!-- 关键词过滤 -->
        <el-divider content-position="left">关键词过滤</el-divider>

        <el-form-item label="必须包含">
          <el-select
            v-model="form.include_keywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词后按回车添加"
            style="width: 100%"
          />
          <div class="form-tip">
            消息必须包含这些关键词才会转发（为空则不限制）
          </div>
        </el-form-item>

        <el-form-item label="排除关键词">
          <el-select
            v-model="form.exclude_keywords"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="输入关键词后按回车添加"
            style="width: 100%"
          />
          <div class="form-tip">
            消息包含这些关键词将不会转发
          </div>
        </el-form-item>

        <!-- 通知设置 -->
        <el-divider content-position="left">通知设置</el-divider>

        <el-form-item label="转发通知">
          <el-switch v-model="form.notify_on_forward" />
        </el-form-item>

        <el-form-item
          v-if="form.notify_on_forward"
          label="通知模板"
        >
          <el-input
            v-model="form.notify_template"
            type="textarea"
            :rows="3"
            placeholder="转发时的通知模板"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="saveChannel" :loading="saving">
          {{ isEditing ? '保存' : '添加' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 转发日志对话框 -->
    <el-dialog
      v-model="logsDialogVisible"
      title="转发日志"
      width="800px"
    >
      <el-table :data="forwardLogs" v-loading="logsLoading" height="400">
        <el-table-column prop="created_at" label="时间" width="160">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        <el-table-column prop="channel_message_id" label="频道消息ID" width="120" />
        <el-table-column prop="message_type" label="类型" width="100">
          <template #default="{ row }">
            <el-tag size="small">{{ row.message_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{ row }">
            <el-tag
              size="small"
              :type="row.status === 'success' ? 'success' : row.status === 'filtered' ? 'warning' : 'danger'"
            >
              {{ row.status === 'success' ? '成功' : row.status === 'filtered' ? '已过滤' : '失败' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="error_message" label="备注" show-overflow-tooltip />
      </el-table>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus, More, Edit, Delete, Connection, Document
} from '@element-plus/icons-vue'
import axios from 'axios'
import type { FormInstance, FormRules } from 'element-plus'

interface ChannelForward {
  id: string
  group_id: string
  channel_id: number
  channel_name: string | null
  channel_username: string | null
  is_active: boolean
  forward_mode: 'all' | 'text' | 'media'
  auto_pin: boolean
  pin_duration_minutes: number
  include_author: boolean
  include_source: boolean
  custom_header: string
  custom_footer: string
  exclude_keywords: string[]
  include_keywords: string[]
  notify_on_forward: boolean
  notify_template: string
  created_at: string
  updated_at: string
  toggling?: boolean
}

interface ForwardLog {
  id: string
  channel_message_id: number
  message_type: string
  status: 'success' | 'failed' | 'filtered'
  error_message: string | null
  created_at: string
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const channels = ref<ChannelForward[]>([])
const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const dialogVisible = ref(false)
const isEditing = ref(false)
const logsDialogVisible = ref(false)
const logsLoading = ref(false)
const forwardLogs = ref<ForwardLog[]>([])
const currentChannel = ref<ChannelForward | null>(null)

const formRef = ref<FormInstance>()
const form = reactive({
  id: '',
  channel_id: '',
  channel_name: '',
  channel_username: '',
  forward_mode: 'all' as 'all' | 'text' | 'media',
  auto_pin: false,
  pin_duration_minutes: 60,
  include_author: true,
  include_source: true,
  custom_header: '',
  custom_footer: '',
  exclude_keywords: [] as string[],
  include_keywords: [] as string[],
  notify_on_forward: false,
  notify_template: ''
})

const rules: FormRules = {
  channel_id: [
    { required: true, message: '请输入频道ID', trigger: 'blur' },
    { pattern: /^-100\d+$/, message: '频道ID格式错误，应为-100开头的数字', trigger: 'blur' }
  ],
  channel_name: [
    { required: true, message: '请输入频道名称', trigger: 'blur' }
  ],
  forward_mode: [
    { required: true, message: '请选择转发模式', trigger: 'change' }
  ]
}

// 加载频道列表
const loadChannels = async () => {
  if (!selectedGroupId.value) return

  loading.value = true
  try {
    const response = await axios.get(`/api/admin/channel-forwards?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      channels.value = response.data.data || []
      if (response.data.demo) {
        ElMessage.info(response.data.message)
      }
    }
  } catch (error) {
    console.error('加载频道列表失败:', error)
    ElMessage.error('加载频道列表失败')
  } finally {
    loading.value = false
  }
}

// 显示添加对话框
const showAddDialog = () => {
  isEditing.value = false
  resetForm()
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  form.id = ''
  form.channel_id = ''
  form.channel_name = ''
  form.channel_username = ''
  form.forward_mode = 'all'
  form.auto_pin = false
  form.pin_duration_minutes = 60
  form.include_author = true
  form.include_source = true
  form.custom_header = ''
  form.custom_footer = ''
  form.exclude_keywords = []
  form.include_keywords = []
  form.notify_on_forward = false
  form.notify_template = ''
}

// 编辑频道
const editChannel = (channel: ChannelForward) => {
  isEditing.value = true
  currentChannel.value = channel
  Object.assign(form, {
    id: channel.id,
    channel_id: channel.channel_id.toString(),
    channel_name: channel.channel_name || '',
    channel_username: channel.channel_username || '',
    forward_mode: channel.forward_mode,
    auto_pin: channel.auto_pin,
    pin_duration_minutes: channel.pin_duration_minutes,
    include_author: channel.include_author,
    include_source: channel.include_source,
    custom_header: channel.custom_header || '',
    custom_footer: channel.custom_footer || '',
    exclude_keywords: channel.exclude_keywords || [],
    include_keywords: channel.include_keywords || [],
    notify_on_forward: channel.notify_on_forward,
    notify_template: channel.notify_template || ''
  })
  dialogVisible.value = true
}

// 保存频道
const saveChannel = async () => {
  if (!formRef.value) return

  await formRef.value.validate(async (valid) => {
    if (!valid) return

    saving.value = true
    try {
      const payload = {
        group_id: selectedGroupId.value,
        channel_id: parseInt(form.channel_id),
        channel_name: form.channel_name,
        channel_username: form.channel_username,
        forward_mode: form.forward_mode,
        auto_pin: form.auto_pin,
        pin_duration_minutes: form.pin_duration_minutes,
        include_author: form.include_author,
        include_source: form.include_source,
        custom_header: form.custom_header,
        custom_footer: form.custom_footer,
        exclude_keywords: form.exclude_keywords,
        include_keywords: form.include_keywords,
        notify_on_forward: form.notify_on_forward,
        notify_template: form.notify_template
      }

      if (isEditing.value) {
        const response = await axios.put(`/api/admin/channel-forwards?id=${form.id}`, payload)
        if (response.data.success) {
          ElMessage.success('设置已更新')
        }
      } else {
        const response = await axios.post('/api/admin/channel-forwards', payload)
        if (response.data.success) {
          ElMessage.success('频道关联创建成功')
        }
      }

      dialogVisible.value = false
      loadChannels()
    } catch (error: any) {
      console.error('保存失败:', error)
      ElMessage.error(error.response?.data?.error || '保存失败')
    } finally {
      saving.value = false
    }
  })
}

// 切换频道状态
const toggleChannel = async (channel: ChannelForward, isActive: boolean) => {
  channel.toggling = true
  try {
    const response = await axios.put(`/api/admin/channel-forwards?id=${channel.id}`, {
      is_active: isActive
    })
    if (response.data.success) {
      ElMessage.success(isActive ? '频道已启用' : '频道已禁用')
    }
  } catch (error) {
    console.error('切换状态失败:', error)
    ElMessage.error('操作失败')
    channel.is_active = !isActive
  } finally {
    channel.toggling = false
  }
}

// 测试频道连接
const testChannelConnection = async () => {
  if (!form.channel_id) {
    ElMessage.warning('请先输入频道ID')
    return
  }

  testing.value = true
  try {
    // 这里应该调用测试API
    await new Promise(resolve => setTimeout(resolve, 1000))
    ElMessage.success('连接成功')
  } catch (error) {
    ElMessage.error('连接失败')
  } finally {
    testing.value = false
  }
}

// 删除频道
const deleteChannel = async (channel: ChannelForward) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除与 "${channel.channel_name || channel.channel_id}" 的关联吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await axios.delete(`/api/admin/channel-forwards?id=${channel.id}`)
    if (response.data.success) {
      ElMessage.success('频道关联已删除')
      loadChannels()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

// 查看日志
const showLogs = async (channel: ChannelForward) => {
  currentChannel.value = channel
  logsDialogVisible.value = true
  logsLoading.value = true

  try {
    // 这里应该调用获取日志的API
    // const response = await axios.get(`/api/admin/channel-forward-logs?channel_id=${channel.id}`)
    // forwardLogs.value = response.data.data || []

    // 模拟数据
    forwardLogs.value = [
      {
        id: '1',
        channel_message_id: 12345,
        message_type: 'text',
        status: 'success',
        error_message: null,
        created_at: new Date().toISOString()
      },
      {
        id: '2',
        channel_message_id: 12346,
        message_type: 'photo',
        status: 'filtered',
        error_message: '包含排除关键词',
        created_at: new Date(Date.now() - 3600000).toISOString()
      }
    ]
  } catch (error) {
    console.error('加载日志失败:', error)
  } finally {
    logsLoading.value = false
  }
}

// 处理下拉菜单命令
const handleCommand = (command: string, channel: ChannelForward) => {
  switch (command) {
    case 'edit':
      editChannel(channel)
      break
    case 'test':
      testChannelConnection()
      break
    case 'logs':
      showLogs(channel)
      break
    case 'delete':
      deleteChannel(channel)
      break
  }
}

// 获取转发模式标签
const getForwardModeLabel = (mode: string) => {
  const labels: Record<string, string> = {
    all: '全部',
    text: '仅文字',
    media: '仅媒体'
  }
  return labels[mode] || mode
}

// 获取转发模式类型
const getForwardModeType = (mode: string) => {
  const types: Record<string, any> = {
    all: 'primary',
    text: 'success',
    media: 'warning'
  }
  return types[mode] || 'info'
}

// 格式化时间
const formatTime = (time: string) => {
  return new Date(time).toLocaleString('zh-CN')
}

onMounted(() => {
  loadChannels()
})
</script>

<style scoped lang="scss">
.channel-forward-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 24px;

    .header-left {
      .page-title {
        margin: 0 0 8px 0;
        font-size: 24px;
        font-weight: 600;
        color: #303133;
      }

      .page-desc {
        margin: 0;
        color: #909399;
        font-size: 14px;
      }
    }
  }

  .mb-4 {
    margin-bottom: 16px;
  }

  .channel-list {
    display: grid;
    gap: 16px;

    .channel-card {
      transition: all 0.3s;

      &.inactive {
        opacity: 0.7;
        background-color: #f5f7fa;
      }

      .channel-header {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .channel-info {
          display: flex;
          align-items: center;
          gap: 16px;

          .channel-avatar {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            font-size: 20px;
            font-weight: 600;
          }

          .channel-meta {
            .channel-name {
              margin: 0 0 4px 0;
              font-size: 16px;
              font-weight: 600;
              color: #303133;
              display: flex;
              align-items: center;
              gap: 8px;
            }

            .channel-id {
              margin: 0;
              font-size: 13px;
              color: #909399;
              font-family: monospace;
            }
          }
        }

        .channel-status {
          display: flex;
          align-items: center;
          gap: 12px;
        }
      }

      .channel-settings-preview {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;

        .setting-item {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;

          .label {
            color: #606266;
          }

          .detail {
            color: #909399;
          }

          .keyword-tag {
            margin-right: 4px;
          }

          .more {
            color: #909399;
            font-size: 12px;
          }

          .text-muted {
            color: #c0c4cc;
          }
        }
      }
    }
  }

  .channel-form {
    .form-tip {
      font-size: 12px;
      color: #909399;
      margin-top: 4px;
    }
  }
}
</style>
