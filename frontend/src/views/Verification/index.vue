<template>
  <div class="verification-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>入群验证配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-form :model="formData" label-width="120px">
        <el-form-item label="启用验证">
          <el-switch
            v-model="formData.enabled"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>

        <el-form-item label="验证类型" v-if="formData.enabled">
          <el-radio-group v-model="formData.type">
            <el-radio label="math">数字计算</el-radio>
            <el-radio label="image">图片验证</el-radio>
            <el-radio label="gif">GIF验证码</el-radio>
            <el-radio label="channel">关注频道</el-radio>
          </el-radio-group>
        </el-form-item>

        <el-form-item label="验证超时" v-if="formData.enabled">
          <el-input-number
            v-model="formData.timeout"
            :min="60"
            :max="1800"
            :step="60"
          />
          <span class="unit">秒</span>
        </el-form-item>

        <el-form-item label="惩罚措施" v-if="formData.enabled">
          <el-select v-model="formData.punishment">
            <el-option label="踢出群组" value="kick" />
            <el-option label="封禁用户" value="ban" />
            <el-option label="禁言用户" value="mute" />
          </el-select>
        </el-form-item>

        <el-form-item label="频道ID" v-if="formData.enabled && formData.type === 'channel'">
          <el-input v-model="formData.channel_id" placeholder="请输入频道用户名或ID" />
        </el-form-item>

        <el-form-item label="难度等级" v-if="formData.enabled && formData.type === 'math'">
          <el-slider
            v-model="formData.difficulty"
            :min="1"
            :max="5"
            :step="1"
            show-stops
          />
          <span class="difficulty-label">
            {{ ['简单', '较易', '中等', '较难', '困难'][formData.difficulty - 1] }}
          </span>
        </el-form-item>

        <!-- 验证消息编辑区域 -->
        <template v-if="formData.enabled">
          <!-- 验证消息图片 -->
          <el-form-item label="验证消息图片">
            <div class="image-upload-wrapper">
              <el-upload
                class="image-uploader-button"
                action="/api/admin/upload"
                :show-file-list="false"
                :on-success="handleVerificationImageSuccess"
                :on-error="handleImageError"
                :before-upload="beforeImageUpload"
                accept="image/*"
              >
                <el-button type="primary" :icon="Plus" size="small">
                  {{ formData.verification_image_url ? '更换图片' : '上传图片' }}
                </el-button>
              </el-upload>
              <!-- 图片预览 -->
              <div v-if="formData.verification_image_url" class="image-preview-inline">
                <img :src="formData.verification_image_url" class="uploaded-image-thumb" />
                <el-button 
                  type="danger" 
                  link 
                  size="small" 
                  @click="removeVerificationImage"
                  class="remove-image-btn"
                >
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </div>
            </div>
          </el-form-item>

          <!-- 验证消息编辑和预览 -->
          <el-form-item label="验证消息">
            <div class="editor-preview-layout">
              <!-- 左侧编辑区 -->
              <div class="editor-section">
                <!-- 工具栏 -->
                <div class="editor-toolbar">
                  <el-button link size="small" @click="insertTemplate('verification', 'bold')">
                    <el-icon><SemiSelect /></el-icon> 加粗
                  </el-button>
                  <el-button link size="small" @click="insertTemplate('verification', 'italic')">
                    <el-icon><Rank /></el-icon> 斜体
                  </el-button>
                  <el-button link size="small" @click="insertTemplate('verification', 'underline')">
                    <el-icon><Minus /></el-icon> 下划线
                  </el-button>
                  <el-button link size="small" @click="insertTemplate('verification', 'strikethrough')">
                    <el-icon><Close /></el-icon> 删除线
                  </el-button>
                  <el-divider direction="vertical" />
                  <el-button type="primary" link size="small" @click="showInlineKeyboardEditor('verification')">
                    <el-icon><Grid /></el-icon> 添加内联按钮
                  </el-button>
                  <el-button type="success" link size="small" @click="showReplyKeyboardEditor('verification')">
                    <el-icon><ChatSquare /></el-icon> 添加回复按钮
                  </el-button>
                </div>
                
                <!-- 编辑框 -->
                <el-input
                  v-model="formData.verification_message"
                  type="textarea"
                  :rows="8"
                  placeholder="请输入验证消息，支持HTML格式..."
                  class="message-editor"
                />
                
                <!-- 变量提示 -->
                <div class="variables-hint-below">
                  <span class="hint-label">可用变量：</span>
                  <el-tooltip content="用户名称" placement="top">
                    <el-button link size="small" @click="insertVariable('verification', 'user_name')">{user_name}</el-button>
                  </el-tooltip>
                  <el-tooltip content="群组名称" placement="top">
                    <el-button link size="small" @click="insertVariable('verification', 'group_name')">{group_name}</el-button>
                  </el-tooltip>
                  <el-tooltip content="频道链接（频道验证时）" placement="top">
                    <el-button link size="small" @click="insertVariable('verification', 'channel_link')">{channel_link}</el-button>
                  </el-tooltip>
                  <el-tooltip content="验证超时时间（秒）" placement="top">
                    <el-button link size="small" @click="insertVariable('verification', 'timeout')">{timeout}</el-button>
                  </el-tooltip>
                </div>
                
                <!-- 内联按钮预览 -->
                <div v-if="verificationButtons.length > 0" class="inline-buttons-preview">
                  <div class="buttons-label">内联按钮：</div>
                  <div class="buttons-list">
                    <el-tag
                      v-for="(btn, index) in verificationButtons"
                      :key="index"
                      closable
                      size="small"
                      @close="removeButton('verification', index)"
                      class="button-tag"
                    >
                      {{ btn.text }}
                    </el-tag>
                  </div>
                </div>
                
                <!-- 回复按钮预览 -->
                <div v-if="verificationReplyButtons.length > 0" class="reply-buttons-preview">
                  <div class="buttons-label">回复按钮：</div>
                  <div class="buttons-list">
                    <el-tag
                      v-for="(btn, index) in verificationReplyButtons"
                      :key="index"
                      closable
                      size="small"
                      type="success"
                      @close="removeReplyButtonFromList('verification', index)"
                      class="button-tag"
                    >
                      {{ btn.text }}
                    </el-tag>
                  </div>
                </div>
              </div>
              
              <!-- 右侧预览区 -->
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
                  <div v-if="formData.verification_image_url" class="preview-image">
                    <img :src="formData.verification_image_url" />
                  </div>
                  <!-- 预览消息内容 -->
                  <div class="preview-message" v-html="renderedVerificationMessage"></div>
                  <!-- 预览内联按钮 -->
                  <div v-if="verificationButtons.length > 0" class="preview-inline-buttons">
                    <div v-for="(row, rowIndex) in getButtonRows(verificationButtons)" :key="rowIndex" class="button-row">
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
                <!-- 预览回复按钮 -->
                <div v-if="verificationReplyButtons.length > 0" class="preview-reply-section">
                  <div class="reply-label">回复按钮预览：</div>
                  <div class="preview-reply-buttons">
                    <button
                      v-for="(btn, index) in verificationReplyButtons"
                      :key="index"
                      class="preview-reply-btn"
                    >
                      {{ btn.text }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </el-form-item>

          <!-- 成功消息图片 -->
          <el-form-item label="成功消息图片">
            <div class="image-upload-wrapper">
              <el-upload
                class="image-uploader-button"
                action="/api/admin/upload"
                :show-file-list="false"
                :on-success="handleSuccessImageSuccess"
                :on-error="handleImageError"
                :before-upload="beforeImageUpload"
                accept="image/*"
              >
                <el-button type="primary" :icon="Plus" size="small">
                  {{ formData.success_image_url ? '更换图片' : '上传图片' }}
                </el-button>
              </el-upload>
              <!-- 图片预览 -->
              <div v-if="formData.success_image_url" class="image-preview-inline">
                <img :src="formData.success_image_url" class="uploaded-image-thumb" />
                <el-button 
                  type="danger" 
                  link 
                  size="small" 
                  @click="removeSuccessImage"
                  class="remove-image-btn"
                >
                  <el-icon><Delete /></el-icon> 删除
                </el-button>
              </div>
            </div>
          </el-form-item>

          <!-- 成功消息编辑和预览 -->
          <el-form-item label="成功消息">
            <div class="editor-preview-layout">
              <!-- 左侧编辑区 -->
              <div class="editor-section">
                <!-- 工具栏 -->
                <div class="editor-toolbar">
                  <el-button link size="small" @click="insertTemplate('success', 'bold')">
                    <el-icon><SemiSelect /></el-icon> 加粗
                  </el-button>
                  <el-button link size="small" @click="insertTemplate('success', 'italic')">
                    <el-icon><Rank /></el-icon> 斜体
                  </el-button>
                  <el-button link size="small" @click="insertTemplate('success', 'underline')">
                    <el-icon><Minus /></el-icon> 下划线
                  </el-button>
                  <el-button link size="small" @click="insertTemplate('success', 'strikethrough')">
                    <el-icon><Close /></el-icon> 删除线
                  </el-button>
                  <el-divider direction="vertical" />
                  <el-button type="primary" link size="small" @click="showInlineKeyboardEditor('success')">
                    <el-icon><Grid /></el-icon> 添加内联按钮
                  </el-button>
                  <el-button type="success" link size="small" @click="showReplyKeyboardEditor('success')">
                    <el-icon><ChatSquare /></el-icon> 添加回复按钮
                  </el-button>
                </div>
                
                <!-- 编辑框 -->
                <el-input
                  v-model="formData.success_message"
                  type="textarea"
                  :rows="6"
                  placeholder="请输入验证成功后的欢迎消息..."
                  class="message-editor"
                />
                
                <!-- 变量提示 -->
                <div class="variables-hint-below">
                  <span class="hint-label">可用变量：</span>
                  <el-tooltip content="用户名称" placement="top">
                    <el-button link size="small" @click="insertVariable('success', 'user_name')">{user_name}</el-button>
                  </el-tooltip>
                  <el-tooltip content="群组名称" placement="top">
                    <el-button link size="small" @click="insertVariable('success', 'group_name')">{group_name}</el-button>
                  </el-tooltip>
                </div>
                
                <!-- 内联按钮预览 -->
                <div v-if="successButtons.length > 0" class="inline-buttons-preview">
                  <div class="buttons-label">内联按钮：</div>
                  <div class="buttons-list">
                    <el-tag
                      v-for="(btn, index) in successButtons"
                      :key="index"
                      closable
                      size="small"
                      @close="removeButton('success', index)"
                      class="button-tag"
                    >
                      {{ btn.text }}
                    </el-tag>
                  </div>
                </div>
                
                <!-- 回复按钮预览 -->
                <div v-if="successReplyButtons.length > 0" class="reply-buttons-preview">
                  <div class="buttons-label">回复按钮：</div>
                  <div class="buttons-list">
                    <el-tag
                      v-for="(btn, index) in successReplyButtons"
                      :key="index"
                      closable
                      size="small"
                      type="success"
                      @close="removeReplyButtonFromList('success', index)"
                      class="button-tag"
                    >
                      {{ btn.text }}
                    </el-tag>
                  </div>
                </div>
              </div>
              
              <!-- 右侧预览区 -->
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
                  <div v-if="formData.success_image_url" class="preview-image">
                    <img :src="formData.success_image_url" />
                  </div>
                  <!-- 预览消息内容 -->
                  <div class="preview-message" v-html="renderedSuccessMessage"></div>
                  <!-- 预览内联按钮 -->
                  <div v-if="successButtons.length > 0" class="preview-inline-buttons">
                    <div v-for="(row, rowIndex) in getButtonRows(successButtons)" :key="rowIndex" class="button-row">
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
                <!-- 预览回复按钮 -->
                <div v-if="successReplyButtons.length > 0" class="preview-reply-section">
                  <div class="reply-label">回复按钮预览：</div>
                  <div class="preview-reply-buttons">
                    <button
                      v-for="(btn, index) in successReplyButtons"
                      :key="index"
                      class="preview-reply-btn"
                    >
                      {{ btn.text }}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </el-form-item>
        </template>
      </el-form>

      <!-- 验证类型预览 -->
      <div class="verification-type-preview" v-if="formData.enabled">
        <h3>验证类型预览</h3>
        <div class="preview-content">
          <div class="preview-block" v-if="formData.type === 'math'">
            <h4>数字验证示例</h4>
            <el-card class="preview-card">
              <p>请计算：5 + 3 = ?</p>
              <el-input placeholder="请输入答案" style="width: 200px;" disabled />
            </el-card>
          </div>
          <div class="preview-block" v-if="formData.type === 'image'">
            <h4>图片验证示例</h4>
            <el-card class="preview-card">
              <p>请识别图片中的数字</p>
              <div class="image-placeholder">[图片验证码]</div>
            </el-card>
          </div>
          <div class="preview-block" v-if="formData.type === 'channel'">
            <h4>频道验证示例</h4>
            <el-card class="preview-card">
              <p>请先关注频道：{{ formData.channel_id || '@example_channel' }}</p>
              <el-button type="primary" size="small" disabled>验证关注</el-button>
            </el-card>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="stats-card">
      <template #header>
        <span>验证统计</span>
      </template>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">今日验证</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">成功验证</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">失败验证</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0%</div>
          <div class="stat-label">成功率</div>
        </div>
      </div>
    </el-card>

    <!-- 内联按钮编辑器对话框 -->
    <el-dialog
      v-model="inlineKeyboardDialog.visible"
      title="添加内联按钮"
      width="600px"
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
              @click="removeInlineButton(index)"
              style="margin-left: 10px;"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <el-button type="primary" link @click="addInlineButton" class="add-btn">
          <el-icon><Plus /></el-icon> 添加按钮
        </el-button>
        
        <div class="button-preview">
          <h4>按钮布局预览</h4>
          <div class="preview-inline-buttons">
            <div v-for="(row, rowIndex) in getButtonRows(inlineKeyboardDialog.buttons)" :key="rowIndex" class="button-row">
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
              @click="removeReplyButton(index)"
              style="margin-left: 10px;"
            >
              <el-icon><Delete /></el-icon>
            </el-button>
          </div>
        </div>
        <el-button type="primary" link @click="addReplyButton" class="add-btn">
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
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UserFilled, SemiSelect, Rank, Minus, Close, Plus, Delete, Grid, View, ChatSquare } from '@element-plus/icons-vue'
import api from '@/api'
import { useSelectedGroup } from '@/composables/useSelectedGroup'

interface InlineButton {
  text: string
  callback_data: string
  action: 'callback' | 'url'
  url?: string
}

interface ReplyButton {
  text: string
}

interface VerificationConfig {
  enabled: boolean
  type: 'math' | 'image' | 'gif' | 'channel'
  timeout: number
  punishment: 'kick' | 'ban' | 'mute'
  channel_id?: string
  difficulty?: number
  verification_message?: string
  success_message?: string
  verification_image_url?: string
  verification_image_file_id?: string
  success_image_url?: string
  success_image_file_id?: string
  verification_buttons?: InlineButton[]
  success_buttons?: InlineButton[]
  verification_reply_buttons?: ReplyButton[]
  success_reply_buttons?: ReplyButton[]
}

const { currentGroupId, hasGroup } = useSelectedGroup()

const formData = ref<VerificationConfig>({
  enabled: false,
  type: 'math',
  timeout: 300,
  punishment: 'kick',
  difficulty: 1,
  verification_message: '',
  success_message: '',
  verification_image_url: '',
  verification_image_file_id: '',
  success_image_url: '',
  success_image_file_id: '',
  verification_buttons: [],
  success_buttons: [],
  verification_reply_buttons: [],
  success_reply_buttons: []
})

// 内联按钮编辑器对话框
const inlineKeyboardDialog = ref({
  visible: false,
  field: '' as 'verification' | 'success',
  buttons: [] as InlineButton[]
})

// 回复按钮编辑器对话框
const replyKeyboardDialog = ref({
  visible: false,
  field: '' as 'verification' | 'success',
  buttons: [] as ReplyButton[]
})

// 计算属性获取按钮
const verificationButtons = computed(() => formData.value.verification_buttons || [])
const successButtons = computed(() => formData.value.success_buttons || [])
const verificationReplyButtons = computed(() => formData.value.verification_reply_buttons || [])
const successReplyButtons = computed(() => formData.value.success_reply_buttons || [])

// 默认消息模板
const defaultVerificationMessage = `<b>👋 欢迎 {user_name}！</b>

请先完成验证以加入群组：
⏰ 验证超时时间：{timeout}秒

点击下方的验证按钮开始验证。`

const defaultSuccessMessage = `<b>✅ 验证成功！</b>

欢迎加入 {group_name}，{user_name}！

请遵守群规，文明交流。`

// 渲染预览消息
const renderMessage = (message: string, type: 'verification' | 'success') => {
  if (!message) {
    message = type === 'verification' ? defaultVerificationMessage : defaultSuccessMessage
  }
  
  // 替换变量
  let rendered = message
    .replace(/{user_name}/g, '@用户名')
    .replace(/{group_name}/g, '示例群组')
    .replace(/{channel_link}/g, formData.value.channel_id || '@example_channel')
    .replace(/{timeout}/g, String(formData.value.timeout))
  
  // 简单的 HTML 渲染
  rendered = rendered
    .replace(/\n/g, '<br>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;a href=['"](.*?)['"]&gt;(.*?)&lt;\/a&gt;/g, '<a href="$1" target="_blank">$2</a>')
    .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code>$1</code>')
  
  return rendered
}

const renderedVerificationMessage = computed(() => {
  return renderMessage(formData.value.verification_message || '', 'verification')
})

const renderedSuccessMessage = computed(() => {
  return renderMessage(formData.value.success_message || '', 'success')
})

// 插入模板
const insertTemplate = (field: 'verification' | 'success', type: string) => {
  const templates: Record<string, string> = {
    bold: '<b>加粗文本</b>',
    italic: '<i>斜体文本</i>',
    underline: '<u>下划线文本</u>',
    strikethrough: '<s>删除线文本</s>'
  }
  
  const template = templates[type]
  const fieldKey = field === 'verification' ? 'verification_message' : 'success_message'
  const currentValue = formData.value[fieldKey] || ''
  
  formData.value[fieldKey] = currentValue + template
}

// 插入变量
const insertVariable = (field: 'verification' | 'success', variable: string) => {
  const variables: Record<string, string> = {
    user_name: '{user_name}',
    group_name: '{group_name}',
    channel_link: '{channel_link}',
    timeout: '{timeout}'
  }
  
  const fieldKey = field === 'verification' ? 'verification_message' : 'success_message'
  const currentValue = formData.value[fieldKey] || ''
  
  formData.value[fieldKey] = currentValue + variables[variable]
}

// 显示内联按钮编辑器
const showInlineKeyboardEditor = (field: 'verification' | 'success') => {
  inlineKeyboardDialog.value.field = field
  const existingButtons = field === 'verification' 
    ? formData.value.verification_buttons 
    : formData.value.success_buttons
  inlineKeyboardDialog.value.buttons = existingButtons && existingButtons.length > 0 
    ? JSON.parse(JSON.stringify(existingButtons))
    : [{ text: '', callback_data: '', action: 'callback' }]
  inlineKeyboardDialog.value.visible = true
}

// 添加内联按钮
const addInlineButton = () => {
  inlineKeyboardDialog.value.buttons.push({
    text: '',
    callback_data: '',
    action: 'callback'
  })
}

// 移除内联按钮
const removeInlineButton = (index: number) => {
  inlineKeyboardDialog.value.buttons.splice(index, 1)
  if (inlineKeyboardDialog.value.buttons.length === 0) {
    addInlineButton()
  }
}

// 保存内联按钮
const saveInlineButtons = () => {
  const validButtons = inlineKeyboardDialog.value.buttons.filter(btn => btn.text.trim())
  if (inlineKeyboardDialog.value.field === 'verification') {
    formData.value.verification_buttons = validButtons
  } else {
    formData.value.success_buttons = validButtons
  }
  inlineKeyboardDialog.value.visible = false
  ElMessage.success('按钮已添加')
}

// 移除按钮
const removeButton = (field: 'verification' | 'success', index: number) => {
  if (field === 'verification') {
    formData.value.verification_buttons?.splice(index, 1)
  } else {
    formData.value.success_buttons?.splice(index, 1)
  }
}

// 获取按钮行（每行2个按钮）
const getButtonRows = (buttons: InlineButton[]) => {
  const rows: InlineButton[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return rows
}

// 显示回复按钮编辑器
const showReplyKeyboardEditor = (field: 'verification' | 'success') => {
  replyKeyboardDialog.value.field = field
  const existingButtons = field === 'verification' 
    ? formData.value.verification_reply_buttons 
    : formData.value.success_reply_buttons
  replyKeyboardDialog.value.buttons = existingButtons && existingButtons.length > 0 
    ? JSON.parse(JSON.stringify(existingButtons))
    : [{ text: '' }]
  replyKeyboardDialog.value.visible = true
}

// 添加回复按钮
const addReplyButton = () => {
  replyKeyboardDialog.value.buttons.push({
    text: ''
  })
}

// 移除回复按钮
const removeReplyButton = (index: number) => {
  replyKeyboardDialog.value.buttons.splice(index, 1)
  if (replyKeyboardDialog.value.buttons.length === 0) {
    addReplyButton()
  }
}

// 保存回复按钮
const saveReplyButtons = () => {
  const validButtons = replyKeyboardDialog.value.buttons.filter(btn => btn.text.trim())
  if (replyKeyboardDialog.value.field === 'verification') {
    formData.value.verification_reply_buttons = validButtons
  } else {
    formData.value.success_reply_buttons = validButtons
  }
  replyKeyboardDialog.value.visible = false
  ElMessage.success('回复按钮已添加')
}

// 移除回复按钮（从列表）
const removeReplyButtonFromList = (field: 'verification' | 'success', index: number) => {
  if (field === 'verification') {
    formData.value.verification_reply_buttons?.splice(index, 1)
  } else {
    formData.value.success_reply_buttons?.splice(index, 1)
  }
}

async function loadConfig() {
  if (!currentGroupId.value) return
  try {
    const response = await api.get<{ data: VerificationConfig }>(`/admin/verification?group_id=${currentGroupId.value}`)
    if (response.data) {
      formData.value = response.data
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

async function saveConfig() {
  if (!currentGroupId.value) return
  try {
    const response = await api.post<ApiResponse>('/admin/verification', {
      group_id: currentGroupId.value,
      config: formData.value
    })
    
    if (response.success) {
      ElMessage.success('配置保存成功')
    } else {
      ElMessage.error('保存失败')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

onMounted(() => {
  loadConfig()
})

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

const handleImageError = () => {
  ElMessage.error('图片上传失败')
}

const handleVerificationImageSuccess = (response: any) => {
  if (response.success) {
    formData.value.verification_image_url = response.data.url
    formData.value.verification_image_file_id = response.data.file_id
    ElMessage.success('验证图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const handleSuccessImageSuccess = (response: any) => {
  if (response.success) {
    formData.value.success_image_url = response.data.url
    formData.value.success_image_file_id = response.data.file_id
    ElMessage.success('成功消息图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const removeVerificationImage = () => {
  formData.value.verification_image_url = ''
  formData.value.verification_image_file_id = ''
}

const removeSuccessImage = () => {
  formData.value.success_image_url = ''
  formData.value.success_image_file_id = ''
}
</script>

<style scoped lang="scss">
.verification-config {
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

.unit {
  margin-left: 10px;
  color: #909399;
}

.difficulty-label {
  margin-left: 10px;
  color: #409eff;
  font-weight: 500;
}

// 编辑器和预览左右并排布局
.editor-preview-layout {
  display: flex;
  gap: 20px;
  align-items: stretch;
  min-height: 320px;
}

.editor-section {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
}

// 变量提示（编辑框下方）
.variables-hint-below {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 8px;
  padding: 8px 12px;
  background: #f0f9ff;
  border: 1px solid #bae6fd;
  border-radius: 6px;
  flex-wrap: wrap;
  
  .hint-label {
    font-size: 12px;
    color: #0369a1;
    font-weight: 500;
  }
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
  flex: 1;
  display: flex;
  flex-direction: column;
  
  :deep(.el-textarea) {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  
  :deep(.el-textarea__inner) {
    flex: 1;
    min-height: 180px;
    font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
    font-size: 14px;
    line-height: 1.6;
    resize: none;
  }
}

// 内联按钮预览
.inline-buttons-preview {
  margin-top: 10px;
  padding: 10px;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  
  .buttons-label {
    font-size: 12px;
    color: #64748b;
    margin-bottom: 8px;
  }
  
  .buttons-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .button-tag {
    cursor: pointer;
  }
}

// 紧凑的预览区域
.preview-section-compact {
  width: 320px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 14px;
  font-weight: 500;
  color: #374151;
  margin-bottom: 10px;
}

.preview-card {
  flex: 1;
  display: flex;
  flex-direction: column;
  
  &.telegram-preview {
    background: #ffffff;
    border: 1px solid #e5e7eb;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
  }
  
  :deep(.el-card__body) {
    flex: 1;
    display: flex;
    flex-direction: column;
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
  
  code {
    background: #f3f4f6;
    padding: 2px 6px;
    border-radius: 4px;
    font-family: monospace;
    font-size: 13px;
  }
  
  a {
    color: #2563eb;
    text-decoration: none;
    
    &:hover {
      text-decoration: underline;
    }
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

// 回复按钮预览
.reply-buttons-preview {
  margin-top: 10px;
  padding: 10px;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  
  .buttons-label {
    font-size: 12px;
    color: #166534;
    margin-bottom: 8px;
  }
  
  .buttons-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  
  .button-tag {
    cursor: pointer;
  }
}

// 预览回复按钮区域
.preview-reply-section {
  margin-top: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border: 1px solid #e5e7eb;
  
  .reply-label {
    font-size: 12px;
    color: #6b7280;
    margin-bottom: 10px;
  }
}

// 预览回复按钮
.preview-reply-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  
  .preview-reply-btn {
    padding: 8px 16px;
    background: #ffffff;
    border: 1px solid #d1d5db;
    border-radius: 20px;
    font-size: 13px;
    color: #374151;
    cursor: default;
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.05);
    transition: all 0.2s;
    
    &:hover {
      background: #f3f4f6;
      border-color: #9ca3af;
    }
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

// 验证类型预览
.verification-type-preview {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #e5e7eb;
  
  h3 {
    margin: 0 0 15px 0;
    color: #374151;
    font-size: 16px;
  }
}

.preview-content {
  display: flex;
  flex-wrap: wrap;
  gap: 20px;
}

.preview-block {
  h4 {
    margin: 0 0 10px 0;
    color: #6b7280;
    font-size: 14px;
  }
}

.image-placeholder {
  width: 200px;
  height: 80px;
  background: #f3f4f6;
  border: 1px dashed #d1d5db;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #9ca3af;
  margin: 10px 0;
  border-radius: 6px;
}

.stats-card {
  margin-top: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
  background: #f9fafb;
  border-radius: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #3b82f6;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #6b7280;
}

// 内联按钮编辑器
.inline-keyboard-editor {
  .button-list {
    margin-bottom: 15px;
  }
  
  .button-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .add-btn {
    margin-bottom: 20px;
  }
  
  .button-preview {
    padding: 15px;
    background: #f9fafb;
    border-radius: 8px;
    
    h4 {
      margin: 0 0 12px 0;
      color: #374151;
      font-size: 14px;
    }
  }
}

// 回复按钮编辑器
.reply-keyboard-editor {
  .button-list {
    margin-bottom: 15px;
  }
  
  .button-item {
    display: flex;
    align-items: center;
    margin-bottom: 10px;
  }
  
  .add-btn {
    margin-bottom: 20px;
  }
  
  .button-preview {
    padding: 15px;
    background: #f9fafb;
    border-radius: 8px;
    
    h4 {
      margin: 0 0 12px 0;
      color: #374151;
      font-size: 14px;
    }
  }
}

// 响应式布局
@media (max-width: 1024px) {
  .editor-preview-layout {
    flex-direction: column;
  }
  
  .preview-section-compact {
    width: 100%;
  }
}
</style>
