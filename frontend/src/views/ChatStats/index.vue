<template>
  <div class="chat-stats-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <el-icon class="title-icon"><DataLine /></el-icon>
        群聊统计
      </h2>
      <p class="page-subtitle">统计群组成员发言数量，创建活跃排行榜</p>
    </div>

    <!-- 统计概览卡片 -->
    <el-row :gutter="16" class="stats-overview">
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon messages">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatNumber(stats.total_messages) }}</div>
            <div class="stat-label">总消息数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon members">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatNumber(stats.total_members) }}</div>
            <div class="stat-label">总成员数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon active">
            <el-icon><UserFilled /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatNumber(stats.active_members) }}</div>
            <div class="stat-label">活跃成员</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="6">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon today">
            <el-icon><Calendar /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ formatNumber(stats.messages_today) }}</div>
            <div class="stat-label">今日消息</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 主内容区 -->
    <el-row :gutter="20" class="main-content">
      <!-- 左侧：活跃排行榜 -->
      <el-col :xs="24" :lg="12">
        <el-card class="leaderboard-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon">
                  <el-icon><Trophy /></el-icon>
                </div>
                <span>活跃排行榜</span>
              </div>
              <el-button type="primary" text size="small" @click="refreshStats" :loading="loading">
                <el-icon><Refresh /></el-icon>
                刷新
              </el-button>
            </div>
          </template>

          <!-- 前三名展示 -->
          <div class="top-three-section" v-if="stats.top_posters && stats.top_posters.length > 0">
            <div 
              v-for="(poster, index) in topThree" 
              :key="poster.user_id"
              class="top-item"
              :class="'rank-' + (index + 1)"
            >
              <div class="rank-crown">{{ index + 1 }}</div>
              <el-avatar :size="64" :src="poster.avatar_url" class="top-avatar">
                {{ poster.username ? poster.username[0].toUpperCase() : '?' }}
              </el-avatar>
              <div class="top-name">{{ poster.username }}</div>
              <div class="top-stats">
                <span class="top-value">{{ formatNumber(poster.message_count) }}</span>
                <span class="top-label">条消息</span>
              </div>
            </div>
          </div>

          <!-- 其他排名（分页显示） -->
          <div class="other-ranks" v-if="paginatedOtherPosters.length > 0">
            <div 
              v-for="(poster, index) in paginatedOtherPosters" 
              :key="poster.user_id"
              class="rank-item"
            >
              <div class="rank-number">{{ (currentPage - 1) * pageSize + index + 4 }}</div>
              <el-avatar :size="40" :src="poster.avatar_url">
                {{ poster.username ? poster.username[0].toUpperCase() : '?' }}
              </el-avatar>
              <div class="rank-info">
                <div class="rank-name">{{ poster.username }}</div>
                <div class="rank-username" v-if="poster.user_id">ID: {{ poster.user_id }}</div>
              </div>
              <div class="rank-count">
                <span class="count-value">{{ formatNumber(poster.message_count) }}</span>
                <span class="count-label">条消息</span>
              </div>
            </div>
          </div>

          <!-- 分页控件 -->
          <div class="pagination-controls" v-if="otherPosters.length > pageSize">
            <el-button 
              size="small" 
              :disabled="currentPage === 1"
              @click="currentPage--"
            >
              <el-icon><ArrowLeft /></el-icon>
              上一页
            </el-button>
            <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
            <el-button 
              size="small" 
              :disabled="currentPage === totalPages"
              @click="currentPage++"
            >
              下一页
              <el-icon><ArrowRight /></el-icon>
            </el-button>
          </div>

          <el-empty v-if="!stats.top_posters || stats.top_posters.length === 0" description="暂无排行榜数据" />
        </el-card>
      </el-col>

      <!-- 右侧：配置面板 -->
      <el-col :xs="24" :lg="12">
        <el-card class="config-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon setting">
                  <el-icon><Setting /></el-icon>
                </div>
                <span>排行榜配置</span>
              </div>
            </div>
          </template>

          <el-form :model="config" label-position="top" size="default">
            <el-form-item>
              <template #label>
                <span class="form-label">启用排行榜</span>
              </template>
              <el-switch v-model="config.is_enabled" />
            </el-form-item>

            <el-form-item>
              <template #label>
                <span class="form-label">统计周期</span>
              </template>
              <el-radio-group v-model="config.ranking_period" size="small">
                <el-radio-button label="all_time">总榜</el-radio-button>
                <el-radio-button label="monthly">本月</el-radio-button>
                <el-radio-button label="weekly">本周</el-radio-button>
                <el-radio-button label="daily">今日</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item>
              <template #label>
                <span class="form-label">显示前 {{ config.show_top_count }} 名</span>
              </template>
              <el-slider v-model="config.show_top_count" :min="3" :max="50" :step="1" show-stops />
            </el-form-item>

            <el-divider content-position="left">关键词触发</el-divider>

            <el-form-item>
              <template #label>
                <span class="form-label">启用关键词触发</span>
              </template>
              <el-switch v-model="config.enable_keyword_trigger" />
            </el-form-item>

            <el-form-item v-if="config.enable_keyword_trigger">
              <template #label>
                <span class="form-label">触发关键词</span>
              </template>
              <el-input
                v-model="config.trigger_keyword"
                placeholder="如: 活跃排行、发言排行"
                style="width: 100%"
              />
              <div class="form-hint">群成员发送此关键词后会收到活跃排行榜消息</div>
            </el-form-item>

            <el-divider content-position="left">消息模板</el-divider>

            <!-- 左右布局的消息编辑器 -->
            <div class="message-editor-section">
              <div class="editor-row">
                <!-- 左侧：编辑器 -->
                <div class="editor-col">
                  <div class="editor-header">
                    <span class="editor-title">排行榜消息编辑</span>
                    <div class="editor-tools">
                      <el-button size="small" @click="insertVariable('{leaderboard}')">
                        插入排行榜
                      </el-button>
                      <el-button size="small" @click="insertVariable('{group_name}')">
                        插入群名
                      </el-button>
                    </div>
                  </div>
                  
                  <el-input
                    ref="messageTemplateRef"
                    v-model="config.message_template"
                    type="textarea"
                    :rows="12"
                    placeholder="输入排行榜消息内容...&#10;可用变量：&#10;{leaderboard} - 排行榜列表&#10;{group_name} - 群组名称&#10;{period} - 统计周期&#10;{total_messages} - 总消息数&#10;{active_members} - 活跃成员数"
                    class="message-textarea"
                  />

                  <!-- 图片上传 -->
                  <div class="image-upload-section">
                    <el-button size="small" @click="showImageUpload = true">
                      <el-icon><Picture /></el-icon>
                      添加图片
                    </el-button>
                    <div v-if="config.image_url" class="image-preview">
                      <img :src="config.image_url" alt="预览" />
                      <el-button type="danger" link size="small" @click="config.image_url = ''">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>

                  <!-- 按钮配置 -->
                  <div class="buttons-section">
                    <div class="section-title">
                      <span>内联按钮</span>
                      <el-button type="primary" link size="small" @click="addInlineButton">
                        <el-icon><Plus /></el-icon> 添加
                      </el-button>
                    </div>
                    <div class="buttons-list">
                      <div v-for="(btn, index) in config.inline_buttons" :key="index" class="button-item">
                        <el-input v-model="btn.text" placeholder="按钮文字" size="small" style="width: 120px;" />
                        <el-input v-model="btn.callback_data" placeholder="回调数据" size="small" style="width: 120px;" />
                        <el-button type="danger" link size="small" @click="removeInlineButton(index)">
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 右侧：预览 -->
                <div class="preview-col">
                  <div class="preview-header">
                    <span class="preview-title">消息预览</span>
                  </div>
                  <div class="telegram-preview">
                    <div class="message-bubble">
                      <!-- 图片预览 -->
                      <div v-if="config.image_url" class="preview-image">
                        <img :src="config.image_url" />
                      </div>
                      
                      <!-- 消息内容预览 -->
                      <div class="preview-content" v-html="renderedMessage"></div>
                      
                      <!-- 内联按钮预览 -->
                      <div v-if="config.inline_buttons && config.inline_buttons.length > 0" class="preview-inline-buttons">
                        <button
                          v-for="(btn, index) in config.inline_buttons"
                          :key="index"
                          class="preview-inline-btn"
                        >
                          {{ btn.text || '按钮' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <el-form-item class="form-actions">
              <el-button type="primary" @click="saveConfig" :loading="saving" style="width: 100%">
                <el-icon><Check /></el-icon>
                保存配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- 图片上传对话框 -->
    <el-dialog v-model="showImageUpload" title="上传图片" width="500px">
      <el-upload
        class="image-uploader"
        action="#"
        :auto-upload="false"
        :on-change="handleImageChange"
        :show-file-list="false"
        accept="image/*"
      >
        <img v-if="tempImageUrl" :src="tempImageUrl" class="upload-preview" />
        <div v-else class="upload-placeholder">
          <el-icon><Plus /></el-icon>
          <div>点击上传图片</div>
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="showImageUpload = false">取消</el-button>
        <el-button type="primary" @click="confirmImageUpload">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  DataLine, ChatDotRound, User, UserFilled, Calendar,
  Trophy, Setting, Check, Refresh, Plus, Delete, Picture,
  ArrowLeft, ArrowRight
} from '@element-plus/icons-vue'
import api from '@/api'

// 统计数据
const stats = ref({
  total_messages: 0,
  total_members: 0,
  active_members: 0,
  messages_today: 0,
  top_posters: [] as any[]
})

// 配置
const config = ref({
  is_enabled: true,
  ranking_period: 'monthly',
  show_top_count: 10,
  enable_keyword_trigger: false,
  trigger_keyword: '活跃排行',
  message_template: '📊 <b>{group_name} 活跃排行榜</b>\n\n{leaderboard}\n\n💬 统计周期: {period}',
  image_url: '',
  inline_buttons: [] as { text: string; callback_data: string }[]
})

const loading = ref(false)
const saving = ref(false)
const showImageUpload = ref(false)
const tempImageUrl = ref('')
const messageTemplateRef = ref<any>(null)

// 分页相关
const currentPage = ref(1)
const pageSize = 10

// 分页后的其他排名数据
const paginatedOtherPosters = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return otherPosters.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(otherPosters.value.length / pageSize)
})

// 前三名
const topThree = computed(() => {
  return stats.value.top_posters?.slice(0, 3) || []
})

// 其他排名
const otherPosters = computed(() => {
  return stats.value.top_posters?.slice(3) || []
})

// 渲染预览消息
const renderedMessage = computed(() => {
  let message = config.value.message_template
  
  // 替换变量
  message = message.replace(/\{leaderboard\}/g, getLeaderboardPreview())
  message = message.replace(/\{group_name\}/g, '测试群组')
  message = message.replace(/\{period\}/g, getPeriodLabel())
  message = message.replace(/\{total_messages\}/g, formatNumber(stats.value.total_messages))
  message = message.replace(/\{active_members\}/g, formatNumber(stats.value.active_members))
  
  // 转换HTML标签
  message = message
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;b&gt;/g, '<b>')
    .replace(/&lt;\/b&gt;/g, '</b>')
    .replace(/&lt;i&gt;/g, '<i>')
    .replace(/&lt;\/i&gt;/g, '</i>')
    .replace(/&lt;code&gt;/g, '<code>')
    .replace(/&lt;\/code&gt;/g, '</code>')
    .replace(/\n/g, '<br>')
  
  return message
})

// 获取排行榜预览
function getLeaderboardPreview(): string {
  if (!stats.value.top_posters || stats.value.top_posters.length === 0) {
    return '暂无数据'
  }
  
  return stats.value.top_posters
    .slice(0, config.value.show_top_count)
    .map((poster, index) => {
      const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`
      return `${medal} ${poster.username} - ${formatNumber(poster.message_count)} 条消息`
    })
    .join('\n')
}

// 获取周期标签
function getPeriodLabel(): string {
  const labels: Record<string, string> = {
    all_time: '总榜',
    monthly: '本月',
    weekly: '本周',
    daily: '今日'
  }
  return labels[config.value.ranking_period] || '总榜'
}

// 格式化数字
function formatNumber(num: number): string {
  if (!num) return '0'
  return num.toLocaleString('zh-CN')
}

// 获取统计数据
const fetchStats = async () => {
  loading.value = true
  try {
    const response = await api.get<ApiResponse<any>>('/admin/chat-stats?action=stats&group_id=demo-1')
    if (response.success && response.data) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('Fetch stats error:', error)
    // 使用模拟数据
    stats.value = {
      total_messages: 15234,
      total_members: 856,
      active_members: 342,
      messages_today: 1234,
      top_posters: [
        { user_id: '1', username: '张三', message_count: 1234, avatar_url: '' },
        { user_id: '2', username: '李四', message_count: 987, avatar_url: '' },
        { user_id: '3', username: '王五', message_count: 856, avatar_url: '' },
        { user_id: '4', username: '赵六', message_count: 654, avatar_url: '' },
        { user_id: '5', username: '钱七', message_count: 543, avatar_url: '' }
      ]
    }
  } finally {
    loading.value = false
  }
}

// 获取配置
const fetchConfig = async () => {
  try {
    const response = await api.get<ApiResponse<any>>('/admin/chat-stats?action=config&group_id=demo-1')
    if (response.success && response.data) {
      config.value = { ...config.value, ...response.data }
    }
  } catch (error) {
    console.error('Fetch config error:', error)
  }
}

// 保存配置
const saveConfig = async () => {
  saving.value = true
  try {
    const response = await api.put<ApiResponse>('/admin/chat-stats?action=config&group_id=demo-1', config.value)
    if (response.success) {
      ElMessage.success('配置已保存')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 刷新统计
const refreshStats = () => {
  currentPage.value = 1 // 重置到第一页
  fetchStats()
  ElMessage.success('统计数据已刷新')
}

// 插入变量到光标位置
const insertVariable = (variable: string) => {
  const textarea = messageTemplateRef.value?.$el?.querySelector('textarea')
  const currentValue = config.value.message_template || ''
  
  if (!textarea) {
    config.value.message_template = currentValue + variable
    return
  }
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  config.value.message_template = currentValue.substring(0, start) + variable + currentValue.substring(end)
  
  nextTick(() => {
    const newCursorPos = start + variable.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// 添加内联按钮
const addInlineButton = () => {
  config.value.inline_buttons.push({
    text: '',
    callback_data: ''
  })
}

// 移除内联按钮
const removeInlineButton = (index: number) => {
  config.value.inline_buttons.splice(index, 1)
}

// 处理图片上传
const handleImageChange = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    tempImageUrl.value = e.target?.result as string
  }
  reader.readAsDataURL(file.raw)
}

// 确认图片上传
const confirmImageUpload = () => {
  config.value.image_url = tempImageUrl.value
  showImageUpload.value = false
  tempImageUrl.value = ''
}

// 初始化
onMounted(() => {
  fetchStats()
  fetchConfig()
})
</script>

<style scoped lang="scss">
.chat-stats-page {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

// 页面标题
.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon {
      color: #3b82f6;
      font-size: 28px;
    }
  }

  .page-subtitle {
    font-size: 14px;
    color: #4b5563;
    margin: 0;
    font-weight: 500;
  }
}

// 统计概览卡片
.stats-overview {
  margin-bottom: 24px;

  .stat-card {
    display: flex;
    align-items: center;
    padding: 20px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      font-size: 24px;

      &.messages {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
      }

      &.members {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
      }

      &.active {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      &.today {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
      }
    }

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        line-height: 1.2;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 13px;
        color: #374151;
        font-weight: 500;
      }
    }
  }
}

// 主内容区
.main-content {
  .leaderboard-card,
  .config-card {
    margin-bottom: 20px;
    border-radius: 12px;

    :deep(.el-card__header) {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    :deep(.el-card__body) {
      padding: 20px;
    }
  }
}

// 卡片头部通用样式
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .header-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;

      &.setting {
        background: #f3e8ff;
        color: #7c3aed;
      }
    }

    span {
      font-weight: 600;
      font-size: 15px;
      color: #1f2937;
    }
  }
}

// 排行榜样式
.leaderboard-card {
  .card-header {
    .header-left {
      .header-icon {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: white;
      }
    }
  }
}

// 前三名特殊展示
.top-three-section {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 24px;
  padding: 24px 0 32px;
  margin-bottom: 24px;
  border-bottom: 1px dashed #e5e7eb;

  .top-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;

    &.rank-1 {
      order: 2;
      transform: scale(1.1);
      z-index: 3;

      .rank-crown {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: white;
      }
    }

    &.rank-2 {
      order: 1;
      z-index: 2;

      .rank-crown {
        background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
        color: white;
      }
    }

    &.rank-3 {
      order: 3;
      z-index: 1;

      .rank-crown {
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
      }
    }

    .rank-crown {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .top-avatar {
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 12px;
    }

    .top-name {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
      margin-bottom: 4px;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .top-stats {
      .top-value {
        font-size: 20px;
        font-weight: 700;
        color: #f59e0b;
      }

      .top-label {
        font-size: 12px;
        color: #4b5563;
        margin-left: 4px;
        font-weight: 500;
      }
    }
  }
}

// 其他排名
.other-ranks {
  .rank-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f9fafb;
    }

    &:not(:last-child) {
      margin-bottom: 4px;
    }

    .rank-number {
      width: 32px;
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      text-align: center;
    }

    .el-avatar {
      margin: 0 12px;
    }

    .rank-info {
      flex: 1;
      min-width: 0;

      .rank-name {
        font-weight: 500;
        font-size: 14px;
        color: #1f2937;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rank-username {
        font-size: 12px;
        color: #6b7280;
      }
    }

    .rank-count {
      text-align: right;

      .count-value {
        font-size: 16px;
        font-weight: 600;
        color: #3b82f6;
      }

      .count-label {
        font-size: 12px;
        color: #6b7280;
        margin-left: 4px;
      }
    }
  }
}

// 分页控件
.pagination-controls {
  display: flex;
  justify-content: center;
  align-items: center;
  gap: 16px;
  padding: 16px 0;
  margin-top: 8px;
  border-top: 1px solid #e5e7eb;

  .page-info {
    font-size: 14px;
    color: #6b7280;
    font-weight: 500;
  }
}

// 配置卡片
.config-card {
  .form-label {
    font-weight: 500;
    color: #374151;
  }

  .form-hint {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.5;
  }

  .form-actions {
    margin-top: 24px;
    margin-bottom: 0;
  }

  :deep(.el-divider__text) {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }
}

// 消息编辑器区域 - 左右布局
.message-editor-section {
  margin-top: 16px;

  .editor-row {
    display: flex;
    gap: 20px;
    min-height: 400px;

    .editor-col,
    .preview-col {
      flex: 1;
      min-width: 0;
    }

    .editor-col {
      display: flex;
      flex-direction: column;

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;

        .editor-title {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }

        .editor-tools {
          display: flex;
          gap: 8px;
        }
      }

      .message-textarea {
        flex: 1;

        :deep(.el-textarea__inner) {
          font-family: 'Consolas', 'Monaco', monospace;
          resize: none;
          min-height: 200px;
        }
      }

      .image-upload-section {
        margin-top: 12px;
        display: flex;
        align-items: center;
        gap: 12px;

        .image-preview {
          display: flex;
          align-items: center;
          gap: 8px;

          img {
            width: 60px;
            height: 60px;
            object-fit: cover;
            border-radius: 4px;
          }
        }
      }

      .buttons-section {
        margin-top: 16px;

        .section-title {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
          font-size: 13px;
          color: #374151;
          font-weight: 500;
        }

        .buttons-list {
          display: flex;
          flex-direction: column;
          gap: 8px;

          .button-item {
            display: flex;
            align-items: center;
            gap: 8px;
          }
        }
      }
    }

    .preview-col {
      display: flex;
      flex-direction: column;

      .preview-header {
        margin-bottom: 12px;

        .preview-title {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }
      }

      .telegram-preview {
        flex: 1;
        background: #f5f7fa;
        border-radius: 8px;
        padding: 16px;
        overflow-y: auto;

        .message-bubble {
          background: white;
          border-radius: 12px;
          padding: 12px;
          max-width: 100%;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

          .preview-image {
            margin-bottom: 8px;

            img {
              width: 100%;
              border-radius: 8px;
              max-height: 200px;
              object-fit: cover;
            }
          }

          .preview-content {
            font-size: 14px;
            line-height: 1.6;
            color: #1f2937;
            white-space: pre-wrap;
            word-break: break-word;

            :deep(b) {
              font-weight: bold;
            }

            :deep(i) {
              font-style: italic;
            }

            :deep(code) {
              background: #f3f4f6;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 13px;
            }
          }

          .preview-inline-buttons {
            margin-top: 12px;
            display: flex;
            flex-direction: column;
            gap: 8px;

            .preview-inline-btn {
              background: white;
              border: 1px solid #e5e7eb;
              border-radius: 6px;
              padding: 8px 16px;
              font-size: 14px;
              color: #3b82f6;
              cursor: pointer;
              width: 100%;
              text-align: center;

              &:hover {
                background: #f9fafb;
              }
            }
          }
        }
      }
    }
  }
}

// 图片上传对话框
.image-uploader {
  :deep(.el-upload) {
    width: 100%;
    height: 200px;
    border: 2px dashed #d9d9d9;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s;

    &:hover {
      border-color: #409eff;
    }
  }

  .upload-preview {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .upload-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #8c939d;

    .el-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
  }
}
</style>
