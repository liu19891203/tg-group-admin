<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用刷屏检测">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="时间窗口">
          <el-input-number v-model="modelValue.time_window" :min="5" :max="60" />
          <span class="tip"> 秒内最多发送</span>
        </el-form-item>
        
        <el-form-item label="消息上限">
          <el-input-number v-model="modelValue.max_messages" :min="3" :max="20" />
          <span class="tip"> 条消息</span>
        </el-form-item>
        
        <el-form-item label="惩罚措施">
          <el-select v-model="modelValue.punishment">
            <el-option label="禁言" value="mute" />
            <el-option label="踢出" value="kick" />
            <el-option label="封禁" value="ban" />
            <el-option label="仅删除" value="delete" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="modelValue.punishment === 'mute'" label="禁言时长">
          <el-input-number v-model="modelValue.mute_duration" :min="60" :max="86400" />
          <span class="tip"> 秒</span>
        </el-form-item>
        
        <el-form-item label="忽略管理员">
          <el-switch v-model="modelValue.ignore_admins" />
          <span class="tip"> 管理员不受刷屏检测限制</span>
        </el-form-item>
        
        <el-form-item label="检测间隔">
          <el-input-number v-model="modelValue.check_interval" :min="1" :max="10" />
          <span class="tip"> 秒检测一次</span>
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
interface AntiSpamConfig {
  enabled: boolean
  time_window: number
  max_messages: number
  punishment: 'mute' | 'kick' | 'ban' | 'delete'
  mute_duration: number
  ignore_admins: boolean
  check_interval: number
}

defineProps<{
  modelValue?: AntiSpamConfig
}>()

defineEmits<{
  'update:modelValue': [value: AntiSpamConfig]
}>()
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
