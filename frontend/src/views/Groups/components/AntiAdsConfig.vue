<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用广告过滤">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="检测类型">
          <el-checkbox v-model="modelValue.sticker_ads">贴纸广告</el-checkbox>
          <el-checkbox v-model="modelValue.keyword_ads">关键词广告</el-checkbox>
          <el-checkbox v-model="modelValue.link_ads">链接广告</el-checkbox>
          <el-checkbox v-model="modelValue.image_ads">图片广告</el-checkbox>
        </el-form-item>
        
        <el-form-item label="关键词列表">
          <el-input
            v-model="keywordsText"
            type="textarea"
            :rows="4"
            placeholder="每行一个关键词"
            @blur="updateKeywords"
          />
          <span class="tip"> 包含这些关键词的消息将被视为广告</span>
        </el-form-item>
        
        <el-form-item label="惩罚措施">
          <el-select v-model="modelValue.punishment">
            <el-option label="仅删除消息" value="delete" />
            <el-option label="删除并警告" value="warn" />
            <el-option label="删除并禁言" value="mute" />
            <el-option label="删除并踢出" value="kick" />
            <el-option label="删除并封禁" value="ban" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="modelValue.punishment === 'warn'" label="警告上限">
          <el-input-number v-model="modelValue.warn_limit" :min="1" :max="10" />
          <span class="tip"> 次警告后自动踢出</span>
        </el-form-item>
        
        <el-form-item label="通知发送者">
          <el-switch v-model="modelValue.notify_sender" />
          <span class="tip"> 发送广告检测通知</span>
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface AntiAdsConfig {
  enabled: boolean
  sticker_ads: boolean
  keyword_ads: boolean
  link_ads: boolean
  image_ads: boolean
  keywords: string[]
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban'
  warn_limit: number
  notify_sender: boolean
}

const props = defineProps<{
  modelValue?: AntiAdsConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: AntiAdsConfig]
}>()

const keywordsText = ref('')

watch(() => props.modelValue.keywords, (val) => {
  keywordsText.value = (val || []).join('\n')
}, { immediate: true })

function updateKeywords() {
  const keywords = keywordsText.value
    .split('\n')
    .map(k => k.trim())
    .filter(k => k.length > 0)
  
  emit('update:modelValue', { ...props.modelValue, keywords })
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
</style>
