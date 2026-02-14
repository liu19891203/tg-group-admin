<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用验证">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="验证方式">
          <el-select v-model="modelValue.type">
            <el-option label="关注频道验证" value="channel" />
            <el-option label="私聊验证" value="private" />
            <el-option label="图片验证码" value="captcha" />
            <el-option label="计算题验证" value="calculation" />
            <el-option label="GIF 验证码" value="gif" />
          </el-select>
        </el-form-item>
        
        <el-form-item v-if="modelValue.type === 'channel'" label="频道 ID">
          <el-input v-model.number="modelValue.channel_id" placeholder="-1001234567890" />
          <span class="tip"> 必须是机器人管理员的频道</span>
        </el-form-item>
        
        <el-form-item label="验证超时">
          <el-input-number v-model="modelValue.timeout" :min="60" :max="1800" />
          <span class="tip"> 秒</span>
        </el-form-item>
        
        <el-form-item label="验证失败惩罚">
          <el-select v-model="modelValue.punishment">
            <el-option label="踢出群组" value="kick" />
            <el-option label="封禁" value="ban" />
            <el-option label="禁言" value="mute" />
            <el-option label="警告" value="warn" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="白名单用户">
          <el-input
            v-model="modelValue.bypass_users_text"
            type="textarea"
            :rows="2"
            placeholder="输入用户 ID，每行一个"
          />
          <span class="tip"> 这些用户无需验证</span>
        </el-form-item>
        
        <el-form-item label="验证失败消息">
          <el-input
            v-model="modelValue.fail_message"
            type="textarea"
            :rows="2"
            placeholder="验证失败时发送的消息"
          />
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
interface VerificationConfig {
  enabled: boolean
  type: 'channel' | 'private' | 'captcha' | 'calculation' | 'gif'
  channel_id?: number
  timeout: number
  punishment: 'kick' | 'ban' | 'mute' | 'warn'
  bypass_users?: number[]
  bypass_users_text?: string
  fail_message?: string
}

const props = defineProps<{
  modelValue?: VerificationConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: VerificationConfig]
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
