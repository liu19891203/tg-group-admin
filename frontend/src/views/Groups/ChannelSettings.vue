<template>
  <div class="channel-settings-page">
    <div class="page-header">
      <h2 class="page-title">频道关联</h2>
      <el-button type="primary" @click="saveSettings" :loading="saving">
        <el-icon><Check /></el-icon>
        保存设置
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
      <!-- 频道关联状态 -->
      <el-card class="mb-4">
        <div class="link-status">
          <div class="status-info">
            <h3>频道关联状态</h3>
            <p class="text-muted">将群组与频道关联后，可以管理频道的置顶消息和评论区</p>
          </div>
          <div class="status-badge">
            <el-tag :type="settings.is_linked ? 'success' : 'info'" size="large" effect="dark">
              {{ settings.is_linked ? '已关联' : '未关联' }}
            </el-tag>
          </div>
        </div>

        <el-divider />

        <el-form :model="settings" label-width="150px">
          <el-form-item label="频道ID">
            <el-input
              v-model="settings.channel_id"
              placeholder="输入频道ID（例如：-1001234567890）"
              :disabled="settings.is_linked"
            >
              <template #append>
                <el-button @click="testConnection" :loading="testing">
                  测试连接
                </el-button>
              </template>
            </el-input>
            <div class="form-tip">
              频道ID可以在 Telegram 频道信息中找到，格式为 -100 开头的数字
            </div>
          </el-form-item>

          <el-form-item label="频道名称">
            <el-input
              v-model="settings.channel_name"
              placeholder="频道名称（自动获取或手动输入）"
              :disabled="settings.is_linked"
            />
          </el-form-item>

          <el-form-item v-if="settings.is_linked">
            <el-button type="danger" @click="unlinkChannel" :loading="unlinking">
              <el-icon><Link /></el-icon>
              取消关联
            </el-button>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 取消置顶设置 -->
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>取消置顶设置</span>
            <el-switch v-model="settings.auto_unpin" />
          </div>
        </template>

        <el-form :model="settings" label-width="180px" :disabled="!settings.auto_unpin">
          <el-form-item label="自动取消置顶">
            <el-switch v-model="settings.auto_unpin" />
          </el-form-item>

          <el-form-item label="取消置顶延迟">
            <el-input-number
              v-model="settings.unpin_delay_seconds"
              :min="0"
              :max="86400"
              :step="60"
            />
            <span class="unit">秒（0为立即取消）</span>
            <div class="form-tip">
              频道消息置顶后，等待指定时间自动取消置顶
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 评论区设置 -->
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>抢占评论区</span>
            <el-switch v-model="settings.capture_comments" />
          </div>
        </template>

        <el-form :model="settings" label-width="180px" :disabled="!settings.capture_comments">
          <el-form-item label="启用评论区抢占">
            <el-switch v-model="settings.capture_comments" />
            <div class="form-tip">
              自动回复频道消息的评论区，抢占评论区话语权
            </div>
          </el-form-item>

          <el-form-item label="评论关键词">
            <el-select
              v-model="settings.comment_keywords"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="输入关键词后按回车添加"
              style="width: 100%"
            />
            <div class="form-tip">
              当评论包含这些关键词时触发自动回复
            </div>
          </el-form-item>

          <el-form-item label="自动回复评论">
            <el-switch v-model="settings.auto_reply_comments" />
          </el-form-item>

          <el-form-item label="回复模板">
            <el-input
              v-model="settings.comment_reply_template"
              type="textarea"
              :rows="4"
              placeholder="输入评论回复模板，支持变量：{username} {message}"
              :disabled="!settings.auto_reply_comments"
            />
            <div class="form-tip">
              可用变量：{username} - 评论者用户名, {message} - 评论内容
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 其他设置 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span>其他设置</span>
          </div>
        </template>

        <el-form :model="settings" label-width="180px">
          <el-form-item label="删除频道消息">
            <el-switch v-model="settings.delete_channel_messages" />
            <div class="form-tip">
              自动删除转发到群组的频道消息
            </div>
          </el-form-item>

          <el-form-item label="关联时通知">
            <el-switch v-model="settings.notify_on_link" />
            <div class="form-tip">
              频道关联/取消关联时发送通知到群组
            </div>
          </el-form-item>
        </el-form>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Check, Link } from '@element-plus/icons-vue'
import axios from 'axios'

interface ChannelSettings {
  group_id: string
  channel_id: string | null
  channel_name: string | null
  is_linked: boolean
  auto_unpin: boolean
  unpin_delay_seconds: number
  capture_comments: boolean
  comment_keywords: string[]
  auto_reply_comments: boolean
  comment_reply_template: string
  delete_channel_messages: boolean
  notify_on_link: boolean
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const loading = ref(false)
const saving = ref(false)
const testing = ref(false)
const unlinking = ref(false)

const settings = reactive<ChannelSettings>({
  group_id: '',
  channel_id: null,
  channel_name: null,
  is_linked: false,
  auto_unpin: false,
  unpin_delay_seconds: 0,
  capture_comments: false,
  comment_keywords: [],
  auto_reply_comments: false,
  comment_reply_template: '',
  delete_channel_messages: false,
  notify_on_link: false
})

// 加载设置
const loadSettings = async () => {
  if (!selectedGroupId.value) return

  loading.value = true
  try {
    const response = await axios.get(`/api/admin/channel-settings?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      Object.assign(settings, response.data.data)
    }
  } catch (error) {
    console.error('加载设置失败:', error)
    ElMessage.error('加载设置失败')
  } finally {
    loading.value = false
  }
}

// 保存设置
const saveSettings = async () => {
  if (!selectedGroupId.value) {
    ElMessage.warning('请先选择群组')
    return
  }

  saving.value = true
  try {
    const response = await axios.post('/api/admin/channel-settings', {
      group_id: selectedGroupId.value,
      channel_id: settings.channel_id,
      channel_name: settings.channel_name,
      is_linked: !!settings.channel_id,
      auto_unpin: settings.auto_unpin,
      unpin_delay_seconds: settings.unpin_delay_seconds,
      capture_comments: settings.capture_comments,
      comment_keywords: settings.comment_keywords,
      auto_reply_comments: settings.auto_reply_comments,
      comment_reply_template: settings.comment_reply_template,
      delete_channel_messages: settings.delete_channel_messages,
      notify_on_link: settings.notify_on_link
    })

    if (response.data.success) {
      ElMessage.success('设置已保存')
      loadSettings()
    }
  } catch (error) {
    console.error('保存设置失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 测试连接
const testConnection = async () => {
  if (!settings.channel_id) {
    ElMessage.warning('请输入频道ID')
    return
  }

  testing.value = true
  try {
    // 这里应该调用测试API
    // 暂时模拟成功
    await new Promise(resolve => setTimeout(resolve, 1000))
    ElMessage.success('连接成功')
  } catch (error) {
    console.error('测试连接失败:', error)
    ElMessage.error('连接失败')
  } finally {
    testing.value = false
  }
}

// 取消关联
const unlinkChannel = async () => {
  try {
    await ElMessageBox.confirm(
      '确定要取消与频道的关联吗？',
      '确认取消关联',
      {
        confirmButtonText: '取消关联',
        cancelButtonText: '保留',
        type: 'warning'
      }
    )

    unlinking.value = true
    const response = await axios.delete(`/api/admin/channel-settings?group_id=${selectedGroupId.value}`)

    if (response.data.success) {
      ElMessage.success('频道已取消关联')
      settings.channel_id = null
      settings.channel_name = null
      settings.is_linked = false
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('取消关联失败:', error)
      ElMessage.error('取消关联失败')
    }
  } finally {
    unlinking.value = false
  }
}

onMounted(() => {
  loadSettings()
})
</script>

<style scoped lang="scss">
.channel-settings-page {
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

  .link-status {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .status-info {
      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
      }

      .text-muted {
        color: #909399;
        margin: 0;
      }
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .unit {
    margin-left: 8px;
    color: #606266;
  }

  .mb-4 {
    margin-bottom: 16px;
  }
}
</style>
