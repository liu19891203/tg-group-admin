<template>
  <div class="auto-reply-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>自动回复配置</span>
          <div>
            <el-switch
              v-model="formData.global_disable"
              active-text="全局禁用"
              inactive-text="启用"
              style="margin-right: 15px;"
            />
            <el-button type="primary" @click="saveConfig">保存配置</el-button>
          </div>
        </div>
      </template>

      <el-form :model="formData" label-width="120px">
        <el-form-item label="启用自动回复">
          <el-switch
            v-model="formData.enabled"
            active-text="启用"
            inactive-text="禁用"
            :disabled="formData.global_disable"
          />
        </el-form-item>

        <div v-if="formData.enabled && !formData.global_disable">
          <el-divider content-position="left">自动回复规则</el-divider>
          
          <div class="rules-section">
            <div class="rules-header">
              <span>当前规则 ({{ formData.rules.length }})</span>
              <el-button type="primary" size="small" @click="showAddRule = true">
                <el-icon><Plus /></el-icon>
                添加规则
              </el-button>
            </div>

            <div class="rules-list">
              <el-card 
                v-for="rule in formData.rules" 
                :key="rule.id"
                class="rule-card"
                :class="{ disabled: !rule.enabled }"
              >
                <template #header>
                  <div class="rule-header">
                    <div class="rule-info">
                      <el-tag :type="rule.is_regex ? 'warning' : 'primary'">
                        {{ rule.is_regex ? '正则' : '关键词' }}
                      </el-tag>
                      <span class="keyword">{{ rule.keyword }}</span>
                      <el-tag size="small">优先级: {{ rule.priority }}</el-tag>
                    </div>
                    <div class="rule-actions">
                      <el-switch
                        v-model="rule.enabled"
                        size="small"
                      />
                      <el-button size="small" @click="editRule(rule)">编辑</el-button>
                      <el-button size="small" type="danger" @click="deleteRule(rule.id)">删除</el-button>
                    </div>
                  </div>
                </template>

                <div class="rule-content">
                  <p><strong>回复类型:</strong> {{ {
                    'text': '文本',
                    'image': '图片', 
                    'button': '按钮',
                    'mixed': '混合'
                  }[rule.reply_type] }}</p>
                  <p><strong>回复内容:</strong> {{ rule.reply_content }}</p>
                  <p><strong>删除方式:</strong> {{ {
                    'immediate': '立即删除',
                    'delay': '延迟删除'
                  }[rule.delete_type] }} ({{ rule.delete_after }}秒)</p>
                </div>
              </el-card>
            </div>
          </div>

          <div class="test-section">
            <h3>测试自动回复</h3>
            <div class="test-content">
              <el-input
                v-model="testMessage"
                placeholder="输入测试消息"
                style="width: 400px; margin-right: 10px;"
              />
              <el-button type="primary" @click="testAutoReply">测试匹配</el-button>
              
              <div v-if="testResult" class="test-result">
                <el-alert
                  :title="testResult.matched ? '匹配成功' : '未匹配到规则'"
                  :type="testResult.matched ? 'success' : 'info'"
                  :description="testResult.matched ? `匹配规则: ${testResult.rule.keyword}` : '没有匹配的自动回复规则'"
                  show-icon
                  style="margin-top: 10px;"
                />
                <div v-if="testResult.matched" class="result-details">
                  <p><strong>回复内容:</strong> {{ testResult.reply_content }}</p>
                  <p><strong>回复类型:</strong> {{ {
                    'text': '文本',
                    'image': '图片', 
                    'button': '按钮',
                    'mixed': '混合'
                  }[testResult.reply_type] }}</p>
                  <p><strong>删除方式:</strong> {{ {
                    'immediate': '立即删除',
                    'delay': '延迟删除'
                  }[testResult.delete_type] }} ({{ testResult.delete_after }}秒后)</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </el-form>
    </el-card>

    <!-- 添加/编辑规则对话框 - 左右并排布局 -->
    <el-dialog
      v-model="showAddRule"
      :title="editingRule ? '编辑规则' : '添加规则'"
      width="900px"
      :close-on-click-modal="false"
    >
      <el-row :gutter="20">
        <!-- 左侧编辑区 -->
        <el-col :span="14">
          <el-form :model="newRule" label-width="100px">
            <el-form-item label="匹配类型">
              <el-radio-group v-model="newRule.is_regex">
                <el-radio :label="false">关键词匹配</el-radio>
                <el-radio :label="true">正则表达式</el-radio>
              </el-radio-group>
            </el-form-item>

            <el-form-item :label="newRule.is_regex ? '正则表达式' : '关键词'">
              <el-input v-model="newRule.keyword" placeholder="请输入关键词或正则表达式" />
            </el-form-item>

            <el-form-item label="回复类型">
              <el-select v-model="newRule.reply_type">
                <el-option label="文本回复" value="text" />
                <el-option label="图片回复" value="image" />
                <el-option label="按钮回复" value="button" />
                <el-option label="混合回复" value="mixed" />
              </el-select>
            </el-form-item>

            <!-- 图片上传 -->
            <el-form-item label="回复图片" v-if="newRule.reply_type === 'image' || newRule.reply_type === 'mixed'">
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
                    {{ newRule.image_url ? '更换图片' : '上传图片' }}
                  </el-button>
                </el-upload>
                <!-- 图片预览 -->
                <div v-if="newRule.image_url" class="image-preview-inline">
                  <img :src="newRule.image_url" class="uploaded-image-thumb" />
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

            <el-form-item label="回复内容">
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
                  <el-button type="primary" link size="small" @click="showInlineKeyboard = !showInlineKeyboard">
                    <el-icon><Grid /></el-icon> {{ showInlineKeyboard ? '关闭内联按钮' : '添加内联按钮' }}
                  </el-button>
                </div>
                
                <!-- 编辑框 -->
                <el-input 
                  v-model="newRule.reply_content" 
                  type="textarea" 
                  :rows="6"
                  placeholder="请输入回复内容，支持HTML格式..."
                  class="message-editor"
                />
                
                <!-- 变量提示 -->
                <div class="variables-hint-below">
                  <span class="hint-label">可用变量：</span>
                  <el-tooltip content="触发回复的用户名" placement="top">
                    <el-button link size="small" @click="insertVariable('user_name')">{user_name}</el-button>
                  </el-tooltip>
                  <el-tooltip content="群组名称" placement="top">
                    <el-button link size="small" @click="insertVariable('group_name')">{group_name}</el-button>
                  </el-tooltip>
                  <el-tooltip content="触发关键词" placement="top">
                    <el-button link size="small" @click="insertVariable('keyword')">{keyword}</el-button>
                  </el-tooltip>
                </div>
              </div>
            </el-form-item>

            <!-- 内联按钮编辑器 -->
            <el-form-item v-if="showInlineKeyboard" label="内联按钮">
              <InlineKeyboardEditor
                v-model="inlineKeyboard"
                ref="keyboardEditorRef"
              />
            </el-form-item>

            <el-form-item label="优先级">
              <el-input-number
                v-model="newRule.priority"
                :min="1"
                :max="10"
                :step="1"
              />
              <span class="tip">数字越大优先级越高</span>
            </el-form-item>

            <el-form-item label="删除方式">
              <el-radio-group v-model="newRule.delete_type">
                <el-radio label="immediate">立即删除</el-radio>
                <el-radio label="delay">延迟删除</el-radio>
              </el-radio-group>
              <el-input-number
                v-model="newRule.delete_after"
                :min="0"
                :max="3600"
                :step="10"
                style="margin-left: 10px;"
                v-if="newRule.delete_type === 'delay'"
              />
              <span class="unit" v-if="newRule.delete_type === 'delay'">秒</span>
            </el-form-item>

            <el-form-item label="启用规则">
              <el-switch v-model="newRule.enabled" />
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
              <div v-if="newRule.image_url && (newRule.reply_type === 'image' || newRule.reply_type === 'mixed')" class="preview-image">
                <img :src="newRule.image_url" />
              </div>
              <!-- 预览消息内容 -->
              <div class="preview-message" v-html="renderedReplyContent"></div>
              <!-- 预览内联按钮 -->
              <div v-if="showInlineKeyboard && inlineKeyboard.length > 0" class="preview-inline-buttons">
                <div v-for="(row, rowIndex) in getButtonRows(inlineKeyboard)" :key="rowIndex" class="button-row">
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
        <el-button @click="showAddRule = false">取消</el-button>
        <el-button type="primary" @click="saveRule">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, reactive, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Delete, SemiSelect, Rank, Minus, Close, UserFilled, Grid, View } from '@element-plus/icons-vue'
import InlineKeyboardEditor, { type InlineButton } from '@/components/InlineKeyboardEditor/InlineKeyboardEditor.vue'
import api from '@/api'
import { useSelectedGroup } from '@/composables/useSelectedGroup'

interface ApiResponse {
  success: boolean
  data?: any
  error?: string
  message?: string
}

interface TelegramButton {
  text: string
  callback_data?: string
  url?: string
}

interface AutoReplyRule {
  id: string
  keyword: string
  is_regex: boolean
  reply_type: 'text' | 'image' | 'button' | 'mixed'
  reply_content: string
  image_url?: string
  inline_buttons?: TelegramButton[]
  delete_after?: number
  delete_type: 'immediate' | 'delay'
  enabled: boolean
  priority: number
}

interface AutoReplyConfig {
  enabled: boolean
  rules: AutoReplyRule[]
  global_disable: boolean
}

interface MatchResult {
  matched: boolean
  rule?: AutoReplyRule
  reply_content: string
  reply_type: 'text' | 'image' | 'button' | 'mixed'
  delete_after?: number
  delete_type: 'immediate' | 'delay'
}

const { currentGroupId, hasGroup } = useSelectedGroup()

const formData = ref<AutoReplyConfig>({
  enabled: false,
  global_disable: false,
  rules: []
})

const showAddRule = ref(false)
const editingRule = ref<AutoReplyRule | null>(null)
const testMessage = ref('')
const testResult = ref<MatchResult | null>(null)
const showInlineKeyboard = ref(false)
const inlineKeyboard = ref<InlineButton[]>([])
const keyboardEditorRef = ref<InstanceType<typeof InlineKeyboardEditor> | null>(null)

const newRule = reactive<Partial<AutoReplyRule>>({
  keyword: '',
  is_regex: false,
  reply_type: 'text',
  reply_content: '',
  image_url: '',
  inline_buttons: [],
  delete_after: 60,
  delete_type: 'delay',
  enabled: true,
  priority: 1
})

// 渲染预览内容
const renderedReplyContent = computed(() => {
  if (!newRule.reply_content) return '<span class="placeholder">消息预览将显示在这里...</span>'
  
  return newRule.reply_content
    .replace(/\n/g, '<br>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/g, '<s>$1</s>')
    .replace(/{user_name}/g, '<b>@用户名</b>')
    .replace(/{group_name}/g, '<b>群组名称</b>')
    .replace(/{keyword}/g, '<b>关键词</b>')
})

// 获取按钮行（每行2个按钮）
const getButtonRows = (buttons: InlineButton[]) => {
  const rows: InlineButton[][] = []
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
  newRule.reply_content = (newRule.reply_content || '') + template
}

// 插入变量
const insertVariable = (variable: string) => {
  newRule.reply_content = (newRule.reply_content || '') + `{${variable}}`
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
    newRule.image_url = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const removeImage = () => {
  newRule.image_url = ''
}

async function loadConfig() {
  if (!currentGroupId.value) return
  try {
    const response = await api.get<{ data: AutoReplyConfig }>(`/admin/auto-replies?group_id=${currentGroupId.value}`)
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
    const response = await api.post<ApiResponse>('/admin/auto-replies', {
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

function editRule(rule: AutoReplyRule) {
  editingRule.value = rule
  Object.assign(newRule, rule)
  showInlineKeyboard.value = !!(rule.inline_buttons && rule.inline_buttons.length > 0)
  inlineKeyboard.value = rule.inline_buttons ? rule.inline_buttons.map((btn, index) => ({
    id: `btn_${index}`,
    text: btn.text,
    type: btn.url ? 'url' : 'callback_data' as const,
    callback_data: btn.callback_data,
    url: btn.url,
    newRow: false
  })) : []
  showAddRule.value = true
}

async function deleteRule(ruleId: string) {
  try {
    await ElMessageBox.confirm('确定删除这条规则吗？', '确认删除', {
      type: 'warning'
    })
    
    const response = await api.delete<ApiResponse>('/admin/auto-replies', {
      groupId: 'demo',
      ruleId
    })
    
    if (response.success) {
      formData.value.rules = formData.value.rules.filter(r => r.id !== ruleId)
      ElMessage.success('规则删除成功')
    }
  } catch (error) {
    // 用户取消删除
  }
}

function saveRule() {
  if (!newRule.keyword?.trim()) {
    ElMessage.warning('请输入关键词或正则表达式')
    return
  }

  if (showInlineKeyboard.value && keyboardEditorRef.value) {
    const keyboard = keyboardEditorRef.value.getTelegramKeyboard()
    newRule.inline_buttons = keyboard && keyboard.length > 0 ? (keyboard.flat() as TelegramButton[]) : []
  } else {
    newRule.inline_buttons = []
  }

  if (editingRule.value) {
    // 更新规则
    const index = formData.value.rules.findIndex(r => r.id === editingRule.value!.id)
    if (index !== -1) {
      formData.value.rules[index] = { ...newRule, id: editingRule.value.id } as AutoReplyRule
    }
  } else {
    // 添加新规则
    const rule: AutoReplyRule = {
      ...newRule,
      id: Math.random().toString(36).substr(2, 9)
    } as AutoReplyRule
    formData.value.rules.push(rule)
  }

  showAddRule.value = false
  resetNewRule()
  ElMessage.success(editingRule.value ? '规则更新成功' : '规则添加成功')
  editingRule.value = null
}

function resetNewRule() {
  Object.assign(newRule, {
    keyword: '',
    is_regex: false,
    reply_type: 'text',
    reply_content: '',
    image_url: '',
    inline_buttons: [],
    delete_after: 60,
    delete_type: 'delay',
    enabled: true,
    priority: 1
  })
  showInlineKeyboard.value = false
  inlineKeyboard.value = []
}

async function testAutoReply() {
  if (!testMessage.value.trim()) {
    ElMessage.warning('请输入测试消息')
    return
  }

  try {
    const response = await api.post<MatchResult>('/admin/auto-replies/match', {
      groupId: 'demo',
      message: testMessage.value,
      config: formData.value
    })
    
    testResult.value = response
  } catch (error: any) {
    ElMessage.error(error.message || '测试失败')
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.auto-reply-config {
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

.rules-section {
  margin-top: 20px;
}

.rules-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 15px;
}

.rules-list {
  max-height: 500px;
  overflow-y: auto;
}

.rule-card {
  margin-bottom: 15px;
  
  &.disabled {
    opacity: 0.6;
  }
}

.rule-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rule-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.keyword {
  font-weight: 600;
  color: #409eff;
}

.rule-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.rule-content {
  p {
    margin: 5px 0;
    font-size: 14px;
  }
}

.test-section {
  margin-top: 30px;
  padding-top: 20px;
  border-top: 1px solid #ebeef5;
}

.test-content {
  margin-top: 15px;
}

.test-result {
  margin-top: 15px;
}

.result-details {
  margin-top: 10px;
  padding: 10px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 14px;
  
  p {
    margin: 5px 0;
  }
}

.tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.unit {
  margin-left: 10px;
  color: #909399;
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
.preview-section-compact {
  height: 100%;
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
