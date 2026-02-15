<template>
  <div class="scheduled-messages">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>定时消息管理</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建定时消息
          </el-button>
        </div>
      </template>

      <div class="messages-tabs">
        <el-radio-group v-model="activeTab">
          <el-radio-button label="all">全部消息</el-radio-button>
          <el-radio-button label="enabled">已启用</el-radio-button>
          <el-radio-button label="disabled">已禁用</el-radio-button>
        </el-radio-group>
      </div>

      <div class="messages-list">
        <el-card 
          v-for="msg in filteredMessages" 
          :key="msg.id"
          class="message-card"
          :class="{ disabled: !msg.enabled }"
        >
          <div class="message-header">
            <div class="message-info">
              <el-tag :type="msg.schedule_type === 'once' ? 'primary' : 'success'">
                {{ msg.schedule_type === 'once' ? '单次发送' : '周期发送' }}
              </el-tag>
              <el-tag size="small" :type="msg.enabled ? 'success' : 'info'">
                {{ msg.enabled ? '已启用' : '已禁用' }}
              </el-tag>
            </div>
            <div class="message-actions">
              <el-switch
                v-model="msg.enabled"
                size="small"
                @change="toggleMessage(msg)"
              />
              <el-button size="small" @click="editMessage(msg)">编辑</el-button>
              <el-button size="small" type="danger" @click="deleteMessage(msg.id)">删除</el-button>
            </div>
          </div>

          <div class="message-content">
            <p class="content">{{ msg.content }}</p>
            <div class="schedule-info">
              <span class="time">
                <el-icon><Clock /></el-icon>
                {{ msg.schedule_time }}
              </span>
              <span v-if="msg.recurring_pattern" class="pattern">
                {{ { 'daily': '每天', 'weekly': '每周', 'monthly': '每月' }[msg.recurring_pattern] }}
              </span>
              <span v-if="msg.next_send" class="next-send">
                下次发送: {{ new Date(msg.next_send).toLocaleString() }}
              </span>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 创建/编辑定时消息对话框 - 左右并排布局 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingMessage ? '编辑定时消息' : '创建定时消息'"
      width="1000px"
      :close-on-click-modal="false"
    >
      <el-row :gutter="20">
        <!-- 左侧编辑区 -->
        <el-col :span="14">
          <el-form :model="newMessage" label-width="100px">
            <el-form-item label="消息类型">
              <el-radio-group v-model="newMessage.message_type">
                <el-radio label="text">文本消息</el-radio>
                <el-radio label="photo">图片消息</el-radio>
                <el-radio label="video">视频消息</el-radio>
              </el-radio-group>
            </el-form-item>

            <!-- 图片上传 -->
            <el-form-item label="消息图片" v-if="newMessage.message_type === 'photo'">
              <div class="image-upload-wrapper">
                <el-upload
                  class="image-uploader-button"
                  action="/api/admin/upload"
                  :show-file-list="false"
                  :on-success="handleImageSuccess"
                  :before-upload="beforeImageUpload"
                  accept="image/*"
                >
                  <el-button type="primary" :icon="Plus" size="small">
                    {{ newMessage.media_url ? '更换图片' : '上传图片' }}
                  </el-button>
                </el-upload>
                <!-- 图片预览 -->
                <div v-if="newMessage.media_url" class="image-preview-inline">
                  <img :src="newMessage.media_url" class="uploaded-image-thumb" />
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

            <el-form-item label="媒体URL" v-if="newMessage.message_type === 'video' || newMessage.message_type === 'document'">
              <el-input v-model="newMessage.media_url" placeholder="视频/文件URL" />
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
                </div>
                
                <!-- 编辑框 -->
                <el-input 
                  v-model="newMessage.content" 
                  type="textarea" 
                  :rows="6"
                  placeholder="请输入消息内容，支持HTML格式..."
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
                </div>
              </div>
            </el-form-item>

            <el-divider content-position="left">发送设置</el-divider>

            <el-form-item label="发送类型">
              <el-radio-group v-model="newMessage.schedule_type">
                <el-radio label="once">单次发送</el-radio>
                <el-radio label="recurring">周期发送</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item label="发送时间" v-if="newMessage.schedule_type === 'once'">
              <el-date-picker
                v-model="newMessage.schedule_time"
                type="datetime"
                placeholder="选择发送时间"
                style="width: 280px;"
              />
            </el-form-item>

            <el-form-item label="发送时间" v-if="newMessage.schedule_type === 'recurring'">
              <el-time-picker
                v-model="newMessage.schedule_time"
                placeholder="选择发送时间"
                style="width: 180px;"
              />
            </el-form-item>

            <el-form-item label="重复模式" v-if="newMessage.schedule_type === 'recurring'">
              <el-select v-model="newMessage.recurring_pattern" style="width: 180px;">
                <el-option label="每天" value="daily" />
                <el-option label="每周" value="weekly" />
                <el-option label="每月" value="monthly" />
              </el-select>
            </el-form-item>

            <el-form-item label="发送日期" v-if="newMessage.schedule_type === 'recurring' && newMessage.recurring_pattern === 'weekly'">
              <el-checkbox-group v-model="newMessage.recurring_days">
                <el-checkbox :label="1">周一</el-checkbox>
                <el-checkbox :label="2">周二</el-checkbox>
                <el-checkbox :label="3">周三</el-checkbox>
                <el-checkbox :label="4">周四</el-checkbox>
                <el-checkbox :label="5">周五</el-checkbox>
                <el-checkbox :label="6">周六</el-checkbox>
                <el-checkbox :label="0">周日</el-checkbox>
              </el-checkbox-group>
            </el-form-item>

            <el-form-item label="时区">
              <el-select v-model="newMessage.timezone" style="width: 180px;">
                <el-option label="中国标准时间 (UTC+8)" value="Asia/Shanghai" />
                <el-option label="UTC" value="UTC" />
                <el-option label="美国东部时间" value="America/New_York" />
              </el-select>
            </el-form-item>

            <el-divider content-position="left">按钮设置（可选）</el-divider>

            <el-form-item label="添加按钮">
              <div class="buttons-list">
                <div 
                  v-for="(button, index) in newMessage.buttons" 
                  :key="index"
                  class="button-item"
                >
                  <el-input v-model="button.text" placeholder="按钮文字" style="width: 140px;" />
                  <el-input v-model="button.url" placeholder="链接URL" style="width: 180px; margin-left: 8px;" />
                  <el-button 
                    type="danger" 
                    size="small" 
                    @click="newMessage.buttons?.splice(index, 1)"
                    style="margin-left: 8px;"
                  >
                    删除
                  </el-button>
                </div>
                <el-button size="small" @click="addButton">添加按钮</el-button>
              </div>
            </el-form-item>

            <el-form-item label="启用消息">
              <el-switch v-model="newMessage.enabled" />
            </el-form-item>
          </el-form>
        </el-col>

        <!-- 右侧预览区 -->
        <el-col :span="10">
          <div class="preview-section-compact">
            <div class="preview-title">
              <el-icon><View /></el-icon>
              实时预览
            </div>
            <el-card class="preview-card telegram-preview">
              <div class="preview-header">
                <el-avatar :size="36" :icon="UserFilled" />
                <div class="preview-info">
                  <div class="preview-name">Bot</div>
                  <div class="preview-time">刚刚</div>
                </div>
              </div>
              <!-- 预览图片 -->
              <div v-if="newMessage.media_url && newMessage.message_type === 'photo'" class="preview-image">
                <img :src="newMessage.media_url" />
              </div>
              <!-- 预览消息内容 -->
              <div class="preview-message" v-html="renderedContent"></div>
              <!-- 预览内联按钮 -->
              <div v-if="newMessage.buttons && newMessage.buttons.length > 0" class="preview-inline-buttons">
                <div v-for="(row, rowIndex) in getButtonRows(newMessage.buttons)" :key="rowIndex" class="button-row">
                  <button
                    v-for="(btn, btnIndex) in row"
                    :key="btnIndex"
                    class="preview-inline-btn"
                  >
                    {{ btn.text }}
                  </button>
                </div>
              </div>
            </el-card>
          </div>
        </el-col>
      </el-row>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveMessage">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Clock, Delete, SemiSelect, Rank, Minus, Close, UserFilled } from '@element-plus/icons-vue'
import api from '@/api'
import { useSelectedGroup } from '@/composables/useSelectedGroup'

interface ScheduledMessage {
  id?: string
  group_id: string
  message_type: 'text' | 'photo' | 'video' | 'document'
  content: string
  media_url?: string
  buttons?: Array<{
    text: string
    url?: string
  }>
  schedule_type: 'once' | 'recurring'
  schedule_time: string
  recurring_pattern?: 'daily' | 'weekly' | 'monthly'
  recurring_days?: number[]
  timezone: string
  enabled: boolean
  next_send?: string
  status: 'pending' | 'sent' | 'failed'
}

const { currentGroupId, hasGroup } = useSelectedGroup()

const activeTab = ref('all')
const messages = ref<ScheduledMessage[]>([])
const showCreateDialog = ref(false)
const editingMessage = ref<ScheduledMessage | null>(null)

const newMessage = reactive<Omit<ScheduledMessage, 'id'>>({
  group_id: '',
  message_type: 'text',
  content: '',
  schedule_type: 'once',
  schedule_time: '',
  timezone: 'Asia/Shanghai',
  enabled: true,
  status: 'pending'
})

const filteredMessages = computed(() => {
  if (activeTab.value === 'all') return messages.value
  if (activeTab.value === 'enabled') return messages.value.filter(m => m.enabled)
  return messages.value.filter(m => !m.enabled)
})

// 渲染预览内容
const renderedContent = computed(() => {
  if (!newMessage.content) return '<span class="placeholder">消息预览将显示在这里...</span>'
  
  return newMessage.content
    .replace(/\n/g, '<br>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/g, '<s>$1</s>')
})

// 获取按钮行（每行2个按钮）
const getButtonRows = (buttons: Array<{ text: string; url?: string }>) => {
  const rows: Array<Array<{ text: string; url?: string }>> = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return rows
}

// 插入模板
const insertTemplate = (type: string) => {
  const templates: Record<string, string> = {
    bold: '<b>加粗文本</b>',
    italic: '<i>斜体文本</i>',
    underline: '<u>下划线文本</u>',
    strikethrough: '<s>删除线文本</s>'
  }
  
  const template = templates[type]
  newMessage.content += template
}

function insertVariable(variable: string) {
  newMessage.content += `{${variable}}`
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
    newMessage.media_url = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const removeImage = () => {
  newMessage.media_url = undefined
}

async function loadMessages() {
  if (!currentGroupId.value) return
  try {
    const response = await api.get<{ data: ScheduledMessage[] }>(`/admin/scheduled-messages?group_id=${currentGroupId.value}`)
    if (response.data) {
      messages.value = response.data
    }
  } catch (error) {
    console.error('加载定时消息失败:', error)
  }
}

function editMessage(msg: ScheduledMessage) {
  editingMessage.value = msg
  Object.assign(newMessage, msg)
  showCreateDialog.value = true
}

async function deleteMessage(messageId: string) {
  if (!currentGroupId.value) return
  try {
    await ElMessageBox.confirm('确定删除这个定时消息吗？', '确认删除', {
      type: 'warning'
    })
    
    const response = await api.delete<ApiResponse>('/admin/scheduled-messages', {
      group_id: currentGroupId.value,
      message_id: messageId
    })
    
    if (response.success) {
      messages.value = messages.value.filter(m => m.id !== messageId)
      ElMessage.success('定时消息删除成功')
    }
  } catch (error) {
    // 用户取消删除
  }
}

async function toggleMessage(msg: ScheduledMessage) {
  if (!currentGroupId.value) return
  try {
    const response = await api.put<ApiResponse>('/admin/scheduled-messages', {
      group_id: currentGroupId.value,
      message_id: msg.id,
      updates: { enabled: msg.enabled }
    })
    
    if (response.success) {
      ElMessage.success(msg.enabled ? '消息已启用' : '消息已禁用')
    }
  } catch (error: any) {
    msg.enabled = !msg.enabled
    ElMessage.error(error.message || '操作失败')
  }
}

function addButton() {
  if (!newMessage.buttons) {
    newMessage.buttons = []
  }
  newMessage.buttons.push({ text: '', url: '' })
}

async function saveMessage() {
  if (!currentGroupId.value) return
  if (!newMessage.content) {
    ElMessage.warning('请输入消息内容')
    return
  }

  if (!newMessage.schedule_time) {
    ElMessage.warning('请设置发送时间')
    return
  }

  try {
    const response = await api.post<ApiResponse>('/admin/scheduled-messages', {
      group_id: currentGroupId.value,
      message: newMessage
    })
    
    if (response.success) {
      ElMessage.success(editingMessage.value ? '定时消息更新成功' : '定时消息创建成功')
      showCreateDialog.value = false
      resetNewMessage()
      await loadMessages()
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

function resetNewMessage() {
  Object.assign(newMessage, {
    group_id: currentGroupId.value || '',
    message_type: 'text',
    content: '',
    schedule_type: 'once',
    schedule_time: '',
    timezone: 'Asia/Shanghai',
    enabled: true,
    status: 'pending'
  })
  editingMessage.value = null
}

onMounted(() => {
  loadMessages()
})
</script>

<style scoped lang="scss">
.scheduled-messages {
  padding: 20px;
}

.config-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.messages-tabs {
  margin-bottom: 20px;
}

.messages-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.message-card {
  &.disabled {
    opacity: 0.6;
  }
}

.message-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.message-info {
  display: flex;
  gap: 8px;
}

.message-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}

.message-content {
  .content {
    margin: 0 0 10px 0;
    padding: 10px;
    background: #f5f7fa;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.6;
  }
  
  .schedule-info {
    display: flex;
    align-items: center;
    gap: 15px;
    font-size: 12px;
    color: #909399;
    
    .time {
      display: flex;
      align-items: center;
      gap: 5px;
    }
    
    .pattern {
      padding: 2px 8px;
      background: #e6f7ff;
      border-radius: 4px;
      color: #1890ff;
    }
    
    .next-send {
      color: #52c41a;
    }
  }
}

.buttons-list {
  .button-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
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
    min-height: 120px;
    resize: none;
  }
}

// 预览区域
.preview-card {
  &.telegram-preview {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :deep(.el-card__body) {
    padding: 15px;
  }
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
    font-size: 13px;
  }
  
  .preview-time {
    color: #9ca3af;
    font-size: 11px;
    margin-top: 2px;
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
</style>
