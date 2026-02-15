<template>
  <div class="message-editor-component">
    <!-- 图片上传 -->
    <div v-if="showImageUpload" class="image-upload-section">
      <div class="section-label">消息图片</div>
      <div class="image-upload-wrapper">
        <el-upload
          class="image-uploader"
          :action="uploadAction"
          :show-file-list="false"
          :on-success="handleImageSuccess"
          :on-error="handleImageError"
          :before-upload="beforeImageUpload"
          accept="image/*"
        >
          <el-button type="primary" :icon="Plus" size="small">
            {{ imageUrl ? '更换图片' : '上传图片' }}
          </el-button>
        </el-upload>
        <div v-if="imageUrl" class="image-preview-inline">
          <img :src="imageUrl" class="uploaded-image-thumb" />
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
    </div>

    <!-- 编辑器和预览布局 -->
    <div class="editor-preview-layout" :class="{ 'vertical': layout === 'vertical' }">
      <!-- 左侧编辑区 -->
      <div class="editor-section">
        <!-- 头部文本 -->
        <div v-if="showHeader" class="header-input-section">
          <div class="section-label">头部文本</div>
          <el-input
            v-model="localHeaderText"
            placeholder="如：🏆 本月邀请达人"
            size="default"
          />
        </div>

        <!-- 工具栏 -->
        <div class="editor-toolbar">
          <el-button link size="small" @click="insertFormat('bold')">
            <el-icon><SemiSelect /></el-icon> 加粗
          </el-button>
          <el-button link size="small" @click="insertFormat('italic')">
            <el-icon><Rank /></el-icon> 斜体
          </el-button>
          <el-button link size="small" @click="insertFormat('underline')">
            <el-icon><Minus /></el-icon> 下划线
          </el-button>
          <el-button link size="small" @click="insertFormat('strikethrough')">
            <el-icon><Close /></el-icon> 删除线
          </el-button>
          <el-button link size="small" @click="insertFormat('code')">
            <el-icon><Document /></el-icon> 代码
          </el-button>
          <el-divider direction="vertical" />
          <el-button type="primary" link size="small" @click="showInlineKeyboardEditor">
            <el-icon><Grid /></el-icon> 内联按钮
          </el-button>
          <el-button type="success" link size="small" @click="showReplyKeyboardEditor">
            <el-icon><ChatSquare /></el-icon> 回复按钮
          </el-button>
        </div>
        
        <!-- 编辑框 -->
        <el-input
          ref="messageInputRef"
          v-model="localMessage"
          type="textarea"
          :rows="rows"
          :placeholder="placeholder"
          class="message-editor"
          resize="none"
        />
        
        <!-- 变量提示 -->
        <div class="variables-hint">
          <span class="hint-label">可用变量：</span>
          <el-space wrap :size="4">
            <el-tooltip 
              v-for="variable in availableVariables" 
              :key="variable.key"
              :content="variable.description" 
              placement="top"
            >
              <el-button 
                link 
                size="small" 
                class="variable-btn"
                @click="insertVariable(variable.key)"
              >
                {{ variable.label }}
              </el-button>
            </el-tooltip>
          </el-space>
        </div>
        
        <!-- 内联按钮预览 -->
        <div v-if="inlineButtons.length > 0" class="buttons-preview-section">
          <div class="buttons-label">内联按钮：</div>
          <div class="buttons-list">
            <el-tag
              v-for="(btn, index) in inlineButtons"
              :key="index"
              closable
              size="small"
              @close="removeInlineButton(index)"
              class="button-tag"
            >
              {{ btn.text }}
            </el-tag>
          </div>
        </div>
        
        <!-- 回复按钮预览 -->
        <div v-if="replyButtons.length > 0" class="buttons-preview-section">
          <div class="buttons-label">回复按钮：</div>
          <div class="buttons-list">
            <el-tag
              v-for="(btn, index) in replyButtons"
              :key="index"
              closable
              size="small"
              type="success"
              @close="removeReplyButton(index)"
              class="button-tag"
            >
              {{ btn.text }}
            </el-tag>
          </div>
        </div>

        <!-- 尾部文本 -->
        <div v-if="showFooter" class="footer-input-section">
          <div class="section-label">尾部文本</div>
          <el-input
            v-model="localFooterText"
            placeholder="如：邀请更多好友，赢取奖励！"
            size="default"
          />
        </div>
      </div>
      
      <!-- 右侧预览区 -->
      <div class="preview-section">
        <div class="preview-header-bar">
          <el-icon><View /></el-icon>
          <span>实时预览</span>
        </div>
        
        <div class="preview-content-wrapper">
          <!-- Telegram 消息预览 -->
          <div class="telegram-message-preview">
            <div class="message-bubble">
              <!-- 头部文本 -->
              <div v-if="showHeader && localHeaderText" class="preview-header-text">
                {{ localHeaderText }}
              </div>
              
              <!-- 预览图片 -->
              <div v-if="imageUrl" class="preview-image">
                <img :src="imageUrl" />
              </div>
              
              <!-- 预览消息内容 -->
              <div class="preview-message-content" v-html="renderedMessage"></div>
              
              <!-- 预览内联按钮 -->
              <div v-if="inlineButtons.length > 0" class="preview-inline-buttons">
                <div 
                  v-for="(row, rowIndex) in getButtonRows(inlineButtons)" 
                  :key="rowIndex" 
                  class="button-row"
                >
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
            
            <!-- 预览回复按钮 -->
            <div v-if="replyButtons.length > 0" class="preview-reply-area">
              <div class="reply-buttons-container">
                <button
                  v-for="(btn, index) in replyButtons"
                  :key="index"
                  class="preview-reply-btn"
                >
                  {{ btn.text }}
                </button>
              </div>
            </div>
          </div>
          
          <!-- 尾部文本 -->
          <div v-if="showFooter && localFooterText" class="preview-footer-text">
            {{ localFooterText }}
          </div>
        </div>
      </div>
    </div>

    <!-- 内联按钮编辑器对话框 -->
    <el-dialog
      v-model="inlineKeyboardDialog.visible"
      title="添加内联按钮"
      width="600px"
      destroy-on-close
    >
      <div class="inline-keyboard-editor">
        <div class="button-list">
          <div
            v-for="(btn, index) in inlineKeyboardDialog.buttons"
            :key="index"
            class="button-item"
          >
            <el-input
              v-model="btn.text"
              placeholder="按钮文字"
              size="small"
              style="width: 150px;"
            />
            <el-input
              v-model="btn.callback_data"
              placeholder="回调数据"
              size="small"
              style="width: 150px; margin-left: 10px;"
            />
            <el-select
              v-model="btn.action"
              placeholder="动作"
              size="small"
              style="width: 100px; margin-left: 10px;"
            >
              <el-option label="回调" value="callback" />
              <el-option label="链接" value="url" />
            </el-select>
            <el-input
              v-if="btn.action === 'url'"
              v-model="btn.url"
              placeholder="URL链接"
              size="small"
              style="width: 150px; margin-left: 10px;"
            />
            <el-button
              type="danger"
              link
              size="small"
              @click="removeInlineDialogButton(index)"
              style="margin-left: 10px;"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <el-button type="primary" link @click="addInlineDialogButton" class="add-btn">
          <el-icon><Plus /></el-icon> 添加按钮
        </el-button>
        
        <div class="button-preview">
          <h4>按钮布局预览</h4>
          <div class="preview-inline-buttons">
            <div 
              v-for="(row, rowIndex) in getButtonRows(inlineKeyboardDialog.buttons)" 
              :key="rowIndex" 
              class="button-row"
            >
              <button
                v-for="(btn, btnIndex) in row"
                :key="btnIndex"
                class="preview-inline-btn"
              >
                {{ btn.text || '按钮' }}
              </button>
            </div>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="inlineKeyboardDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveInlineButtons">确定</el-button>
      </template>
    </el-dialog>

    <!-- 回复按钮编辑器对话框 -->
    <el-dialog
      v-model="replyKeyboardDialog.visible"
      title="添加回复按钮"
      width="500px"
      destroy-on-close
    >
      <div class="reply-keyboard-editor">
        <el-alert
          title="回复按钮会显示在输入框旁边，用户点击后发送对应文字"
          type="info"
          :closable="false"
          style="margin-bottom: 15px;"
        />
        <div class="button-list">
          <div
            v-for="(btn, index) in replyKeyboardDialog.buttons"
            :key="index"
            class="button-item"
          >
            <el-input
              v-model="btn.text"
              placeholder="按钮文字"
              size="small"
              style="width: 200px;"
            />
            <el-button
              type="danger"
              link
              size="small"
              @click="removeReplyDialogButton(index)"
              style="margin-left: 10px;"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <el-button type="primary" link @click="addReplyDialogButton" class="add-btn">
          <el-icon><Plus /></el-icon> 添加按钮
        </el-button>
        
        <div class="button-preview">
          <h4>按钮布局预览</h4>
          <div class="preview-reply-buttons">
            <button
              v-for="(btn, index) in replyKeyboardDialog.buttons"
              :key="index"
              class="preview-reply-btn"
            >
              {{ btn.text || '按钮' }}
            </button>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="replyKeyboardDialog.visible = false">取消</el-button>
        <el-button type="primary" @click="saveReplyButtons">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { 
  Plus, Delete, SemiSelect, Rank, Minus, Close, 
  Grid, View, ChatSquare, Document 
} from '@element-plus/icons-vue'

interface InlineButton {
  text: string
  callback_data: string
  action: 'callback' | 'url'
  url?: string
}

interface ReplyButton {
  text: string
}

interface Variable {
  key: string
  label: string
  description: string
}

const props = withDefaults(defineProps<{
  modelValue: string
  headerText?: string
  footerText?: string
  imageUrl?: string
  inlineButtons?: InlineButton[]
  replyButtons?: ReplyButton[]
  variables?: Variable[]
  placeholder?: string
  rows?: number
  showHeader?: boolean
  showFooter?: boolean
  showImageUpload?: boolean
  uploadAction?: string
  layout?: 'horizontal' | 'vertical'
}>(), {
  headerText: '',
  footerText: '',
  imageUrl: '',
  inlineButtons: () => [],
  replyButtons: () => [],
  placeholder: '请输入消息内容...',
  rows: 6,
  showHeader: false,
  showFooter: false,
  showImageUpload: false,
  uploadAction: '/api/admin/upload',
  layout: 'horizontal'
})

const emit = defineEmits<{
  'update:modelValue': [value: string]
  'update:headerText': [value: string]
  'update:footerText': [value: string]
  'update:imageUrl': [value: string]
  'update:inlineButtons': [value: InlineButton[]]
  'update:replyButtons': [value: ReplyButton[]]
}>()

// 本地状态
const localMessage = ref(props.modelValue)
const localHeaderText = ref(props.headerText)
const localFooterText = ref(props.footerText)
const localImageUrl = ref(props.imageUrl)
const localInlineButtons = ref<InlineButton[]>([...props.inlineButtons])
const localReplyButtons = ref<ReplyButton[]>([...props.replyButtons])
const messageInputRef = ref<any>(null)

// 默认变量
const defaultVariables: Variable[] = [
  { key: 'user_name', label: '{user_name}', description: '用户名称' },
  { key: 'group_name', label: '{group_name}', description: '群组名称' },
  { key: 'rank', label: '{rank}', description: '排名' },
  { key: 'invites', label: '{invites}', description: '邀请人数' },
  { key: 'rewards', label: '{rewards}', description: '奖励积分' }
]

const availableVariables = computed(() => props.variables || defaultVariables)

// 监听props变化
watch(() => props.modelValue, (val) => {
  localMessage.value = val
})

watch(() => props.headerText, (val) => {
  localHeaderText.value = val
})

watch(() => props.footerText, (val) => {
  localFooterText.value = val
})

watch(() => props.imageUrl, (val) => {
  localImageUrl.value = val
})

watch(() => props.inlineButtons, (val) => {
  localInlineButtons.value = [...val]
}, { deep: true })

watch(() => props.replyButtons, (val) => {
  localReplyButtons.value = [...val]
}, { deep: true })

// 监听本地变化并emit
watch(localMessage, (val) => emit('update:modelValue', val))
watch(localHeaderText, (val) => emit('update:headerText', val))
watch(localFooterText, (val) => emit('update:footerText', val))
watch(localImageUrl, (val) => emit('update:imageUrl', val))
watch(localInlineButtons, (val) => emit('update:inlineButtons', val), { deep: true })
watch(localReplyButtons, (val) => emit('update:replyButtons', val), { deep: true })

// 渲染预览消息
const renderedMessage = computed(() => {
  let message = localMessage.value || ''
  
  // 替换变量
  availableVariables.value.forEach(variable => {
    const regex = new RegExp(`{${variable.key}}`, 'g')
    let replacement = ''
    switch (variable.key) {
      case 'user_name':
        replacement = '@用户名'
        break
      case 'group_name':
        replacement = '示例群组'
        break
      case 'rank':
        replacement = '1'
        break
      case 'invites':
        replacement = '10'
        break
      case 'rewards':
        replacement = '100'
        break
      default:
        replacement = variable.label
    }
    message = message.replace(regex, replacement)
  })
  
  // 转换HTML标签
  message = message
    .replace(/\n/g, '<br>')
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
    .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
    .replace(/<s>(.*?)<\/s>/g, '<del>$1</del>')
    .replace(/<code>(.*?)<\/code>/g, '<code>$1</code>')
    .replace(/<a href=['"](.*?)['"]>(.*?)<\/a>/g, '<a href="$1" target="_blank">$2</a>')
  
  return message
})

// 插入格式
const insertFormat = (type: string) => {
  const formats: Record<string, string> = {
    bold: '<b>加粗文本</b>',
    italic: '<i>斜体文本</i>',
    underline: '<u>下划线文本</u>',
    strikethrough: '<s>删除线文本</s>',
    code: '<code>代码</code>'
  }
  localMessage.value += formats[type]
}

// 插入变量到光标位置
const insertVariable = (key: string) => {
  const variable = availableVariables.value.find(v => v.key === key)
  if (!variable) return

  // 获取 textarea 元素
  const textarea = messageInputRef.value?.$el?.querySelector('textarea')
  if (!textarea) {
    // 如果无法获取 textarea，直接追加到末尾
    localMessage.value += variable.label
    return
  }

  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  const text = localMessage.value || ''

  // 在光标位置插入变量
  const newText = text.substring(0, start) + variable.label + text.substring(end)
  localMessage.value = newText

  // 设置新的光标位置（在插入的变量之后）
  nextTick(() => {
    const newCursorPos = start + variable.label.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// 图片上传处理
const handleImageSuccess = (response: any) => {
  if (response.url) {
    localImageUrl.value = response.url
    ElMessage.success('图片上传成功')
  }
}

const handleImageError = () => {
  ElMessage.error('图片上传失败')
}

const beforeImageUpload = (file: File) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('请上传图片文件')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过5MB')
    return false
  }
  return true
}

const removeImage = () => {
  localImageUrl.value = ''
}

// 内联按钮编辑器
const inlineKeyboardDialog = ref({
  visible: false,
  buttons: [] as InlineButton[]
})

const showInlineKeyboardEditor = () => {
  inlineKeyboardDialog.value.buttons = localInlineButtons.value.length > 0 
    ? JSON.parse(JSON.stringify(localInlineButtons.value))
    : [{ text: '', callback_data: '', action: 'callback' }]
  inlineKeyboardDialog.value.visible = true
}

const addInlineDialogButton = () => {
  inlineKeyboardDialog.value.buttons.push({
    text: '',
    callback_data: '',
    action: 'callback'
  })
}

const removeInlineDialogButton = (index: number) => {
  inlineKeyboardDialog.value.buttons.splice(index, 1)
  if (inlineKeyboardDialog.value.buttons.length === 0) {
    addInlineDialogButton()
  }
}

const saveInlineButtons = () => {
  const validButtons = inlineKeyboardDialog.value.buttons.filter(btn => btn.text.trim())
  localInlineButtons.value = validButtons
  inlineKeyboardDialog.value.visible = false
  ElMessage.success('内联按钮已保存')
}

const removeInlineButton = (index: number) => {
  localInlineButtons.value.splice(index, 1)
}

// 回复按钮编辑器
const replyKeyboardDialog = ref({
  visible: false,
  buttons: [] as ReplyButton[]
})

const showReplyKeyboardEditor = () => {
  replyKeyboardDialog.value.buttons = localReplyButtons.value.length > 0
    ? JSON.parse(JSON.stringify(localReplyButtons.value))
    : [{ text: '' }]
  replyKeyboardDialog.value.visible = true
}

const addReplyDialogButton = () => {
  replyKeyboardDialog.value.buttons.push({ text: '' })
}

const removeReplyDialogButton = (index: number) => {
  replyKeyboardDialog.value.buttons.splice(index, 1)
  if (replyKeyboardDialog.value.buttons.length === 0) {
    addReplyDialogButton()
  }
}

const saveReplyButtons = () => {
  const validButtons = replyKeyboardDialog.value.buttons.filter(btn => btn.text.trim())
  localReplyButtons.value = validButtons
  replyKeyboardDialog.value.visible = false
  ElMessage.success('回复按钮已保存')
}

const removeReplyButton = (index: number) => {
  localReplyButtons.value.splice(index, 1)
}

// 获取按钮行（每行2个按钮）
const getButtonRows = (buttons: InlineButton[]) => {
  const rows: InlineButton[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return rows
}
</script>

<style scoped lang="scss">
.message-editor-component {
  width: 100%;
}

// 图片上传区域
.image-upload-section {
  margin-bottom: 16px;

  .section-label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 8px;
  }
}

.image-upload-wrapper {
  display: flex;
  align-items: center;
  gap: 12px;

  .image-preview-inline {
    display: flex;
    align-items: center;
    gap: 8px;

    .uploaded-image-thumb {
      width: 60px;
      height: 60px;
      object-fit: cover;
      border-radius: 8px;
      border: 1px solid #e5e7eb;
    }
  }
}

// 编辑器和预览布局
.editor-preview-layout {
  display: flex;
  gap: 20px;

  &.vertical {
    flex-direction: column;
  }

  .editor-section {
    flex: 1;
    min-width: 0;
  }

  .preview-section {
    width: 320px;
    flex-shrink: 0;

    @media (max-width: 992px) {
      width: 100%;
    }
  }
}

// 头部/尾部输入
.header-input-section,
.footer-input-section {
  margin-bottom: 12px;

  .section-label {
    font-size: 13px;
    font-weight: 500;
    color: #374151;
    margin-bottom: 6px;
  }
}

// 工具栏
.editor-toolbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  background: #f9fafb;
  border: 1px solid #e5e7eb;
  border-bottom: none;
  border-radius: 8px 8px 0 0;

  .el-button {
    padding: 4px 8px;
    font-size: 12px;
  }

  .el-divider {
    margin: 0 4px;
  }
}

// 消息编辑器
.message-editor {
  :deep(.el-textarea__inner) {
    border-radius: 0 0 8px 8px;
    font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
    font-size: 13px;
    line-height: 1.6;

    &:focus {
      border-color: #3b82f6;
    }
  }
}

// 变量提示
.variables-hint {
  margin-top: 10px;
  padding: 10px 12px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 8px;

  .hint-label {
    font-size: 12px;
    font-weight: 500;
    color: #0369a1;
    margin-right: 8px;
  }

  .variable-btn {
    color: #0284c7;
    font-family: monospace;
    font-size: 11px;
    padding: 2px 6px;

    &:hover {
      color: #0ea5e9;
      background: #e0f2fe;
    }
  }
}

// 按钮预览区域
.buttons-preview-section {
  margin-top: 12px;
  padding: 10px 12px;
  background: #f9fafb;
  border-radius: 8px;

  .buttons-label {
    font-size: 12px;
    font-weight: 500;
    color: #6b7280;
    margin-bottom: 8px;
  }

  .buttons-list {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;

    .button-tag {
      cursor: default;
    }
  }
}

// 预览区域
.preview-section {
  .preview-header-bar {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    background: #f3f4f6;
    border-radius: 8px 8px 0 0;
    font-size: 13px;
    font-weight: 500;
    color: #4b5563;

    .el-icon {
      font-size: 14px;
      color: #6b7280;
    }
  }

  .preview-content-wrapper {
    background: #e5e7eb;
    border-radius: 0 0 8px 8px;
    padding: 16px;
  }
}

// Telegram 消息预览
.telegram-message-preview {
  .message-bubble {
    background: white;
    border-radius: 12px;
    padding: 12px;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
  }

  .preview-header-text {
    font-size: 15px;
    font-weight: 600;
    color: #1f2937;
    margin-bottom: 10px;
    padding-bottom: 10px;
    border-bottom: 1px solid #f3f4f6;
  }

  .preview-image {
    margin-bottom: 10px;

    img {
      width: 100%;
      max-height: 200px;
      object-fit: cover;
      border-radius: 8px;
    }
  }

  .preview-message-content {
    font-size: 14px;
    line-height: 1.6;
    color: #1f2937;
    word-wrap: break-word;

    :deep(strong) {
      font-weight: 600;
    }

    :deep(em) {
      font-style: italic;
    }

    :deep(u) {
      text-decoration: underline;
    }

    :deep(del) {
      text-decoration: line-through;
    }

    :deep(code) {
      font-family: 'Monaco', 'Menlo', monospace;
      background: #f3f4f6;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
    }

    :deep(a) {
      color: #3b82f6;
      text-decoration: none;

      &:hover {
        text-decoration: underline;
      }
    }

    :deep(br) {
      display: block;
      content: '';
      margin-bottom: 4px;
    }
  }

  .preview-inline-buttons {
    margin-top: 10px;
    display: flex;
    flex-direction: column;
    gap: 6px;

    .button-row {
      display: flex;
      gap: 6px;
    }

    .preview-inline-btn {
      flex: 1;
      padding: 8px 12px;
      background: white;
      border: 1px solid #d1d5db;
      border-radius: 6px;
      font-size: 13px;
      color: #3b82f6;
      cursor: default;
      transition: all 0.2s;

      &:hover {
        background: #f0f9ff;
        border-color: #3b82f6;
      }
    }
  }

  .preview-reply-area {
    margin-top: 12px;

    .reply-buttons-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .preview-reply-btn {
      padding: 8px 16px;
      background: white;
      border: none;
      border-radius: 16px;
      font-size: 13px;
      color: #4b5563;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      cursor: default;
    }
  }
}

.preview-footer-text {
  margin-top: 12px;
  padding: 10px 12px;
  background: white;
  border-radius: 8px;
  font-size: 13px;
  color: #6b7280;
  text-align: center;
}

// 按钮编辑器对话框
.inline-keyboard-editor,
.reply-keyboard-editor {
  .button-list {
    max-height: 300px;
    overflow-y: auto;

    .button-item {
      display: flex;
      align-items: center;
      margin-bottom: 10px;
    }
  }

  .add-btn {
    margin-top: 10px;
  }

  .button-preview {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid #e5e7eb;

    h4 {
      font-size: 14px;
      font-weight: 500;
      color: #374151;
      margin: 0 0 12px 0;
    }
  }
}

// 响应式
@media (max-width: 992px) {
  .editor-preview-layout {
    flex-direction: column;

    .preview-section {
      width: 100%;
    }
  }
}
</style>
