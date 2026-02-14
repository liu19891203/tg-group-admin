<template>
  <div class="points-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>积分系统配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-form :model="formData" label-width="120px">
        <el-form-item label="启用积分系统">
          <el-switch
            v-model="formData.enabled"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>

        <div v-if="formData.enabled">
          <el-divider content-position="left">聊天积分设置</el-divider>

          <el-form-item label="每日积分上限">
            <el-input-number
              v-model="formData.daily_limit"
              :min="0"
              :max="1000"
              :step="10"
            />
            <span class="unit">分</span>
          </el-form-item>

          <el-form-item label="每条消息积分">
            <el-input-number
              v-model="formData.per_message"
              :min="0"
              :max="10"
              :step="0.1"
              :precision="1"
            />
            <span class="unit">分</span>
            <span class="tip">默认每5个中文字符获得1分</span>
          </el-form-item>

          <el-divider content-position="left">签到设置</el-divider>

          <el-form-item label="基础签到积分">
            <el-input-number
              v-model="formData.checkin_base"
              :min="0"
              :max="100"
              :step="1"
            />
            <span class="unit">分</span>
          </el-form-item>

          <el-form-item label="连续签到奖励">
            <div class="bonus-list">
              <div 
                v-for="(bonus, index) in formData.checkin_bonus" 
                :key="index"
                class="bonus-item"
              >
                <span>第{{ index + 1 }}天: </span>
                <el-input-number
                  v-model="formData.checkin_bonus[index]"
                  :min="0"
                  :max="50"
                  :step="1"
                  size="small"
                  style="width: 100px;"
                />
                <span class="unit">分</span>
              </div>
            </div>
          </el-form-item>

          <!-- 签到回复消息编辑 -->
          <el-form-item label="签到回复消息">
            <div class="checkin-message-editor">
              <el-input
                v-model="formData.checkin_message_template"
                type="textarea"
                :rows="4"
                placeholder="请输入签到成功后的回复消息..."
                class="checkin-editor"
              />
              <div class="variables-hint">
                <span class="hint-label">可用变量：</span>
                <el-tooltip content="用户名称" placement="top">
                  <el-tag size="small" effect="plain" class="variable-tag" @click="insertCheckinVariable('user_name')">{user_name}</el-tag>
                </el-tooltip>
                <el-tooltip content="获得积分" placement="top">
                  <el-tag size="small" effect="plain" class="variable-tag" @click="insertCheckinVariable('points_earned')">{points_earned}</el-tag>
                </el-tooltip>
                <el-tooltip content="总积分" placement="top">
                  <el-tag size="small" effect="plain" class="variable-tag" @click="insertCheckinVariable('total_points')">{total_points}</el-tag>
                </el-tooltip>
                <el-tooltip content="连续签到天数" placement="top">
                  <el-tag size="small" effect="plain" class="variable-tag" @click="insertCheckinVariable('streak')">{streak}</el-tag>
                </el-tooltip>
                <el-tooltip content="连续签到奖励" placement="top">
                  <el-tag size="small" effect="plain" class="variable-tag" @click="insertCheckinVariable('bonus')">{bonus}</el-tag>
                </el-tooltip>
                <el-tooltip content="群组名称" placement="top">
                  <el-tag size="small" effect="plain" class="variable-tag" @click="insertCheckinVariable('group_name')">{group_name}</el-tag>
                </el-tooltip>
              </div>
            </div>
          </el-form-item>

          <el-divider content-position="left">排行榜设置</el-divider>

          <el-form-item label="排行触发关键词">
            <el-input
              v-model="formData.rank_keyword"
              placeholder="输入触发排行榜的关键词"
              style="width: 300px;"
            />
            <span class="tip">用户在群内发送此关键词可查看积分排行</span>
          </el-form-item>

          <!-- 排行榜回复消息编辑 -->
          <el-form-item label="排行榜回复消息">
            <div class="message-editor-wrapper">
              <el-row :gutter="20" class="editor-preview-row">
                <!-- 左侧编辑区 -->
                <el-col :span="14">
                  <div class="editor-section">
                    <!-- 图片上传 -->
                    <div class="image-upload-wrapper">
                      <el-upload
                        class="image-uploader-button"
                        action="/api/admin/upload"
                        :show-file-list="false"
                        :on-success="handleRankImageSuccess"
                        :before-upload="beforeImageUpload"
                        accept="image/*"
                      >
                        <el-button type="primary" :icon="Plus" size="small">
                          {{ formData.rank_message_image ? '更换图片' : '上传图片' }}
                        </el-button>
                      </el-upload>
                      <div v-if="formData.rank_message_image" class="image-preview-inline">
                        <img :src="formData.rank_message_image" class="uploaded-image-thumb" />
                        <el-button 
                          type="danger" 
                          link 
                          size="small" 
                          @click="removeRankImage"
                          class="remove-image-btn"
                        >
                          <el-icon><Delete /></el-icon> 删除
                        </el-button>
                      </div>
                    </div>

                    <!-- 工具栏 -->
                    <div class="editor-toolbar">
                      <el-button link size="small" @click="insertRankTemplate('bold')">
                        <el-icon><SemiSelect /></el-icon> 加粗
                      </el-button>
                      <el-button link size="small" @click="insertRankTemplate('italic')">
                        <el-icon><Rank /></el-icon> 斜体
                      </el-button>
                      <el-button link size="small" @click="insertRankTemplate('underline')">
                        <el-icon><Minus /></el-icon> 下划线
                      </el-button>
                      <el-button link size="small" @click="insertRankTemplate('strikethrough')">
                        <el-icon><Close /></el-icon> 删除线
                      </el-button>
                      <el-divider direction="vertical" />
                      <el-button type="primary" link size="small" @click="showRankInlineKeyboard = !showRankInlineKeyboard">
                        <el-icon><Grid /></el-icon> {{ showRankInlineKeyboard ? '关闭内联按钮' : '添加内联按钮' }}
                      </el-button>
                    </div>
                    
                    <!-- 编辑框 -->
                    <el-input 
                      v-model="formData.rank_message_template" 
                      type="textarea" 
                      :rows="8"
                      placeholder="请输入排行榜回复消息内容，支持HTML格式..."
                      class="message-editor"
                    />
                    
                    <!-- 变量提示 -->
                    <div class="variables-hint-below">
                      <span class="hint-label">可用变量：</span>
                      <el-tooltip content="用户名称" placement="top">
                        <el-button link size="small" @click="insertRankVariable('user_name')">{user_name}</el-button>
                      </el-tooltip>
                      <el-tooltip content="用户积分" placement="top">
                        <el-button link size="small" @click="insertRankVariable('user_points')">{user_points}</el-button>
                      </el-tooltip>
                      <el-tooltip content="用户排名" placement="top">
                        <el-button link size="small" @click="insertRankVariable('user_rank')">{user_rank}</el-button>
                      </el-tooltip>
                      <el-tooltip content="群组名称" placement="top">
                        <el-button link size="small" @click="insertRankVariable('group_name')">{group_name}</el-button>
                      </el-tooltip>
                      <el-tooltip content="排行榜列表" placement="top">
                        <el-button link size="small" @click="insertRankVariable('rank_list')">{rank_list}</el-button>
                      </el-tooltip>
                    </div>

                    <!-- 内联按钮编辑器 -->
                    <div v-if="showRankInlineKeyboard" class="inline-keyboard-section">
                      <InlineKeyboardEditor
                        v-model="rankInlineKeyboard"
                        ref="rankKeyboardEditorRef"
                      />
                    </div>
                  </div>
                </el-col>

                <!-- 右侧预览区 -->
                <el-col :span="10">
                  <div class="preview-section-compact">
                    <div class="preview-title">
                      <el-icon><View /></el-icon>
                      实时预览
                    </div>
                    <el-card class="preview-card telegram-preview">
                      <div class="preview-header">
                        <el-avatar :size="36" :icon="UserFilled" />
                        <div class="preview-info">
                          <div class="preview-name">Bot</div>
                          <div class="preview-time">刚刚</div>
                        </div>
                      </div>
                      <!-- 预览图片 -->
                      <div v-if="formData.rank_message_image" class="preview-image">
                        <img :src="formData.rank_message_image" />
                      </div>
                      <!-- 预览消息内容 -->
                      <div class="preview-message" v-html="renderedRankMessage"></div>
                      <!-- 预览内联按钮 -->
                      <div v-if="showRankInlineKeyboard && rankInlineKeyboard.length > 0" class="preview-inline-buttons">
                        <div v-for="(row, rowIndex) in getButtonRows(rankInlineKeyboard)" :key="rowIndex" class="button-row">
                          <button
                            v-for="(btn, btnIndex) in row"
                            :key="btnIndex"
                            class="preview-inline-btn"
                          >
                            {{ btn.text }}
                          </button>
                        </div>
                      </div>
                    </el-card>
                  </div>
                </el-col>
              </el-row>
            </div>
          </el-form-item>
        </div>
      </el-form>
    </el-card>

    <el-row :gutter="20">
      <el-col :span="12">
        <el-card class="stats-card">
          <template #header>
            <span>积分统计</span>
          </template>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-value">{{ totalUsers }}</div>
              <div class="stat-label">总用户数</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ totalPoints }}</div>
              <div class="stat-label">总积分</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ todayCheckins }}</div>
              <div class="stat-label">今日签到</div>
            </div>
            <div class="stat-item">
              <div class="stat-value">{{ activeUsers }}</div>
              <div class="stat-label">活跃用户</div>
            </div>
          </div>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card class="rank-card">
          <template #header>
            <div class="rank-header">
              <span>积分排行榜</span>
              <el-select v-model="rankPeriod" size="small" style="width: 100px;">
                <el-option label="今日" value="today" />
                <el-option label="本周" value="week" />
                <el-option label="本月" value="month" />
                <el-option label="全部" value="all" />
              </el-select>
            </div>
          </template>
          
          <div class="rank-list">
            <div 
              v-for="user in rankList" 
              :key="user.user_id"
              class="rank-item"
              :class="{ 'top3': user.rank <= 3 }"
            >
              <div class="rank-number">
                <span v-if="user.rank <= 3" class="medal">🥇🥈🥉</span>
                <span v-else>{{ user.rank }}</span>
              </div>
              <div class="user-info">
                <div class="username">{{ user.display_name || user.username }}</div>
                <div class="points">{{ user.total_points }} 积分</div>
              </div>
              <div class="streak">
                <el-tag size="small">连续签到 {{ user.checkin_streak }} 天</el-tag>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="checkin-card">
      <template #header>
        <span>签到测试</span>
      </template>
      <div class="checkin-content">
        <el-button 
          type="primary" 
          @click="testCheckin"
          :disabled="checkinDisabled"
        >
          模拟签到
        </el-button>
        
        <div v-if="checkinResult" class="checkin-result">
          <el-alert
            :title="checkinResult.success ? '签到成功' : '签到失败'"
            :type="checkinResult.success ? 'success' : 'error'"
            :description="checkinResult.message"
            show-icon
            style="margin-top: 10px;"
          />
          <div v-if="checkinResult.success" class="result-details">
            <p>获得积分: {{ checkinResult.points_earned }}</p>
            <p>总积分: {{ checkinResult.total_points }}</p>
            <p>连续签到: {{ checkinResult.streak }} 天</p>
            <p v-if="checkinResult.bonus > 0">连续签到奖励: {{ checkinResult.bonus }} 积分</p>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus, Delete, SemiSelect, Rank, Minus, Close, UserFilled, Grid, View } from '@element-plus/icons-vue'
import InlineKeyboardEditor, { type InlineButton } from '@/components/InlineKeyboardEditor/InlineKeyboardEditor.vue'
import api from '@/api'

interface PointsConfig {
  enabled: boolean
  daily_limit: number
  per_message: number
  checkin_base: number
  checkin_bonus: number[]
  checkin_message_template: string
  rank_keyword: string
  rank_message_template: string
  rank_message_image: string
  rank_inline_buttons: { text: string; callback_data?: string; url?: string }[]
}

interface UserRank {
  rank: number
  user_id: string
  telegram_id: number
  username: string
  display_name: string
  total_points: number
  today_points: number
  checkin_streak: number
}

interface CheckinResult {
  success: boolean
  points_earned: number
  total_points: number
  streak: number
  bonus: number
  message: string
}

const formData = ref<PointsConfig>({
  enabled: true,
  daily_limit: 100,
  per_message: 0.2,
  checkin_base: 10,
  checkin_bonus: [2, 5, 10, 20],
  checkin_message_template: '✅ 签到成功！\n\n👤 {user_name}\n📅 连续签到: {streak} 天\n⭐ 获得积分: +{points_earned} 分\n🎁 连续奖励: +{bonus} 分\n💰 总积分: {total_points} 分\n\n继续保持，明天再来！💪',
  rank_keyword: '积分排行',
  rank_message_template: '<b>🏆 积分排行榜</b>\n\n<b>@{user_name}</b> 您的排名: 第<b>{user_rank}</b>名\n当前积分: <b>{user_points}</b> 分\n\n{rank_list}',
  rank_message_image: '',
  rank_inline_buttons: []
})

const showRankInlineKeyboard = ref(false)
const rankInlineKeyboard = ref<InlineButton[]>([])
const rankKeyboardEditorRef = ref<InstanceType<typeof InlineKeyboardEditor> | null>(null)

// 渲染排行榜消息预览
const renderedRankMessage = computed(() => {
  if (!formData.value.rank_message_template) return '<span class="placeholder">消息预览将显示在这里...</span>'
  
  const sampleRankList = `<b>🥇</b> @用户A - 1000分
<b>🥈</b> @用户B - 850分
<b>🥉</b> @用户C - 720分`
  
  return formData.value.rank_message_template
    .replace(/\n/g, '<br>')
    .replace(/&lt;b&gt;(.*?)&lt;\/b&gt;/g, '<b>$1</b>')
    .replace(/&lt;i&gt;(.*?)&lt;\/i&gt;/g, '<i>$1</i>')
    .replace(/&lt;u&gt;(.*?)&lt;\/u&gt;/g, '<u>$1</u>')
    .replace(/&lt;s&gt;(.*?)&lt;\/s&gt;/g, '<s>$1</s>')
    .replace(/{user_name}/g, '<b>@用户名</b>')
    .replace(/{user_points}/g, '<b>999</b>')
    .replace(/{user_rank}/g, '<b>1</b>')
    .replace(/{group_name}/g, '<b>群组名称</b>')
    .replace(/{rank_list}/g, sampleRankList)
})

// 获取按钮行（每行2个按钮）
const getButtonRows = (buttons: InlineButton[]) => {
  const rows: InlineButton[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return rows
}

// 插入模板
const insertRankTemplate = (type: string) => {
  const templates: Record<string, string> = {
    bold: '<b>加粗文本</b>',
    italic: '<i>斜体文本</i>',
    underline: '<u>下划线文本</u>',
    strikethrough: '<s>删除线文本</s>'
  }
  
  const template = templates[type]
  formData.value.rank_message_template = (formData.value.rank_message_template || '') + template
}

// 插入变量
const insertRankVariable = (variable: string) => {
  formData.value.rank_message_template = (formData.value.rank_message_template || '') + `{${variable}}`
}

// 插入签到消息变量
const insertCheckinVariable = (variable: string) => {
  formData.value.checkin_message_template = (formData.value.checkin_message_template || '') + `{${variable}}`
}

// 图片上传相关方法
const beforeImageUpload = (file: File) => {
  const isImage = file.type.startsWith('image/')
  const isLt5M = file.size / 1024 / 1024 < 5

  if (!isImage) {
    ElMessage.error('只能上传图片文件!')
    return false
  }
  if (!isLt5M) {
    ElMessage.error('图片大小不能超过 5MB!')
    return false
  }
  return true
}

const handleRankImageSuccess = (response: any) => {
  if (response.success) {
    formData.value.rank_message_image = response.data.url
    ElMessage.success('图片上传成功')
  } else {
    ElMessage.error(response.error || '上传失败')
  }
}

const removeRankImage = () => {
  formData.value.rank_message_image = ''
}

const rankPeriod = ref<'today' | 'week' | 'month' | 'all'>('all')
const rankList = ref<UserRank[]>([])
const checkinResult = ref<CheckinResult | null>(null)
const checkinDisabled = ref(false)

// 统计数据
const totalUsers = ref(0)
const totalPoints = ref(0)
const todayCheckins = ref(0)
const activeUsers = ref(0)

async function loadConfig() {
  try {
    const response = await api.get<{ data: PointsConfig }>('/admin/points?groupId=demo')
    if (response.data) {
      formData.value = response.data
    }
  } catch (error) {
    console.error('加载配置失败:', error)
  }
}

async function loadRank() {
  try {
    const response = await api.post<{
      success: boolean
      ranks: UserRank[]
      total_users: number
    }>('/admin/points/rank', {
      groupId: 'demo',
      period: rankPeriod.value,
      limit: 10
    })
    
    if (response.success) {
      rankList.value = response.ranks
      totalUsers.value = response.total_users
      
      // 更新统计数据
      totalPoints.value = response.ranks.reduce((sum, user) => sum + user.total_points, 0)
      todayCheckins.value = response.ranks.filter(user => user.today_points > 0).length
      activeUsers.value = response.ranks.filter(user => user.checkin_streak > 0).length
    }
  } catch (error) {
    console.error('加载排行榜失败:', error)
  }
}

async function saveConfig() {
  // 保存内联按钮
  if (showRankInlineKeyboard.value && rankKeyboardEditorRef.value) {
    const keyboard = rankKeyboardEditorRef.value.getTelegramKeyboard()
    if (keyboard && keyboard.length > 0) {
      formData.value.rank_inline_buttons = keyboard.flat().map((btn: any) => ({
        text: btn.text,
        callback_data: btn.callback_data,
        url: btn.url
      }))
    } else {
      formData.value.rank_inline_buttons = []
    }
  } else {
    formData.value.rank_inline_buttons = []
  }
  
  try {
    const response = await api.post<ApiResponse>('/admin/points', {
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

async function testCheckin() {
  checkinDisabled.value = true
  
  try {
    const response = await api.post<CheckinResult>('/admin/points/checkin', {
      groupId: 'demo',
      userId: 'test_user',
      telegramId: 123456789
    })
    
    checkinResult.value = response
    
    // 重新加载排行榜
    await loadRank()
    
  } catch (error: any) {
    ElMessage.error(error.message || '签到失败')
  } finally {
    setTimeout(() => {
      checkinDisabled.value = false
    }, 2000) // 2秒后才能再次签到
  }
}

// 监听排行榜时间段变化
watch(rankPeriod, () => {
  loadRank()
})

onMounted(() => {
  loadConfig()
  loadRank()
})
</script>

<style scoped lang="scss">
.points-config {
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

.bonus-list {
  .bonus-item {
    display: flex;
    align-items: center;
    margin-bottom: 8px;
    
    span:first-child {
      width: 80px;
      color: #606266;
    }
  }
}

.stats-card, .rank-card, .checkin-card {
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 15px;
}

.stat-item {
  text-align: center;
  padding: 15px;
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

.rank-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.rank-list {
  max-height: 400px;
  overflow-y: auto;
}

.rank-item {
  display: flex;
  align-items: center;
  padding: 12px;
  border-bottom: 1px solid #ebeef5;
  
  &.top3 {
    background: linear-gradient(135deg, #fff5f5, #fff0f6);
    border-radius: 8px;
    margin-bottom: 5px;
  }
  
  .rank-number {
    width: 40px;
    text-align: center;
    font-weight: 600;
    font-size: 18px;
    
    .medal {
      font-size: 20px;
    }
  }
  
  .user-info {
    flex: 1;
    
    .username {
      font-weight: 500;
      margin-bottom: 2px;
    }
    
    .points {
      font-size: 12px;
      color: #909399;
    }
  }
  
  .streak {
    margin-left: 10px;
  }
}

.checkin-content {
  text-align: center;
}

.checkin-result {
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

// 签到消息编辑器样式
.checkin-message-editor {
  width: 100%;
  max-width: 600px;
  
  .checkin-editor {
    :deep(.el-textarea__inner) {
      font-family: 'Courier New', monospace;
      line-height: 1.6;
      resize: vertical;
    }
  }
  
  .variables-hint {
    margin-top: 10px;
    padding: 10px;
    background: #f5f7fa;
    border-radius: 6px;
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    
    .hint-label {
      color: #606266;
      font-size: 13px;
      font-weight: 500;
    }
    
    .variable-tag {
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background-color: #ecf5ff;
        border-color: #409eff;
        color: #409eff;
      }
    }
  }
}

// 消息编辑器样式
.message-editor-wrapper {
  width: 100%;
}

.editor-preview-row {
  display: flex;
  align-items: stretch;
  
  .el-col {
    display: flex;
    flex-direction: column;
  }
}

.editor-section {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.image-upload-wrapper {
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 10px;
}

.image-preview-inline {
  display: flex;
  align-items: center;
  gap: 8px;
}

.uploaded-image-thumb {
  width: 60px;
  height: 60px;
  object-fit: cover;
  border-radius: 4px;
  border: 1px solid #dcdfe6;
}

.remove-image-btn {
  padding: 0;
}

.editor-toolbar {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #e4e7ed;
  margin-bottom: 10px;
  flex-wrap: wrap;
  gap: 5px;
}

.message-editor {
  flex: 1;
  min-height: 200px;
  
  :deep(.el-textarea__inner) {
    min-height: 200px !important;
    font-family: 'Courier New', monospace;
    line-height: 1.6;
  }
}

.variables-hint-below {
  margin-top: 10px;
  padding: 8px 0;
  border-top: 1px solid #e4e7ed;
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  
  .hint-label {
    color: #606266;
    font-size: 13px;
    margin-right: 5px;
  }
}

.inline-keyboard-section {
  margin-top: 15px;
  padding: 15px;
  background: #f5f7fa;
  border-radius: 8px;
}

// 预览区样式
.preview-section-compact {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.preview-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: 600;
  color: #303133;
  margin-bottom: 12px;
  font-size: 14px;
}

.preview-card {
  flex: 1;
  background: #f5f7fa;
  border: none;
  
  :deep(.el-card__body) {
    padding: 12px;
    height: 100%;
  }
}

.telegram-preview {
  background: #ffffff;
  border: 1px solid #e4e7ed;
  border-radius: 12px;
  
  .preview-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 10px;
  }
  
  .preview-info {
    flex: 1;
    
    .preview-name {
      font-weight: 600;
      font-size: 14px;
      color: #303133;
    }
    
    .preview-time {
      font-size: 12px;
      color: #909399;
    }
  }
  
  .preview-image {
    margin-bottom: 10px;
    
    img {
      max-width: 100%;
      max-height: 150px;
      border-radius: 8px;
      object-fit: cover;
    }
  }
  
  .preview-message {
    font-size: 14px;
    line-height: 1.6;
    color: #303133;
    white-space: pre-wrap;
    word-break: break-word;
    
    .placeholder {
      color: #c0c4cc;
      font-style: italic;
    }
  }
  
  .preview-inline-buttons {
    margin-top: 10px;
    
    .button-row {
      display: flex;
      gap: 8px;
      margin-bottom: 8px;
    }
    
    .preview-inline-btn {
      flex: 1;
      padding: 8px 12px;
      background: #ffffff;
      border: 1px solid #409eff;
      border-radius: 6px;
      color: #409eff;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        background: #ecf5ff;
      }
    }
  }
}
</style>
