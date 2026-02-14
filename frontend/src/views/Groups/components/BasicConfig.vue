<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="群组名称">
        <el-input v-model="localConfig.title" placeholder="输入群组名称" />
      </el-form-item>
      
      <el-form-item label="群组描述">
        <el-input 
          v-model="localConfig.description" 
          type="textarea" 
          :rows="3"
          placeholder="输入群组描述"
        />
      </el-form-item>
      
      <el-form-item label="欢迎消息">
        <el-input 
          v-model="localConfig.welcome_message" 
          type="textarea" 
          :rows="4"
          placeholder="输入欢迎消息，支持HTML标签"
        />
        <div class="form-tip">
          可用变量: {user_name}, {group_name}, {user_id}
        </div>
      </el-form-item>
      
      <el-form-item label="离开消息">
        <el-input 
          v-model="localConfig.leave_message" 
          type="textarea" 
          :rows="3"
          placeholder="输入成员离开时的消息"
        />
      </el-form-item>
      
      <el-form-item label="群组状态">
        <el-switch 
          v-model="localConfig.is_active" 
          active-text="启用"
          inactive-text="禁用"
        />
      </el-form-item>
      
      <el-form-item label="慢模式">
        <el-select v-model="localConfig.slow_mode" placeholder="选择慢模式间隔">
          <el-option label="关闭" :value="0" />
          <el-option label="5秒" :value="5" />
          <el-option label="10秒" :value="10" />
          <el-option label="30秒" :value="30" />
          <el-option label="1分钟" :value="60" />
          <el-option label="5分钟" :value="300" />
        </el-select>
        <div class="form-tip">限制成员发送消息的间隔时间</div>
      </el-form-item>
      
      <el-form-item label="消息保留">
        <el-input-number 
          v-model="localConfig.message_retention_days" 
          :min="1" 
          :max="365"
          placeholder="天数"
        />
        <span class="unit-text">天</span>
        <div class="form-tip">自动清理超过此天数的历史消息</div>
      </el-form-item>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'

interface BasicConfig {
  title?: string
  description?: string
  welcome_message?: string
  leave_message?: string
  is_active?: boolean
  slow_mode?: number
  message_retention_days?: number
}

const props = defineProps<{
  modelValue: BasicConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: BasicConfig]
}>()

const localConfig = computed({
  get: () => props.modelValue || {},
  set: (val) => emit('update:modelValue', val)
})
</script>

<style scoped lang="scss">
.config-form {
  padding: 20px;
  max-width: 600px;
}

.form-tip {
  font-size: 12px;
  color: #909399;
  margin-top: 4px;
}

.unit-text {
  margin-left: 8px;
  color: #606266;
}
</style>
