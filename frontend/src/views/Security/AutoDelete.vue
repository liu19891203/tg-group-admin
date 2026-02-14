<template>
  <div class="auto-delete-page">
    <div class="page-header">
      <h2 class="page-title">自动删除</h2>
      <el-button type="primary" @click="saveConfig" :loading="saving">
        <el-icon><Check /></el-icon>
        保存设置
      </el-button>
    </div>

    <el-alert
      v-if="!selectedGroupId"
      title="请先选择群组"
      type="warning"
      :closable="false"
      show-icon
      class="mb-4"
    />

    <template v-else>
      <!-- 总开关 -->
      <el-card class="mb-4">
        <div class="main-switch">
          <div class="switch-info">
            <h3>自动删除功能</h3>
            <p class="text-muted">开启后将根据下方配置自动删除符合条件的消息</p>
          </div>
          <el-switch
            v-model="config.enabled"
            size="large"
            active-text="开启"
            inactive-text="关闭"
          />
        </div>
      </el-card>

      <!-- 消息类型删除配置 -->
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>消息类型删除</span>
            <el-button link type="primary" @click="selectAllMessageTypes">
              全选
            </el-button>
          </div>
        </template>

        <el-row :gutter="20">
          <el-col :span="8" v-for="item in messageTypes" :key="item.key">
            <div class="delete-item">
              <el-checkbox v-model="config[item.key]">
                <div class="item-content">
                  <el-icon :size="20" :class="item.icon">
                    <component :is="item.icon" />
                  </el-icon>
                  <div class="item-info">
                    <div class="item-name">{{ item.label }}</div>
                    <div class="item-desc">{{ item.description }}</div>
                  </div>
                </div>
              </el-checkbox>
            </div>
          </el-col>
        </el-row>
      </el-card>

      <!-- 配置参数 -->
      <el-card class="mb-4">
        <template #header>
          <div class="card-header">
            <span>配置参数</span>
          </div>
        </template>

        <el-form :model="config" label-width="180px">
          <el-form-item label="超长消息阈值">
            <el-input-number
              v-model="config.long_message_threshold"
              :min="100"
              :max="5000"
              :step="100"
            />
            <span class="unit">字符</span>
          </el-form-item>

          <el-form-item label="删除延迟">
            <el-input-number
              v-model="config.delete_delay_seconds"
              :min="0"
              :max="300"
              :step="5"
            />
            <span class="unit">秒（0为立即删除）</span>
          </el-form-item>

          <el-form-item label="自定义关键词">
            <el-select
              v-model="config.custom_keywords"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="输入关键词后按回车添加"
              style="width: 100%"
            />
            <div class="form-tip">
              包含这些关键词的消息将被自动删除
            </div>
          </el-form-item>
        </el-form>
      </el-card>

      <!-- 测试区域 -->
      <el-card>
        <template #header>
          <div class="card-header">
            <span>测试配置</span>
          </div>
        </template>

        <div class="test-area">
          <el-input
            v-model="testMessage"
            type="textarea"
            :rows="3"
            placeholder="输入测试消息内容..."
          />
          <el-button 
            type="primary" 
            @click="testConfig"
            :loading="testing"
            class="mt-3"
          >
            测试
          </el-button>

          <div v-if="testResult" class="test-result" :class="testResult.type">
            <el-icon :size="20">
              <component :is="testResult.type === 'success' ? 'CircleCheck' : 'CircleClose'" />
            </el-icon>
            <span>{{ testResult.message }}</span>
          </div>
        </div>
      </el-card>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Check,
  Picture,
  ChatDotRound,
  Bell,
  Promotion,
  Link,
  Document,
  VideoCamera,
  Collection,
  Share,
  Box,
  Cpu,
  Files,
  ChatLineSquare,
  PriceTag,
  Delete,
  Orange,
  User,
  CircleCheck,
  CircleClose
} from '@element-plus/icons-vue'
import axios from 'axios'

interface AutoDeleteConfig {
  enabled: boolean
  delete_porn_images: boolean
  delete_external_replies: boolean
  delete_service_messages: boolean
  delete_channel_forward: boolean
  delete_links: boolean
  delete_long_messages: boolean
  delete_video_messages: boolean
  delete_stickers: boolean
  delete_forwards: boolean
  delete_archives: boolean
  delete_executables: boolean
  delete_documents: boolean
  delete_bot_commands: boolean
  delete_ad_stickers: boolean
  delete_all_messages: boolean
  delete_premium_emojis: boolean
  delete_contacts: boolean
  long_message_threshold: number
  custom_keywords: string[]
  delete_delay_seconds: number
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const config = reactive<AutoDeleteConfig>({
  enabled: false,
  delete_porn_images: false,
  delete_external_replies: false,
  delete_service_messages: false,
  delete_channel_forward: false,
  delete_links: false,
  delete_long_messages: false,
  delete_video_messages: false,
  delete_stickers: false,
  delete_forwards: false,
  delete_archives: false,
  delete_executables: false,
  delete_documents: false,
  delete_bot_commands: false,
  delete_ad_stickers: false,
  delete_all_messages: false,
  delete_premium_emojis: false,
  delete_contacts: false,
  long_message_threshold: 1000,
  custom_keywords: [],
  delete_delay_seconds: 0
})

const messageTypes = [
  { key: 'delete_porn_images', label: '色情图片', description: '删除包含色情内容的图片', icon: 'Picture' },
  { key: 'delete_external_replies', label: '外部回复', description: '删除引用外部消息', icon: 'ChatDotRound' },
  { key: 'delete_service_messages', label: '服务消息', description: '删除加入/离开通知', icon: 'Bell' },
  { key: 'delete_channel_forward', label: '频道马甲', description: '删除频道转发消息', icon: 'Promotion' },
  { key: 'delete_links', label: '链接消息', description: '删除包含链接的消息', icon: 'Link' },
  { key: 'delete_long_messages', label: '超长消息', description: '删除超过阈值的消息', icon: 'Document' },
  { key: 'delete_video_messages', label: '视频消息', description: '删除视频文件', icon: 'VideoCamera' },
  { key: 'delete_stickers', label: '贴纸消息', description: '删除贴纸消息', icon: 'Collection' },
  { key: 'delete_forwards', label: '转发消息', description: '删除所有转发消息', icon: 'Share' },
  { key: 'delete_archives', label: '压缩包', description: '删除压缩文件', icon: 'Box' },
  { key: 'delete_executables', label: '可执行文件', description: '删除exe等可执行文件', icon: 'Cpu' },
  { key: 'delete_documents', label: '文档', description: '删除文档文件', icon: 'Files' },
  { key: 'delete_bot_commands', label: '机器人命令', description: '删除其他机器人命令', icon: 'ChatLineSquare' },
  { key: 'delete_ad_stickers', label: '广告贴纸', description: '删除广告贴纸', icon: 'PriceTag' },
  { key: 'delete_all_messages', label: '全部消息', description: '删除所有消息（慎用）', icon: 'Delete' },
  { key: 'delete_premium_emojis', label: '会员表情', description: '删除会员专属表情', icon: 'Orange' },
  { key: 'delete_contacts', label: '分享联系人', description: '删除分享联系人消息', icon: 'User' }
]

const saving = ref(false)
const testing = ref(false)
const testMessage = ref('')
const testResult = ref<{ type: 'success' | 'error', message: string } | null>(null)

// 加载配置
const loadConfig = async () => {
  if (!selectedGroupId.value) return
  
  try {
    const response = await axios.get(`/api/admin/auto-delete?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      Object.assign(config, response.data.data)
    }
  } catch (error) {
    console.error('加载配置失败:', error)
    ElMessage.error('加载配置失败')
  }
}

// 保存配置
const saveConfig = async () => {
  if (!selectedGroupId.value) {
    ElMessage.warning('请先选择群组')
    return
  }

  saving.value = true
  try {
    const response = await axios.put(`/api/admin/auto-delete?group_id=${selectedGroupId.value}`, config)
    if (response.data.success) {
      ElMessage.success('配置已保存')
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 全选消息类型
const selectAllMessageTypes = () => {
  messageTypes.forEach(item => {
    (config as any)[item.key] = true
  })
}

// 测试配置
const testConfig = async () => {
  if (!testMessage.value.trim()) {
    ElMessage.warning('请输入测试消息')
    return
  }

  testing.value = true
  testResult.value = null

  try {
    const response = await axios.post('/api/admin/auto-delete/test', {
      message: testMessage.value,
      config
    })

    if (response.data.should_delete) {
      testResult.value = {
        type: 'error',
        message: `消息将被删除：${response.data.reason}`
      }
    } else {
      testResult.value = {
        type: 'success',
        message: '消息不会被删除'
      }
    }
  } catch (error) {
    console.error('测试失败:', error)
    ElMessage.error('测试失败')
  } finally {
    testing.value = false
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.auto-delete-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 24px;

    .page-title {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
      color: #303133;
    }
  }

  .main-switch {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .switch-info {
      h3 {
        margin: 0 0 8px 0;
        font-size: 18px;
      }

      .text-muted {
        color: #909399;
        margin: 0;
      }
    }
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-weight: 600;
  }

  .delete-item {
    padding: 16px;
    border: 1px solid #ebeef5;
    border-radius: 8px;
    margin-bottom: 16px;
    transition: all 0.3s;

    &:hover {
      border-color: #409eff;
      background: #f5f7fa;
    }

    .item-content {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 8px;

      .el-icon {
        color: #409eff;
      }

      .item-info {
        .item-name {
          font-weight: 500;
          color: #303133;
        }

        .item-desc {
          font-size: 12px;
          color: #909399;
          margin-top: 4px;
        }
      }
    }
  }

  .unit {
    margin-left: 8px;
    color: #606266;
  }

  .form-tip {
    font-size: 12px;
    color: #909399;
    margin-top: 4px;
  }

  .test-area {
    .test-result {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-top: 16px;
      padding: 12px;
      border-radius: 4px;

      &.success {
        background: #f0f9ff;
        color: #67c23a;
      }

      &.error {
        background: #fef0f0;
        color: #f56c6c;
      }
    }
  }

  .mb-4 {
    margin-bottom: 16px;
  }

  .mt-3 {
    margin-top: 12px;
  }
}
</style>
