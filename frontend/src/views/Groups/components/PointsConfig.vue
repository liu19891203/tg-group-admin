<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用积分系统">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="每日上限">
          <el-input-number v-model="modelValue.daily_limit" :min="10" :max="1000" />
          <span class="tip"> 每日最多获得积分</span>
        </el-form-item>
        
        <el-form-item label="发言积分">
          <el-input-number v-model="modelValue.per_message" :min="0.1" :max="2" :step="0.1" />
          <span class="tip"> 每 N 个中文字符 1 分</span>
        </el-form-item>
        
        <el-form-item label="签到基础">
          <el-input-number v-model="modelValue.checkin_base" :min="1" :max="100" />
          <span class="tip"> 基础签到积分</span>
        </el-form-item>
        
        <el-form-item label="连续签到奖励">
          <div class="bonus-config">
            <div v-for="(bonus, index) in bonusList" :key="index" class="bonus-item">
              <el-input-number
                v-model="bonusList[index]"
                :min="0"
                :max="50"
                size="small"
              />
              <span class="bonus-label">第 {{ index + 1 }} 天</span>
            </div>
          </div>
          <span class="tip"> 连续签到每天的额外奖励</span>
        </el-form-item>
        
        <el-form-item label="积分消费">
          <el-checkbox v-model="modelValue.can_spend_points">允许积分兑换/抽奖</el-checkbox>
        </el-form-item>
        
        <el-form-item label="排行榜">
          <el-switch v-model="modelValue.enable_leaderboard" />
          <span class="tip"> 启用积分排行榜</span>
        </el-form-item>
        
        <el-form-item label="积分指令">
          <el-checkbox v-model="modelValue.enable_checkin_cmd">/checkin 签到</el-checkbox>
          <el-checkbox v-model="modelValue.enable_rank_cmd">/rank 排行榜</el-checkbox>
          <el-checkbox v-model="modelValue.enable_me_cmd">/me 我的积分</el-checkbox>
        </el-form-item>
      </template>
    </el-form>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'

interface PointsConfig {
  enabled: boolean
  daily_limit: number
  per_message: number
  checkin_base: number
  checkin_bonus: number[]
  can_spend_points: boolean
  enable_leaderboard: boolean
  enable_checkin_cmd: boolean
  enable_rank_cmd: boolean
  enable_me_cmd: boolean
}

const props = defineProps<{
  modelValue?: PointsConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: PointsConfig]
}>()

const bonusList = ref<number[]>([2, 5, 10, 20])

watch(() => props.modelValue.checkin_bonus, (val) => {
  if (val && val.length > 0) {
    bonusList.value = [...val]
  }
}, { immediate: true })

watch(bonusList, (val) => {
  emit('update:modelValue', { ...props.modelValue, checkin_bonus: [...val] })
}, { deep: true })
</script>

<style scoped lang="scss">
.config-form {
  .tip {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }
  
  .bonus-config {
    display: flex;
    gap: 12px;
    align-items: center;
    
    .bonus-label {
      font-size: 12px;
      color: #909399;
      white-space: nowrap;
    }
  }
}
</style>
