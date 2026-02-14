<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用欢迎消息">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="消息图片（可选）">
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
                {{ modelValue.image_url ? '更换图片' : '上传图片' }}
              </el-button>
            </el-upload>
            <!-- 图片预览 -->
            <div v-if="modelValue.image_url" class="image-preview-inline">
              <img :src="modelValue.image_url" class="uploaded-image-thumb" />
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
        
        <el-form-item label="欢迎消息">
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
              v-model="modelValue.message"
              type="textarea"
              :rows="6"
              placeholder="请输入欢迎消息内容，支持HTML格式..."
              class="message-editor"
            />
            
            <!-- 变量提示 -->
            <div class="variables-hint-below">
              <span class="hint-label">可用变量：</span>
              <el-tooltip content="新成员的用户名" placement="top">
                <el-button link size="small" @click="insertVariable('username')">{username}</el-button>
              </el-tooltip>
              <el-tooltip content="群组名称" placement="top">
                <el-button link size="small" @click="insertVariable('group')">{group}</el-button>
              </el-tooltip>
            </div>
          </div>
        </el-form-item>
        
        <el-form-item label="自动删除">
          <el-switch v-model="modelValue.auto_delete" />
          <span class="tip"> 自动删除欢迎消息</span>
        </el-form-item>
        
        <el-form-item v-if="modelValue.auto_delete" label="删除延迟">
          <el-input-number v-model="modelValue.delete_delay" :min="5" :max="300" />
          <span class="tip"> 秒后删除</span>
        </el-form-item>
        
        <!-- 消息预览 -->
        <el-form-item label="消息预览">
          <el-card class="preview-card telegram-preview">
            <div class="preview-header">
              <el-avatar :size="36" :icon="UserFilled" />
              <div class="preview-info">
                <div class="preview-name">Bot</div>
                <div class="preview-time">刚刚</div>
              </div>
            </div>
            <!-- 预览图片 -->
            <div v-if="modelValue.image_url" class="preview-image">
              <img :src="modelValue.image_url" />
            </div>
            <!-- 预览消息内容 -->
            <div class="preview-message" v-html="renderedMessage"></div>
          </el-card>
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, SemiSelect, Rank, Minus, Close, UserFilled } from '@element-plus/icons-vue'

interface WelcomeConfig {
  enabled: boolean
  message: string
  image_url?: string
  auto_delete?: boolean
  delete_delay?: number
}

const props = defineProps<{
  modelValue?: WelcomeConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: WelcomeConfig]
}>()

// 渲染预览
const renderedMessage = computed(() => {
  if (!props.modelValue.message) return '<span class="placeholder">消息预览将显示在这里...</span>'
  
  return props.modelValue.message
    .replace(/\n/g, '<br>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/g, '<s>$1</s>')
    .replace(/{username}/g, '<b>新用户</b>')
    .replace(/{group}/g, '<b>群组名称</b>')
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
  const currentValue = props.modelValue.message || ''
  
  emit('update:modelValue', {
    ...props.modelValue,
    message: currentValue + template
  })
}

// 插入变量
const insertVariable = (variable: string) => {
  const currentValue = props.modelValue.message || ''
  emit('update:modelValue', {
    ...props.modelValue,
    message: currentValue + `{${variable}}`
  })
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
    emit('update:modelValue', {
      ...props.modelValue,
      image_url: response.data.url
    })
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const removeImage = () => {
  emit('update:modelValue', {
    ...props.modelValue,
    image_url: undefined
  })
}
</script>

<style scoped lang="scss">
.config-form {
  .tip {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
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

// 变量提示
.variables-hint-below {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #e4e7ed;
  
  .hint-label {
    font-size: 12px;
    color: #606266;
    margin-right: 8px;
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
</style>
