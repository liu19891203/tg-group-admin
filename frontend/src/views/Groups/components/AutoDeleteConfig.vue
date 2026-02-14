<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用自动删除">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="删除规则">
          <div class="rules-list">
            <div v-for="(rule, index) in modelValue.rules" :key="index" class="rule-item">
              <el-tag size="small">{{ rule.type }}</el-tag>
              <span class="rule-desc">{{ getRuleDesc(rule) }}</span>
              <el-button type="danger" size="small" :icon="Delete" @click="removeRule(index)" />
            </div>
            
            <el-button type="primary" plain size="small" @click="showAddRule = true">
              <el-icon><Plus /></el-icon>
              添加规则
            </el-button>
          </div>
        </el-form-item>
      </template>
    </el-form>
    
    <el-dialog v-model="showAddRule" title="添加删除规则" width="500px">
      <el-form :model="newRule" label-width="100px">
        <el-form-item label="规则类型">
          <el-select v-model="newRule.type">
            <el-option label="色情图片" value="porn" />
            <el-option label="外部回复" value="external" />
            <el-option label="贴纸消息" value="sticker" />
            <el-option label="链接消息" value="link" />
            <el-option label="长消息" value="long" />
            <el-option label="视频消息" value="video" />
            <el-option label="文档消息" value="doc" />
            <el-option label="可执行文件" value="exec" />
            <el-option label="转发消息" value="forward" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="newRule.type === 'long'" label="字符限制">
          <el-input-number v-model="newRule.max_length" :min="100" :max="5000" />
          <span class="tip"> 超过此长度的消息将被删除</span>
        </el-form-item>
        
        <el-form-item label="关键词（可选）">
          <el-input v-model="newRule.keywords_text" placeholder="每行一个" type="textarea" :rows="2" />
        </el-form-item>
        
        <el-form-item label="通知发送者">
          <el-switch v-model="newRule.notify" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showAddRule = false">取消</el-button>
        <el-button type="primary" @click="addRule">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Delete, Plus } from '@element-plus/icons-vue'

interface AutoDeleteRule {
  type: string
  keywords?: string[]
  max_length?: number
  notify: boolean
}

interface AutoDeleteConfig {
  enabled: boolean
  rules: AutoDeleteRule[]
}

const props = defineProps<{
  modelValue?: AutoDeleteConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AutoDeleteConfig]
}>()

const showAddRule = ref(false)
const newRule = reactive({
  type: 'link',
  keywords_text: '',
  max_length: 500,
  notify: true
})

function getRuleDesc(rule: AutoDeleteRule) {
  const typeDescs: Record<string, string> = {
    porn: '检测到色情内容',
    external: '外部回复消息',
    sticker: '贴纸消息',
    link: '链接消息',
    long: `超过 ${rule.max_length} 字符`,
    video: '视频消息',
    doc: '文档消息',
    exec: '可执行文件',
    forward: '转发消息'
  }
  return typeDescs[rule.type] || rule.type
}

function removeRule(index: number) {
  const rules = [...props.modelValue.rules]
  rules.splice(index, 1)
  emit('update:modelValue', { ...props.modelValue, rules })
}

function addRule() {
  const keywords = newRule.keywords_text
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0)
  
  const rule: AutoDeleteRule = {
    type: newRule.type,
    notify: newRule.notify
  }
  
  if (newRule.type === 'long') {
    rule.max_length = newRule.max_length
  }
  
  if (keywords.length > 0) {
    rule.keywords = keywords
  }
  
  const rules = [...props.modelValue.rules, rule]
  emit('update:modelValue', { ...props.modelValue, rules })
  
  showAddRule.value = false
  Object.assign(newRule, { type: 'link', keywords_text: '', max_length: 500, notify: true })
}
</script>

<style scoped lang="scss">
.config-form {
  .rules-list {
    width: 100%;
  }
  
  .rule-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #ebeef5;
    
    .rule-desc {
      flex: 1;
      color: #606266;
      font-size: 13px;
    }
  }
  
  .tip {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }
}
</style>
