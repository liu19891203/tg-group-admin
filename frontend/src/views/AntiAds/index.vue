<template>
  <div class="anti-ads-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>广告过滤配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-form :model="formData" label-width="120px">
        <el-form-item label="启用过滤">
          <el-switch
            v-model="formData.enabled"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>

        <div v-if="formData.enabled">
          <el-form-item label="关键词过滤">
            <el-tag
              v-for="keyword in formData.keywords"
              :key="keyword"
              closable
              @close="removeKeyword(keyword)"
              style="margin-right: 8px; margin-bottom: 8px;"
            >
              {{ keyword }}
            </el-tag>
            <el-input
              v-model="newKeyword"
              placeholder="输入关键词"
              style="width: 200px; margin-right: 8px;"
              @keyup.enter="addKeyword"
            />
            <el-button @click="addKeyword">添加</el-button>
          </el-form-item>

          <el-form-item label="惩罚措施">
            <el-select v-model="formData.punishment">
              <el-option label="删除消息" value="delete" />
              <el-option label="警告用户" value="warn" />
              <el-option label="禁言用户" value="mute" />
              <el-option label="踢出用户" value="kick" />
              <el-option label="封禁用户" value="ban" />
            </el-select>
          </el-form-item>

          <el-form-item label="警告次数限制">
            <el-input-number
              v-model="formData.warn_limit"
              :min="1"
              :max="10"
              :step="1"
            />
            <span class="unit">次</span>
          </el-form-item>

          <el-divider content-position="left">高级功能</el-divider>

          <el-form-item label="AI智能检测">
            <el-switch
              v-model="formData.ai_enabled"
              active-text="启用"
              inactive-text="禁用"
            />
            <span class="tip">使用AI识别复杂的广告内容</span>
          </el-form-item>

          <el-form-item label="图片广告检测">
            <el-switch
              v-model="formData.image_scan_enabled"
              active-text="启用"
              inactive-text="禁用"
            />
            <span class="tip">检测图片中的广告信息</span>
          </el-form-item>

          <el-form-item label="贴纸广告检测">
            <el-switch
              v-model="formData.sticker_check_enabled"
              active-text="启用"
              inactive-text="禁用"
            />
            <span class="tip">检测贴纸名称中的@引流</span>
          </el-form-item>
        </div>
      </el-form>

      <div class="test-section" v-if="formData.enabled">
        <h3>测试广告检测</h3>
        <div class="test-content">
          <el-input
            v-model="testMessage"
            placeholder="输入测试消息"
            style="width: 400px; margin-right: 10px;"
          />
          <el-button type="primary" @click="testDetection">测试检测</el-button>
          
          <div v-if="testResult" class="test-result">
            <el-alert
              :title="testResult.is_ad ? '检测到广告' : '未检测到广告'"
              :type="testResult.is_ad ? 'warning' : 'success'"
              :description="testResult.reason"
              show-icon
              style="margin-top: 10px;"
            />
            <div v-if="testResult.is_ad" class="result-details">
              <p>置信度: {{ (testResult.confidence * 100).toFixed(1) }}%</p>
              <p>惩罚措施: {{ {
                'delete': '删除消息',
                'warn': '警告用户', 
                'mute': '禁言用户',
                'kick': '踢出用户',
                'ban': '封禁用户'
              }[testResult.punishment] }}</p>
              <p v-if="testResult.matched_keywords">匹配关键词: {{ testResult.matched_keywords.join(', ') }}</p>
            </div>
          </div>
        </div>
      </div>
    </el-card>

    <el-card class="stats-card">
      <template #header>
        <span>广告过滤统计</span>
      </template>
      <div class="stats-grid">
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">今日检测</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">0</div>
          <div class="stat-label">广告拦截</div>
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
import { useSelectedGroup } from '@/composables/useSelectedGroup'

interface AntiAdsConfig {
  enabled: boolean
  keywords: string[]
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban'
  warn_limit: number
  ai_enabled: boolean
  image_scan_enabled: boolean
  sticker_check_enabled: boolean
}

interface DetectionResult {
  is_ad: boolean
  confidence: number
  reason: string
  matched_keywords?: string[]
  punishment: 'delete' | 'warn' | 'mute' | 'kick' | 'ban'
}

const { currentGroupId, hasGroup } = useSelectedGroup()

const formData = ref<AntiAdsConfig>({
  enabled: false,
  keywords: ['微信', 'QQ', '加群', '私聊', '推广', '广告'],
  punishment: 'delete',
  warn_limit: 3,
  ai_enabled: false,
  image_scan_enabled: false,
  sticker_check_enabled: true
})

const newKeyword = ref('')
const testMessage = ref('')
const testResult = ref<DetectionResult | null>(null)

async function loadConfig() {
  if (!currentGroupId.value) return
  try {
    const response = await api.get<{ data: AntiAdsConfig }>(`/admin/anti-ads?group_id=${currentGroupId.value}`)
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
    const response = await api.post<ApiResponse>('/admin/anti-ads', {
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

function addKeyword() {
  if (newKeyword.value.trim() && !formData.value.keywords.includes(newKeyword.value.trim())) {
    formData.value.keywords.push(newKeyword.value.trim())
    newKeyword.value = ''
  }
}

function removeKeyword(keyword: string) {
  formData.value.keywords = formData.value.keywords.filter(k => k !== keyword)
}

async function testDetection() {
  if (!currentGroupId.value) return
  if (!testMessage.value.trim()) {
    ElMessage.warning('请输入测试消息')
    return
  }

  try {
    const response = await api.post<DetectionResult>('/admin/anti-ads/detect', {
      group_id: currentGroupId.value,
      message: {
        text: testMessage.value,
        message_type: 'text'
      },
      config: formData.value
    })
    
    testResult.value = response
  } catch (error: any) {
    ElMessage.error(error.message || '检测失败')
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.anti-ads-config {
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
