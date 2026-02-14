<template>
  <div class="anti-spam-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>刷屏处理配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-form :model="formData" label-width="120px">
        <el-form-item label="启用刷屏处理">
          <el-switch
            v-model="formData.enabled"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>

        <div v-if="formData.enabled">
          <el-divider content-position="left">消息频率限制</el-divider>

          <el-form-item label="最大消息数">
            <el-input-number
              v-model="formData.max_messages"
              :min="1"
              :max="100"
              :step="1"
            />
            <span class="unit">条</span>
            <span class="tip">在时间窗口内允许的最大消息数</span>
          </el-form-item>

          <el-form-item label="时间窗口">
            <el-input-number
              v-model="formData.time_window"
              :min="1"
              :max="300"
              :step="1"
            />
            <span class="unit">秒</span>
            <span class="tip">检测刷屏的时间范围</span>
          </el-form-item>

          <el-divider content-position="left">惩罚措施</el-divider>

          <el-form-item label="惩罚类型">
            <el-select v-model="formData.punishment">
              <el-option label="删除消息" value="delete" />
              <el-option label="警告用户" value="warn" />
              <el-option label="禁言用户" value="mute" />
              <el-option label="踢出用户" value="kick" />
              <el-option label="封禁用户" value="ban" />
            </el-select>
          </el-form-item>

          <el-form-item label="禁言时长" v-if="formData.punishment === 'mute'">
            <el-input-number
              v-model="formData.mute_duration"
              :min="60"
              :max="86400"
              :step="60"
            />
            <span class="unit">秒</span>
          </el-form-item>

          <el-form-item label="警告次数限制" v-if="formData.punishment === 'warn'">
            <el-input-number
              v-model="formData.warn_limit"
              :min="1"
              :max="10"
              :step="1"
            />
            <span class="unit">次</span>
            <span class="tip">超过此次数将自动踢出</span>
          </el-form-item>

          <el-divider content-position="left">重复消息检测</el-divider>

          <el-form-item label="检测重复消息">
            <el-switch
              v-model="formData.check_duplicates"
              active-text="启用"
              inactive-text="禁用"
            />
          </el-form-item>

          <el-form-item label="重复阈值" v-if="formData.check_duplicates">
            <el-input-number
              v-model="formData.duplicate_threshold"
              :min="2"
              :max="10"
              :step="1"
            />
            <span class="unit">次</span>
            <span class="tip">相同消息发送超过此次数视为刷屏</span>
          </el-form-item>
        </div>
      </el-form>
    </el-card>

    <el-card class="stats-card">
      <template #header>
        <span>刷屏处理统计</span>
      </template>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">今日检测</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">刷屏拦截</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">用户警告</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">惩罚执行</div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

interface AntiSpamConfig {
  enabled: boolean
  max_messages: number
  time_window: number
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban'
  mute_duration?: number
  warn_limit?: number
  check_duplicates: boolean
  duplicate_threshold: number
}

const formData = ref<AntiSpamConfig>({
  enabled: false,
  max_messages: 5,
  time_window: 10,
  punishment: 'mute',
  mute_duration: 300,
  warn_limit: 3,
  check_duplicates: true,
  duplicate_threshold: 3
})

async function loadConfig() {
  try {
    const response = await api.get<{ data: AntiSpamConfig }>('/admin/anti-spam?groupId=demo')
    if (response.data) {
      formData.value = response.data
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

async function saveConfig() {
  try {
    const response = await api.post<ApiResponse>('/admin/anti-spam', {
      groupId: 'demo',
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
</script>

<style scoped lang="scss">
.anti-spam-config {
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

.tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
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
  background: #f5f7fa;
  border-radius: 8px;
}

.stat-value {
  font-size: 24px;
  font-weight: 600;
  color: #409eff;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 14px;
  color: #909399;
}
</style>
