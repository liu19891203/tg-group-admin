<template>
  <div class="inline-keyboard-editor">
    <div class="editor-header">
      <h4>内联按钮编辑器</h4>
      <el-button type="primary" size="small" @click="addButton">
        <el-icon><Plus /></el-icon>
        添加按钮
      </el-button>
    </div>

    <!-- 按钮列表 -->
    <div class="buttons-list">
      <div
        v-for="(button, index) in buttons"
        :key="button.id"
        class="button-item"
      >
        <div class="button-row">
          <span class="button-index">{{ index + 1 }}</span>
          
          <el-input
            v-model="button.text"
            placeholder="按钮文字"
            size="small"
            class="button-text-input"
            maxlength="64"
            show-word-limit
          />

          <el-select
            v-model="button.type"
            placeholder="类型"
            size="small"
            class="button-type-select"
          >
            <el-option label="回调按钮" value="callback_data" />
            <el-option label="链接按钮" value="url" />
          </el-select>

          <el-button
            type="danger"
            link
            size="small"
            @click="removeButton(index)"
          >
            <el-icon><Delete /></el-icon>
          </el-button>
        </div>

        <div class="button-row second-row">
          <template v-if="button.type === 'callback_data'">
            <el-select
              v-model="button.callback_data"
              placeholder="选择回调动作或自定义输入"
              size="small"
              class="callback-select"
              filterable
              allow-create
              default-first-option
            >
              <el-option-group label="常用回调">
                <el-option
                  v-for="cb in commonCallbacks"
                  :key="cb.value"
                  :label="cb.label"
                  :value="cb.value"
                />
              </el-option-group>
            </el-select>
          </template>

          <template v-else>
            <el-input
              v-model="button.url"
              placeholder="https://example.com"
              size="small"
              class="url-input"
            />
          </template>
        </div>

        <!-- 行分隔控制 -->
        <div v-if="index < buttons.length - 1" class="row-control">
          <el-checkbox
            v-model="button.newRow"
            size="small"
          >
            下一按钮换行
          </el-checkbox>
        </div>
      </div>
    </div>

    <!-- 预览 -->
    <div class="keyboard-preview">
      <h5>按钮预览</h5>
      <div class="preview-container">
        <div
          v-for="(row, rowIndex) in previewRows"
          :key="rowIndex"
          class="preview-row"
        >
          <el-button
            v-for="btn in row"
            :key="btn.id"
            size="small"
            :type="btn.type === 'url' ? 'primary' : 'default'"
            class="preview-button"
          >
            {{ btn.text || '未命名' }}
          </el-button>
        </div>
        <el-empty v-if="buttons.length === 0" description="暂无按钮" :image-size="60" />
      </div>
    </div>

    <!-- 操作按钮 -->
    <div class="editor-actions">
      <el-button size="small" @click="clearAll">
        <el-icon><Delete /></el-icon>
        清空全部
      </el-button>
      <el-button size="small" @click="loadExample">
        <el-icon><Document /></el-icon>
        加载示例
      </el-button>
    </div>

    <!-- JSON 预览（调试用，可折叠） -->
    <el-collapse class="json-collapse">
      <el-collapse-item title="JSON 数据（调试用）" name="json">
        <pre class="json-preview">{{ jsonPreview }}</pre>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Plus, Delete, Document } from '@element-plus/icons-vue'

export interface InlineButton {
  id: string
  text: string
  type: 'callback_data' | 'url'
  callback_data?: string
  url?: string
  newRow: boolean
}

// 本程序常用的回调预设
const commonCallbacks = [
  { label: '📊 查看统计数据', value: 'stats:view' },
  { label: '⚙️ 打开设置', value: 'settings:open' },
  { label: '👤 查看个人资料', value: 'profile:view' },
  { label: '💰 查看积分', value: 'points:check' },
  { label: '🎁 参与抽奖', value: 'lottery:join' },
  { label: '✅ 确认操作', value: 'action:confirm' },
  { label: '❌ 取消操作', value: 'action:cancel' },
  { label: '🔄 刷新数据', value: 'data:refresh' },
  { label: '📋 查看规则', value: 'rules:view' },
  { label: '❓ 帮助', value: 'help:show' },
  { label: '🔙 返回上级', value: 'nav:back' },
  { label: '🏠 返回首页', value: 'nav:home' },
  { label: '⬅️ 上一页', value: 'page:prev' },
  { label: '➡️ 下一页', value: 'page:next' },
  { label: '🔔 开启通知', value: 'notify:on' },
  { label: '🔕 关闭通知', value: 'notify:off' },
]

const props = defineProps<{
  modelValue: InlineButton[]
}>()

const emit = defineEmits<{
  'update:modelValue': [buttons: InlineButton[]]
}>()

const buttons = ref<InlineButton[]>(props.modelValue.length > 0 ? props.modelValue : [])

// 同步到父组件
watch(buttons, (newVal) => {
  emit('update:modelValue', newVal)
}, { deep: true })

// 生成唯一ID
const generateId = () => `btn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

// 添加按钮
const addButton = () => {
  const lastButton = buttons.value[buttons.value.length - 1]
  buttons.value.push({
    id: generateId(),
    text: '',
    type: 'callback_data',
    callback_data: '',
    newRow: false
  })
}

// 删除按钮
const removeButton = (index: number) => {
  buttons.value.splice(index, 1)
}

// 清空全部
const clearAll = () => {
  buttons.value = []
}

// 加载示例
const loadExample = () => {
  buttons.value = [
    {
      id: generateId(),
      text: '📊 查看统计',
      type: 'callback_data',
      callback_data: 'stats:view',
      newRow: false
    },
    {
      id: generateId(),
      text: '⚙️ 设置',
      type: 'callback_data',
      callback_data: 'settings:open',
      newRow: true
    },
    {
      id: generateId(),
      text: '✅ 确认',
      type: 'callback_data',
      callback_data: 'action:confirm',
      newRow: false
    },
    {
      id: generateId(),
      text: '❌ 取消',
      type: 'callback_data',
      callback_data: 'action:cancel',
      newRow: false
    }
  ]
}

// 计算预览行
const previewRows = computed(() => {
  const rows: InlineButton[][] = []
  let currentRow: InlineButton[] = []

  buttons.value.forEach((button, index) => {
    currentRow.push(button)
    if (button.newRow && index < buttons.value.length - 1) {
      rows.push([...currentRow])
      currentRow = []
    }
  })

  if (currentRow.length > 0) {
    rows.push(currentRow)
  }

  return rows
})

// JSON 预览
const jsonPreview = computed(() => {
  const keyboard = previewRows.value.map(row =>
    row.map(btn => {
      if (btn.type === 'url') {
        return { text: btn.text, url: btn.url }
      }
      return { text: btn.text, callback_data: btn.callback_data }
    })
  )
  return JSON.stringify({ inline_keyboard: keyboard }, null, 2)
})

// 获取 Telegram API 格式的键盘数据
const getTelegramKeyboard = () => {
  return previewRows.value.map(row =>
    row.map(btn => {
      if (btn.type === 'url') {
        return { text: btn.text, url: btn.url }
      }
      return { text: btn.text, callback_data: btn.callback_data }
    })
  )
}

// 暴露方法给父组件
defineExpose({
  getTelegramKeyboard,
  clearAll,
  loadExample
})
</script>

<style scoped lang="scss">
.inline-keyboard-editor {
  border: 1px solid #dcdfe6;
  border-radius: 8px;
  padding: 16px;
  background: #f5f7fa;
}

.editor-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;

  h4 {
    margin: 0;
    color: #303133;
  }
}

.buttons-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 16px;
}

.button-item {
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  border: 1px solid #e4e7ed;
}

.button-row {
  display: flex;
  align-items: center;
  gap: 8px;

  &.second-row {
    margin-top: 8px;
    padding-left: 24px;
  }
}

.button-index {
  width: 20px;
  height: 20px;
  background: #409eff;
  color: #fff;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  flex-shrink: 0;
}

.button-text-input {
  flex: 1;
}

.button-type-select {
  width: 120px;
}

.callback-select,
.url-input {
  flex: 1;
}

.row-control {
  margin-top: 8px;
  padding-left: 24px;
  padding-top: 8px;
  border-top: 1px dashed #e4e7ed;
}

.keyboard-preview {
  background: #fff;
  border-radius: 6px;
  padding: 12px;
  margin-bottom: 16px;

  h5 {
    margin: 0 0 12px 0;
    color: #606266;
    font-size: 14px;
  }
}

.preview-container {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.preview-row {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.preview-button {
  flex: 1;
  min-width: 80px;
}

.editor-actions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.json-collapse {
  margin-top: 16px;
}

.json-preview {
  background: #2d2d2d;
  color: #f8f8f2;
  padding: 12px;
  border-radius: 4px;
  font-size: 12px;
  overflow-x: auto;
  margin: 0;
}
</style>
