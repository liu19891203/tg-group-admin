<template>
  <div class="send-message-page">
    <div class="page-header">
      <h2 class="page-title">主动消息</h2>
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
      <el-row :gutter="20">
        <!-- 发送消息区域 -->
        <el-col :span="16">
          <el-card class="compose-card">
            <template #header>
              <div class="card-header">
                <span>发送消息</span>
              </div>
            </template>

            <el-form :model="messageForm" label-position="top">
              <!-- 图片上传 -->
              <el-form-item label="消息图片（可选）">
                <div class="image-upload-wrapper">
                  <el-upload
                    class="image-uploader-button"
                    action="/api/admin/upload"
                    :show-file-list="false"
                    :on-success="handleImageSuccess"
                    :on-error="handleImageError"
                    :before-upload="beforeImageUpload"
                    accept="image/*"
                  >
                    <el-button type="primary" :icon="Plus" size="small">
                      {{ messageForm.imageUrl ? '更换图片' : '上传图片' }}
                    </el-button>
                  </el-upload>
                  <!-- 图片预览 -->
                  <div v-if="messageForm.imageUrl" class="image-preview-inline">
                    <img :src="messageForm.imageUrl" class="uploaded-image-thumb" />
                    <el-button 
                      type="danger" 
                      link 
                      size="small" 
                      @click="removeImage"
                      class="remove-image-btn"
                    >
                      <el-icon><Delete /></el-icon> 删除
                    </el-button>
                  </div>
                </div>
              </el-form-item>

              <el-form-item label="消息内容">
                <div class="editor-section">
                  <!-- 工具栏 -->
                  <div class="editor-toolbar">
                    <el-button link size="small" @click="insertTemplate('bold')">
                      <el-icon><SemiSelect /></el-icon> 加粗
                    </el-button>
                    <el-button link size="small" @click="insertTemplate('italic')">
                      <el-icon><Rank /></el-icon> 斜体
                    </el-button>
                    <el-button link size="small" @click="insertTemplate('underline')">
                      <el-icon><Minus /></el-icon> 下划线
                    </el-button>
                    <el-button link size="small" @click="insertTemplate('strikethrough')">
                      <el-icon><Close /></el-icon> 删除线
                    </el-button>
                    <el-divider direction="vertical" />
                    <el-button type="primary" link size="small" @click="messageForm.enableKeyboard = !messageForm.enableKeyboard">
                      <el-icon><Grid /></el-icon> {{ messageForm.enableKeyboard ? '关闭内联按钮' : '添加内联按钮' }}
                    </el-button>
                  </div>
                  
                  <!-- 编辑框 -->
                  <el-input
                    ref="messageTextRef"
                    v-model="messageForm.text"
                    type="textarea"
                    :rows="8"
                    placeholder="请输入要发送的消息内容，支持HTML格式..."
                    class="message-editor"
                  />
                  
                  <!-- 变量提示 -->
                  <div class="variables-hint-below">
                    <span class="hint-label">可用变量：</span>
                    <el-tooltip content="群组名称" placement="top">
                      <el-button link size="small" @click="insertVariable('group_name')">{group_name}</el-button>
                    </el-tooltip>
                    <el-tooltip content="当前日期" placement="top">
                      <el-button link size="small" @click="insertVariable('date')">{date}</el-button>
                    </el-tooltip>
                    <el-tooltip content="当前时间" placement="top">
                      <el-button link size="small" @click="insertVariable('time')">{time}</el-button>
                    </el-tooltip>
                    <el-tooltip content="用户名称" placement="top">
                      <el-button link size="small" @click="insertVariable('user_name')">{user_name}</el-button>
                    </el-tooltip>
                  </div>
                </div>
              </el-form-item>

              <!-- 内联按钮编辑器 -->
              <el-form-item v-if="messageForm.enableKeyboard" label="内联按钮">
                <InlineKeyboardEditor
                  v-model="messageForm.inlineKeyboard"
                  ref="keyboardEditorRef"
                />
              </el-form-item>

              <el-form-item>
                <el-checkbox v-model="messageForm.disableNotification">
                  静默发送（不通知群成员）
                </el-checkbox>
              </el-form-item>

              <el-form-item>
                <el-button 
                  type="primary" 
                  size="large" 
                  @click="sendMessage"
                  :loading="sending"
                  :disabled="!messageForm.text.trim() && !messageForm.imageUrl"
                >
                  <el-icon><Promotion /></el-icon>
                  发送消息
                </el-button>
                <el-button size="large" @click="clearMessage">
                  <el-icon><Delete /></el-icon>
                  清空
                </el-button>
              </el-form-item>
            </el-form>
          </el-card>

          <!-- 发送历史 -->
          <el-card class="history-card">
            <template #header>
              <div class="card-header">
                <span>发送历史</span>
                <el-button link @click="loadHistory">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </template>

            <el-timeline v-if="history.length > 0">
              <el-timeline-item
                v-for="item in history"
                :key="item.id"
                :timestamp="formatTime(item.created_at)"
                :type="item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'"
              >
                <el-card class="history-item" :class="'status-' + item.status">
                  <!-- 消息内容预览 -->
                  <div class="history-content-preview">
                    <div v-if="item.image_url" class="history-image">
                      <img :src="item.image_url" alt="消息图片" />
                    </div>
                    <div class="history-text" v-html="item.text"></div>
                  </div>
                  
                  <!-- 状态信息 -->
                  <div class="history-status-bar">
                    <div class="status-info">
                      <el-tag 
                        size="small" 
                        :type="item.status === 'sent' ? 'success' : item.status === 'failed' ? 'danger' : 'warning'"
                        class="status-tag"
                      >
                        <el-icon v-if="item.status === 'sent'"><CircleCheck /></el-icon>
                        <el-icon v-else-if="item.status === 'failed'"><CircleClose /></el-icon>
                        <el-icon v-else><Loading /></el-icon>
                        {{ item.status === 'sent' ? '发送成功' : item.status === 'failed' ? '发送失败' : '发送中' }}
                      </el-tag>
                      <span v-if="item.sent_at" class="sent-time">
                        发送时间: {{ formatTime(item.sent_at) }}
                      </span>
                    </div>
                    
                    <!-- 错误信息 -->
                    <el-alert
                      v-if="item.status === 'failed' && item.error_message"
                      :title="item.error_message"
                      type="error"
                      :closable="false"
                      show-icon
                      class="error-alert"
                    />
                  </div>
                  
                  <!-- 操作按钮 -->
                  <div class="history-actions">
                    <el-button 
                      v-if="item.status === 'failed'"
                      type="primary" 
                      size="small"
                      @click="retrySend(item)"
                    >
                      <el-icon><RefreshRight /></el-icon>
                      重新发送
                    </el-button>
                    <el-button 
                      v-else
                      type="success" 
                      size="small"
                      @click="sendAgain(item)"
                    >
                      <el-icon><Promotion /></el-icon>
                      再次发送
                    </el-button>
                    <el-button 
                      link 
                      size="small" 
                      type="danger"
                      @click="deleteHistoryItem(item)"
                    >
                      <el-icon><Delete /></el-icon>
                      删除记录
                    </el-button>
                  </div>
                </el-card>
              </el-timeline-item>
            </el-timeline>

            <el-empty v-else description="暂无发送记录" />
          </el-card>
        </el-col>

        <!-- 预览区域 -->
        <el-col :span="8">
          <el-card class="preview-card">
            <template #header>
              <div class="card-header">
                <span>消息预览</span>
              </div>
            </template>

            <div class="preview-container">
              <div class="telegram-preview">
                <div class="preview-header">
                  <div class="preview-avatar">
                    <el-avatar :size="40" :icon="UserFilled" />
                  </div>
                  <div class="preview-info">
                    <div class="preview-name">Bot</div>
                    <div class="preview-time">刚刚</div>
                  </div>
                </div>
                <!-- 预览图片 -->
                <div v-if="messageForm.imageUrl" class="preview-image">
                  <img :src="messageForm.imageUrl" />
                </div>
                <!-- 预览消息内容 -->
                <div class="preview-message" v-html="renderedPreview"></div>
                <!-- 预览内联按钮 -->
                <div v-if="messageForm.enableKeyboard && messageForm.inlineKeyboard.length > 0" class="preview-inline-buttons">
                  <div v-for="(row, rowIndex) in getButtonRows(messageForm.inlineKeyboard)" :key="rowIndex" class="button-row">
                    <button
                      v-for="(btn, btnIndex) in row"
                      :key="btnIndex"
                      class="preview-inline-btn"
                    >
                      {{ btn.text }}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <el-divider />

            <div class="quick-templates">
              <h4>快捷模板</h4>
              <el-space wrap>
                <el-button 
                  v-for="template in quickTemplates" 
                  :key="template.name"
                  size="small"
                  @click="applyTemplate(template)"
                >
                  {{ template.name }}
                </el-button>
              </el-space>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Promotion,
  Delete,
  Refresh,
  SemiSelect,
  Rank,
  Minus,
  Close,
  UserFilled,
  Plus,
  Grid,
  CircleCheck,
  CircleClose,
  Loading,
  RefreshRight
} from '@element-plus/icons-vue'
import InlineKeyboardEditor, { type InlineButton } from '@/components/InlineKeyboardEditor/InlineKeyboardEditor.vue'
import axios from 'axios'
import dayjs from 'dayjs'

interface SentMessage {
  id: string
  group_id: string
  text: string
  parse_mode: string
  status: 'sent' | 'failed' | 'sending'
  error_message?: string
  image_url?: string
  inline_keyboard?: InlineButton[]
  created_at: string
  sent_at?: string
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const messageForm = reactive({
  text: '',
  disableNotification: false,
  enableKeyboard: false,
  inlineKeyboard: [] as InlineButton[],
  imageUrl: '',
  imageFileId: ''
})

const keyboardEditorRef = ref<InstanceType<typeof InlineKeyboardEditor> | null>(null)
const messageTextRef = ref<any>(null)

const sending = ref(false)
const history = ref<SentMessage[]>([])

// 快捷模板
const quickTemplates = [
  {
    name: '欢迎消息',
    content: '<b>👋 欢迎新成员！</b>\n\n请遵守群规，文明交流。如有问题请联系管理员。'
  },
  {
    name: '活动通知',
    content: '<b>📢 活动通知</b>\n\n活动时间：{时间}\n活动内容：{内容}\n\n欢迎大家参加！'
  },
  {
    name: '重要提醒',
    content: '<b>⚠️ 重要提醒</b>\n\n{提醒内容}\n\n请大家注意！'
  },
  {
    name: '群规公告',
    content: '<b>📋 群规公告</b>\n\n1. 禁止发布广告\n2. 禁止辱骂他人\n3. 禁止刷屏\n4. 遵守法律法规\n\n违规者将被处理。'
  }
]

// 获取按钮行（每行2个按钮）
const getButtonRows = (buttons: InlineButton[]) => {
  const rows: InlineButton[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return rows
}

// 渲染预览（简单的 HTML 转义）
const renderedPreview = computed(() => {
  if (!messageForm.text) return '<span class="placeholder">消息预览将显示在这里...</span>'
  
  return messageForm.text
    .replace(/\n/g, '<br>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/g, '<s>$1</s>')
    .replace(/&lt;a href=['"](.*?)['"]&gt;(.*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank">$2</a>')
    .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code>$1</code>')
})

// 插入模板
const insertTemplate = (type: string) => {
  const templates: Record<string, string> = {
    bold: '<b>加粗文本</b>',
    italic: '<i>斜体文本</i>',
    underline: '<u>下划线文本</u>',
    strikethrough: '<s>删除线文本</s>'
  }
  
  const template = templates[type]
  messageForm.text += template
}

// 插入变量到光标位置
const insertVariable = (variable: string) => {
  const textarea = messageTextRef.value?.$el?.querySelector('textarea')
  const variableText = `{${variable}}`
  
  if (!textarea) {
    messageForm.text += variableText
    return
  }
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = messageForm.text || ''
  
  messageForm.text = text.substring(0, start) + variableText + text.substring(end)
  
  nextTick(() => {
    const newCursorPos = start + variableText.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// 应用快捷模板
const applyTemplate = (template: { name: string; content: string }) => {
  messageForm.text = template.content
}

// 图片上传相关方法
const beforeImageUpload = (file: File) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

const handleImageSuccess = (response: any) => {
  if (response.success) {
    messageForm.imageUrl = response.data.url
    messageForm.imageFileId = response.data.file_id
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const handleImageError = () => {
  ElMessage.error('图片上传失败')
}

const removeImage = () => {
  messageForm.imageUrl = ''
  messageForm.imageFileId = ''
}

// 发送消息
const sendMessage = async () => {
  if (!messageForm.text.trim() && !messageForm.imageUrl) {
    ElMessage.warning('请输入消息内容或上传图片')
    return
  }

  if (!selectedGroupId.value) {
    ElMessage.warning('请先选择群组')
    return
  }

  sending.value = true
  try {
    const payload: any = {
      group_id: selectedGroupId.value,
      text: messageForm.text,
      parse_mode: 'HTML',
      disable_notification: messageForm.disableNotification
    }

    // 如果有图片，使用图片消息
    if (messageForm.imageUrl) {
      payload.image_url = messageForm.imageUrl
      payload.image_file_id = messageForm.imageFileId
    }

    // 如果启用了键盘，添加键盘数据
    if (messageForm.enableKeyboard && keyboardEditorRef.value) {
      const keyboard = keyboardEditorRef.value.getTelegramKeyboard()
      if (keyboard && keyboard.length > 0) {
        payload.reply_markup = {
          inline_keyboard: keyboard
        }
      }
    }

    const response = await axios.post('/api/admin/send-message', payload)

    if (response.data.success) {
      ElMessage.success('消息已发送')
      messageForm.text = ''
      messageForm.enableKeyboard = false
      messageForm.inlineKeyboard = []
      loadHistory()
    }
  } catch (error: any) {
    console.error('发送消息失败:', error)
    ElMessage.error(error.response?.data?.error || '发送失败')
  } finally {
    sending.value = false
  }
}

// 清空消息
const clearMessage = () => {
  messageForm.text = ''
  messageForm.imageUrl = ''
  messageForm.imageFileId = ''
  messageForm.enableKeyboard = false
  messageForm.inlineKeyboard = []
}

// 重新发送（用于发送失败的消息）
const retrySend = async (item: SentMessage) => {
  // 更新状态为发送中
  item.status = 'sending'
  
  try {
    const payload: any = {
      group_id: selectedGroupId.value,
      text: item.text,
      parse_mode: 'HTML',
      disable_notification: false
    }

    if (item.image_url) {
      payload.image_url = item.image_url
    }

    if (item.inline_keyboard && item.inline_keyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: [item.inline_keyboard]
      }
    }

    const response = await axios.post('/api/admin/send-message', payload)

    if (response.data.success) {
      item.status = 'sent'
      item.sent_at = new Date().toISOString()
      item.error_message = undefined
      ElMessage.success('消息重新发送成功')
    }
  } catch (error: any) {
    item.status = 'failed'
    item.error_message = error.response?.data?.error || '发送失败'
    ElMessage.error(item.error_message)
  }
}

// 再次发送（用于发送成功的消息，复制内容到编辑框）
const sendAgain = (item: SentMessage) => {
  messageForm.text = item.text
  messageForm.imageUrl = item.image_url || ''
  messageForm.enableKeyboard = !!(item.inline_keyboard && item.inline_keyboard.length > 0)
  messageForm.inlineKeyboard = item.inline_keyboard || []
  ElMessage.info('消息内容已加载到编辑框，您可以修改后发送')
}

// 删除历史记录
const deleteHistoryItem = async (item: SentMessage) => {
  try {
    await axios.delete(`/api/admin/messages/${item.id}`)
    history.value = history.value.filter(h => h.id !== item.id)
    ElMessage.success('记录已删除')
  } catch (error) {
    console.error('删除记录失败:', error)
    ElMessage.error('删除失败')
  }
}

// 加载历史
const loadHistory = async () => {
  try {
    const response = await axios.get(`/api/admin/groups/${selectedGroupId.value}/messages`)
    if (response.data.success) {
      history.value = response.data.data || []
    }
  } catch (error) {
    console.error('加载历史失败:', error)
  }
}

// 格式化时间
const formatTime = (time: string) => {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  loadHistory()
})
</script>

<style scoped lang="scss">
.send-message-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
  
  .page-title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
}

.mb-4 {
  margin-bottom: 16px;
}

.compose-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  
  span {
    font-weight: 600;
  }
}

// 图片上传按钮样式
.image-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;
}

.image-uploader-button {
  display: inline-block;
}

.image-preview-inline {
  display: flex;
  align-items: center;
  gap: 10px;
  
  .uploaded-image-thumb {
    width: 80px;
    height: 60px;
    object-fit: cover;
    border-radius: 6px;
    border: 1px solid #e5e7eb;
  }
  
  .remove-image-btn {
    padding: 4px 8px;
  }
}

// 编辑器区域
.editor-section {
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  padding: 12px;
  background: #f5f7fa;
}

// 工具栏
.editor-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 10px;
  flex-wrap: wrap;
}

// 消息编辑器
.message-editor {
  :deep(.el-textarea__inner) {
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
    min-height: 180px;
    resize: none;
  }
}

// 变量提示
.variables-hint-below {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  
  .hint-label {
    font-size: 12px;
    color: #606266;
    font-weight: 500;
  }
}

// 历史记录
.history-card {
  margin-top: 20px;
}

.history-item {
  margin-bottom: 15px;
  transition: all 0.3s;
  
  &.status-sent {
    border-left: 4px solid #67c23a;
  }
  
  &.status-failed {
    border-left: 4px solid #f56c6c;
  }
  
  &.status-sending {
    border-left: 4px solid #e6a23c;
  }
  
  .history-content-preview {
    margin-bottom: 12px;
    
    .history-image {
      margin-bottom: 10px;
      
      img {
        max-width: 100%;
        max-height: 150px;
        border-radius: 8px;
        object-fit: cover;
      }
    }
    
    .history-text {
      word-break: break-word;
      line-height: 1.6;
      color: #303133;
      font-size: 14px;
    }
  }
  
  .history-status-bar {
    margin-bottom: 12px;
    
    .status-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
      
      .status-tag {
        display: flex;
        align-items: center;
        gap: 4px;
        
        .el-icon {
          font-size: 14px;
        }
      }
      
      .sent-time {
        font-size: 12px;
        color: #909399;
      }
    }
    
    .error-alert {
      margin-top: 8px;
      padding: 8px 12px;
      
      :deep(.el-alert__title) {
        font-size: 12px;
      }
    }
  }
  
  .history-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    padding-top: 10px;
    border-top: 1px solid #ebeef5;
    
    .el-button {
      display: flex;
      align-items: center;
      gap: 4px;
    }
  }
}

// 预览区域
.preview-card {
  position: sticky;
  top: 20px;
}

.preview-container {
  min-height: 200px;
}

.telegram-preview {
  background: #ffffff;
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  padding: 15px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.preview-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.preview-info {
  .preview-name {
    font-weight: 600;
    color: #1f2937;
    font-size: 14px;
  }
  
  .preview-time {
    color: #9ca3af;
    font-size: 12px;
  }
}

.preview-image {
  margin-bottom: 10px;
  
  img {
    max-width: 100%;
    border-radius: 8px;
    display: block;
  }
}

.preview-message {
  color: #1f2937;
  line-height: 1.6;
  font-size: 14px;
  
  b {
    font-weight: 600;
  }
  
  i {
    font-style: italic;
  }
  
  u {
    text-decoration: underline;
  }
  
  s {
    text-decoration: line-through;
  }
  
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
  }
  
  .placeholder {
    color: #9ca3af;
    font-style: italic;
  }
}

// 预览中的内联按钮
.preview-inline-buttons {
  margin-top: 12px;
  
  .button-row {
    display: flex;
    gap: 8px;
    margin-bottom: 8px;
    
    &:last-child {
      margin-bottom: 0;
    }
  }
  
  .preview-inline-btn {
    flex: 1;
    padding: 8px 12px;
    background: #f3f4f6;
    border: 1px solid #d1d5db;
    border-radius: 6px;
    font-size: 13px;
    color: #374151;
    cursor: default;
    transition: all 0.2s;
    
    &:hover {
      background: #e5e7eb;
    }
  }
}

// 快捷模板
.quick-templates {
  h4 {
    margin: 0 0 12px 0;
    font-size: 14px;
    color: #374151;
  }
}
</style>
