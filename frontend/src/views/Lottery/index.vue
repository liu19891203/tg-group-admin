<template>
  <div class="lottery-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>抽奖管理</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建抽奖
          </el-button>
        </div>
      </template>

      <div class="lottery-tabs">
        <el-radio-group v-model="activeTab">
          <el-radio-button label="all">全部抽奖</el-radio-button>
          <el-radio-button label="active">进行中</el-radio-button>
          <el-radio-button label="ended">已结束</el-radio-button>
        </el-radio-group>
      </div>

      <div class="lottery-list">
        <el-card 
          v-for="lottery in filteredLotteries" 
          :key="lottery.id"
          class="lottery-card"
          :class="lottery.status"
        >
          <div class="lottery-header">
            <div class="lottery-info">
              <el-tag :type="lottery.type === 'basic' ? 'primary' : lottery.type === 'points' ? 'warning' : 'success'">
                {{ { 'basic': '基础抽奖', 'points': '积分抽奖', 'lotto': '乐透抽奖' }[lottery.type] }}
              </el-tag>
              <h3>{{ lottery.title }}</h3>
              <el-tag size="small" :type="lottery.status === 'active' ? 'success' : 'info'">
                {{ { 'draft': '草稿', 'active': '进行中', 'ended': '已结束' }[lottery.status] }}
              </el-tag>
            </div>
            <div class="lottery-actions">
              <el-button size="small" @click="viewLottery(lottery)">查看</el-button>
              <el-button size="small" @click="editLottery(lottery)" v-if="lottery.status === 'draft'">编辑</el-button>
              <el-button 
                size="small" 
                type="success" 
                @click="drawLottery(lottery)"
                v-if="lottery.status === 'active'"
              >
                开奖
              </el-button>
              <el-button size="small" type="danger" @click="deleteLottery(lottery.id)">删除</el-button>
            </div>
          </div>

          <div class="lottery-content">
            <p><strong>奖品:</strong> {{ lottery.prize }}</p>
            <p><strong>获奖人数:</strong> {{ lottery.total_winners }} 人</p>
            <p v-if="lottery.points_cost"><strong>积分消耗:</strong> {{ lottery.points_cost }} 积分</p>
            <p><strong>结束时间:</strong> {{ new Date(lottery.end_time).toLocaleString() }}</p>
            
            <div v-if="Object.keys(lottery.conditions).length > 0" class="conditions">
              <strong>参与条件:</strong>
              <el-tag v-if="lottery.conditions.follow_channel" size="small" style="margin: 2px;">
                关注频道
              </el-tag>
              <el-tag v-if="lottery.conditions.min_messages" size="small" style="margin: 2px;">
                消息 ≥ {{ lottery.conditions.min_messages }}
              </el-tag>
              <el-tag v-if="lottery.conditions.must_have_username" size="small" style="margin: 2px;">
                需设置用户名
              </el-tag>
            </div>
          </div>
        </el-card>
      </div>
    </el-card>

    <!-- 创建/编辑抽奖对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingLottery ? '编辑抽奖' : '创建抽奖'"
      width="600px"
      :close-on-click-modal="false"
      class="lottery-dialog-compact"
    >
      <div class="dialog-content-scroll">
        <el-form :model="newLottery" label-width="120px">
        <el-form-item label="抽奖类型">
          <el-radio-group v-model="newLottery.type" class="lottery-type-group">
            <el-radio-button label="basic">
              <el-tooltip content="最基础的抽奖方式，所有满足条件的成员均可免费参与" placement="top">
                <span>基础抽奖</span>
              </el-tooltip>
            </el-radio-button>
            <el-radio-button label="points">
              <el-tooltip content="需要消耗积分才能参与，积分越多中奖概率越高" placement="top">
                <span>积分抽奖</span>
              </el-tooltip>
            </el-radio-button>
            <el-radio-button label="lotto">
              <el-tooltip content="类似彩票玩法，参与者选择号码，开奖时匹配号码中奖" placement="top">
                <span>乐透抽奖</span>
              </el-tooltip>
            </el-radio-button>
          </el-radio-group>
          <div class="lottery-type-desc">
            <el-alert
              :title="lotteryTypeDesc.title"
              :description="lotteryTypeDesc.desc"
              :type="lotteryTypeDesc.type"
              :closable="false"
              show-icon
              class="type-desc-alert"
            />
          </div>
        </el-form-item>

        <el-form-item label="抽奖标题">
          <el-input v-model="newLottery.title" placeholder="请输入抽奖标题" />
        </el-form-item>

        <el-form-item label="抽奖描述">
          <el-input 
            v-model="newLottery.description" 
            type="textarea" 
            :rows="3"
            placeholder="请输入抽奖描述" 
          />
        </el-form-item>

        <el-form-item label="奖品">
          <el-input v-model="newLottery.prize" placeholder="请输入奖品名称" />
        </el-form-item>

        <el-form-item label="奖品图片">
          <el-input v-model="newLottery.prize_image" placeholder="奖品图片URL（可选）" />
        </el-form-item>

        <el-form-item label="获奖人数">
          <el-input-number
            v-model="newLottery.total_winners"
            :min="1"
            :max="100"
            :step="1"
          />
          <span class="unit">人</span>
        </el-form-item>

        <el-form-item label="积分消耗" v-if="newLottery.type === 'points'">
          <el-input-number
            v-model="newLottery.points_cost"
            :min="1"
            :max="1000"
            :step="1"
          />
          <span class="unit">积分</span>
        </el-form-item>

        <el-divider content-position="left">参与条件</el-divider>

        <el-form-item label="关注频道">
          <el-input 
            v-model="newLottery.conditions.follow_channel" 
            placeholder="频道用户名，如 @example_channel"
            style="width: 300px;"
          />
        </el-form-item>

        <el-form-item label="最小消息数">
          <el-input-number
            v-model="newLottery.conditions.min_messages"
            :min="0"
            :max="1000"
            :step="10"
          />
          <span class="unit">条</span>
        </el-form-item>

        <el-form-item label="入群天数">
          <el-input-number
            v-model="newLottery.conditions.join_group_days"
            :min="0"
            :max="365"
            :step="1"
          />
          <span class="unit">天</span>
        </el-form-item>

        <el-form-item label="必须设置用户名">
          <el-switch v-model="newLottery.conditions.must_have_username" />
        </el-form-item>

        <el-divider content-position="left">时间设置</el-divider>

        <el-form-item label="开始时间">
          <el-date-picker
            v-model="newLottery.start_time"
            type="datetime"
            placeholder="选择开始时间"
            style="width: 300px;"
          />
        </el-form-item>

        <el-form-item label="结束时间">
          <el-date-picker
            v-model="newLottery.end_time"
            type="datetime"
            placeholder="选择结束时间"
            style="width: 300px;"
          />
        </el-form-item>

        <el-form-item label="启用抽奖">
          <el-switch v-model="newLottery.enabled" />
        </el-form-item>

        <el-divider content-position="left">开奖消息设置</el-divider>

        <el-form-item label="开奖后发消息">
          <el-switch
            v-model="newLottery.send_draw_message"
            active-text="发送"
            inactive-text="不发送"
          />
          <span class="tip">开奖结束后是否自动发送结果到群里</span>
        </el-form-item>

        <el-form-item label="开奖结果消息" v-if="newLottery.send_draw_message">
          <div class="draw-message-editor">
            <el-input
              v-model="newLottery.draw_message_template"
              type="textarea"
              :rows="5"
              placeholder="请输入开奖结束后发送到群里的消息..."
              class="draw-editor"
            />
            <div class="variables-hint">
              <span class="hint-label">可用变量：</span>
              <el-tooltip content="抽奖标题" placement="top">
                <el-tag size="small" effect="plain" class="variable-tag" @click="insertDrawVariable('lottery_title')">{lottery_title}</el-tag>
              </el-tooltip>
              <el-tooltip content="奖品名称" placement="top">
                <el-tag size="small" effect="plain" class="variable-tag" @click="insertDrawVariable('prize')">{prize}</el-tag>
              </el-tooltip>
              <el-tooltip content="获奖人数" placement="top">
                <el-tag size="small" effect="plain" class="variable-tag" @click="insertDrawVariable('total_winners')">{total_winners}</el-tag>
              </el-tooltip>
              <el-tooltip content="获奖者列表" placement="top">
                <el-tag size="small" effect="plain" class="variable-tag" @click="insertDrawVariable('winners_list')">{winners_list}</el-tag>
              </el-tooltip>
              <el-tooltip content="参与人数" placement="top">
                <el-tag size="small" effect="plain" class="variable-tag" @click="insertDrawVariable('total_participants')">{total_participants}</el-tag>
              </el-tooltip>
              <el-tooltip content="群组名称" placement="top">
                <el-tag size="small" effect="plain" class="variable-tag" @click="insertDrawVariable('group_name')">{group_name}</el-tag>
              </el-tooltip>
            </div>
          </div>
        </el-form-item>
        </el-form>
      </div>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="saveLottery">保存</el-button>
      </template>
    </el-dialog>

    <!-- 查看抽奖详情对话框 -->
    <el-dialog
      v-model="showViewDialog"
      title="抽奖详情"
      width="600px"
    >
      <div v-if="viewingLottery" class="lottery-detail">
        <div class="detail-item">
          <strong>抽奖类型:</strong>
          <el-tag :type="viewingLottery.type === 'basic' ? 'primary' : viewingLottery.type === 'points' ? 'warning' : 'success'">
            {{ { 'basic': '基础抽奖', 'points': '积分抽奖', 'lotto': '乐透抽奖' }[viewingLottery.type] }}
          </el-tag>
        </div>
        <div class="detail-item">
          <strong>标题:</strong> {{ viewingLottery.title }}
        </div>
        <div class="detail-item">
          <strong>描述:</strong> {{ viewingLottery.description }}
        </div>
        <div class="detail-item">
          <strong>奖品:</strong> {{ viewingLottery.prize }}
        </div>
        <div class="detail-item">
          <strong>获奖人数:</strong> {{ viewingLottery.total_winners }} 人
        </div>
        <div class="detail-item" v-if="viewingLottery.points_cost">
          <strong>积分消耗:</strong> {{ viewingLottery.points_cost }} 积分
        </div>
        <div class="detail-item">
          <strong>状态:</strong>
          <el-tag :type="viewingLottery.status === 'active' ? 'success' : 'info'">
            {{ { 'draft': '草稿', 'active': '进行中', 'ended': '已结束' }[viewingLottery.status] }}
          </el-tag>
        </div>
        <div class="detail-item">
          <strong>开始时间:</strong> {{ new Date(viewingLottery.start_time).toLocaleString() }}
        </div>
        <div class="detail-item">
          <strong>结束时间:</strong> {{ new Date(viewingLottery.end_time).toLocaleString() }}
        </div>
        
        <div v-if="Object.keys(viewingLottery.conditions).length > 0" class="detail-item">
          <strong>参与条件:</strong>
          <div style="margin-top: 5px;">
            <el-tag v-if="viewingLottery.conditions.follow_channel" size="small" style="margin: 2px;">
              关注频道: {{ viewingLottery.conditions.follow_channel }}
            </el-tag>
            <el-tag v-if="viewingLottery.conditions.min_messages" size="small" style="margin: 2px;">
              消息 ≥ {{ viewingLottery.conditions.min_messages }}
            </el-tag>
            <el-tag v-if="viewingLottery.conditions.must_have_username" size="small" style="margin: 2px;">
              需设置用户名
            </el-tag>
          </div>
        </div>
      </div>
    </el-dialog>

    <!-- 开奖结果对话框 -->
    <el-dialog
      v-model="showDrawDialog"
      title="开奖结果"
      width="600px"
    >
      <div v-if="drawResult" class="draw-result">
        <el-alert
          :title="drawResult.message"
          type="success"
          :closable="false"
          style="margin-bottom: 20px;"
        />
        
        <div class="winners-list">
          <h3>获奖名单 ({{ drawResult.winners.length }} 人)</h3>
          <div 
            v-for="(winner, index) in drawResult.winners" 
            :key="winner.user_id"
            class="winner-item"
          >
            <div class="winner-rank">{{ index + 1 }}</div>
            <div class="winner-info">
              <div class="winner-name">{{ winner.display_name || winner.username }}</div>
              <div class="winner-prize">{{ winner.prize }}</div>
            </div>
          </div>
        </div>

        <div class="draw-stats">
          <p>总参与人数: {{ drawResult.total_participants }} 人</p>
          <p>开奖时间: {{ new Date(drawResult.draw_time).toLocaleString() }}</p>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, reactive } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import api from '@/api'

interface LotteryConfig {
  id?: string
  enabled: boolean
  type: 'basic' | 'points' | 'lotto'
  title: string
  description: string
  prize: string
  prize_image?: string
  total_winners: number
  points_cost?: number
  start_time: string
  end_time: string
  conditions: {
    follow_channel?: string
    min_messages?: number
    join_group_days?: number
    must_have_username?: boolean
  }
  status: 'draft' | 'active' | 'ended'
  send_draw_message?: boolean
  draw_message_template?: string
}

interface Winner {
  user_id: string
  telegram_id: number
  username: string
  display_name: string
  prize: string
}

interface DrawResult {
  success: boolean
  message: string
  winners: Winner[]
  total_participants: number
  draw_time: string
}

const activeTab = ref('all')
const lotteries = ref<LotteryConfig[]>([])
const showCreateDialog = ref(false)
const showViewDialog = ref(false)
const showDrawDialog = ref(false)
const editingLottery = ref<LotteryConfig | null>(null)
const viewingLottery = ref<LotteryConfig | null>(null)
const drawResult = ref<DrawResult | null>(null)

const newLottery = reactive<Omit<LotteryConfig, 'id'>>({
  enabled: true,
  type: 'basic',
  title: '',
  description: '',
  prize: '',
  total_winners: 1,
  start_time: new Date().toISOString(),
  end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  conditions: {},
  status: 'draft',
  send_draw_message: true,
  draw_message_template: '🎉 <b>开奖结果公布</b> 🎉\n\n📢 抽奖活动：{lottery_title}\n🎁 奖品：{prize}\n\n🏆 获奖名单（共{total_winners}名）：\n{winners_list}\n\n👥 总参与人数：{total_participants} 人\n\n恭喜以上获奖者！请尽快联系管理员领取奖品。'
})

const filteredLotteries = computed(() => {
  if (activeTab.value === 'all') return lotteries.value
  return lotteries.value.filter(l => l.status === activeTab.value)
})

// 抽奖类型详细说明
const lotteryTypeDesc = computed(() => {
  const descMap: Record<string, { title: string; desc: string; type: 'info' | 'success' | 'warning' }> = {
    basic: {
      title: '基础抽奖玩法',
      desc: '所有满足参与条件的群成员均可免费参与。系统从所有参与者中随机抽取指定数量的获奖者。适合一般性的福利发放、活动抽奖等场景。',
      type: 'info'
    },
    points: {
      title: '积分抽奖玩法',
      desc: '参与者需要消耗一定数量的积分才能参与抽奖。投入的积分越多，中奖概率越高。未中奖者的积分会部分进入奖池。适合积分商城、活跃奖励等场景。',
      type: 'success'
    },
    lotto: {
      title: '乐透抽奖玩法',
      desc: '参与者从指定号码范围中选择自己的幸运号码（如1-49）。开奖时系统随机生成中奖号码，根据匹配号码数量决定奖项等级。适合大型活动、节日抽奖等场景。',
      type: 'warning'
    }
  }
  return descMap[newLottery.type] || descMap.basic
})

// 插入开奖消息变量
const insertDrawVariable = (variable: string) => {
  newLottery.draw_message_template = (newLottery.draw_message_template || '') + `{${variable}}`
}

async function loadLotteries() {
  try {
    const response = await api.get<{ data: LotteryConfig[] }>('/admin/lottery?groupId=demo')
    if (response.data) {
      lotteries.value = response.data.map(l => ({ ...l, id: l.id || Math.random().toString(36).substr(2, 9) }))
    }
  } catch (error) {
    console.error('加载抽奖列表失败:', error)
  }
}

function viewLottery(lottery: LotteryConfig) {
  viewingLottery.value = lottery
  showViewDialog.value = true
}

function editLottery(lottery: LotteryConfig) {
  editingLottery.value = lottery
  Object.assign(newLottery, lottery)
  showCreateDialog.value = true
}

async function deleteLottery(lotteryId: string) {
  try {
    await ElMessageBox.confirm('确定删除这个抽奖吗？', '确认删除', {
      type: 'warning'
    })
    
    const response = await api.delete<ApiResponse>('/admin/lottery', {
      groupId: 'demo',
      lotteryId
    })
    
    if (response.success) {
      lotteries.value = lotteries.value.filter(l => l.id !== lotteryId)
      ElMessage.success('抽奖删除成功')
    }
  } catch (error) {
    // 用户取消删除
  }
}

async function drawLottery(lottery: LotteryConfig) {
  try {
    await ElMessageBox.confirm('确定要开奖吗？开奖后将无法撤销。', '确认开奖', {
      type: 'warning'
    })
    
    const response = await api.post<DrawResult>('/admin/lottery/draw', {
      groupId: 'demo',
      lotteryId: lottery.id
    })
    
    if (response.success) {
      drawResult.value = response
      showDrawDialog.value = true
      
      // 更新抽奖状态
      const index = lotteries.value.findIndex(l => l.id === lottery.id)
      if (index !== -1) {
        lotteries.value[index].status = 'ended'
      }
    }
  } catch (error) {
    // 用户取消开奖
  }
}

async function saveLottery() {
  if (!newLottery.title || !newLottery.prize) {
    ElMessage.warning('请填写抽奖标题和奖品')
    return
  }

  try {
    const response = await api.post<ApiResponse>('/admin/lottery', {
      groupId: 'demo',
      lottery: newLottery
    })
    
    if (response.success) {
      ElMessage.success(editingLottery.value ? '抽奖更新成功' : '抽奖创建成功')
      showCreateDialog.value = false
      resetNewLottery()
      await loadLotteries()
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

function resetNewLottery() {
  Object.assign(newLottery, {
    enabled: true,
    type: 'basic',
    title: '',
    description: '',
    prize: '',
    total_winners: 1,
    start_time: new Date().toISOString(),
    end_time: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    conditions: {},
    status: 'draft'
  })
  editingLottery.value = null
}

onMounted(() => {
  loadLotteries()
})
</script>

<style scoped lang="scss">
.lottery-config {
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

.lottery-tabs {
  margin-bottom: 20px;
}

.lottery-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(400px, 1fr));
  gap: 20px;
}

.lottery-card {
  &.active {
    border-left: 4px solid #67c23a;
  }
  
  &.ended {
    border-left: 4px solid #909399;
  }
  
  &.draft {
    border-left: 4px solid #e6a23c;
  }
}

.lottery-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 15px;
}

.lottery-info {
  h3 {
    margin: 8px 0;
    font-size: 16px;
  }
}

.lottery-actions {
  display: flex;
  gap: 8px;
}

.lottery-content {
  p {
    margin: 8px 0;
    font-size: 14px;
  }
  
  .conditions {
    margin-top: 10px;
  }
}

.unit {
  margin-left: 10px;
  color: #909399;
}

.lottery-detail {
  .detail-item {
    margin-bottom: 15px;
    
    strong {
      display: block;
      margin-bottom: 5px;
      color: #606266;
    }
  }
}

.draw-result {
  .winners-list {
    margin: 20px 0;
    
    h3 {
      margin-bottom: 15px;
      color: #409eff;
    }
  }
  
  .winner-item {
    display: flex;
    align-items: center;
    padding: 12px;
    background: #f0f9ff;
    border-radius: 8px;
    margin-bottom: 10px;
    
    .winner-rank {
      width: 40px;
      height: 40px;
      background: #409eff;
      color: white;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 600;
      margin-right: 15px;
    }
    
    .winner-info {
      flex: 1;
      
      .winner-name {
        font-weight: 500;
        margin-bottom: 3px;
      }
      
      .winner-prize {
        font-size: 12px;
        color: #909399;
      }
    }
  }
  
  .draw-stats {
    margin-top: 20px;
    padding: 15px;
    background: #f5f7fa;
    border-radius: 8px;
    
    p {
      margin: 5px 0;
      font-size: 14px;
    }
  }
}

// 抽奖对话框样式 - 紧凑版本，高度缩小1/3
.lottery-dialog-compact {
  :deep(.el-dialog) {
    max-height: 60vh; // 原来是90vh，缩小1/3后约60vh
    margin-top: 20vh !important; // 居中显示
    display: flex;
    flex-direction: column;
  }
  
  :deep(.el-dialog__body) {
    padding: 0;
    max-height: calc(60vh - 120px);
    overflow: hidden;
    flex: 1;
  }
  
  .dialog-content-scroll {
    max-height: calc(60vh - 140px);
    overflow-y: auto;
    padding: 15px;
    
    // 紧凑表单样式
    :deep(.el-form-item) {
      margin-bottom: 12px;
    }
    
    :deep(.el-form-item__label) {
      line-height: 32px;
    }
    
    :deep(.el-input__inner),
    :deep(.el-textarea__inner) {
      padding: 6px 10px;
    }
    
    :deep(.el-divider) {
      margin: 12px 0;
    }
    
    :deep(.el-divider__text) {
      font-size: 13px;
      padding: 0 12px;
    }
    
    // 自定义滚动条
    &::-webkit-scrollbar {
      width: 5px;
    }
    
    &::-webkit-scrollbar-track {
      background: #f1f1f1;
      border-radius: 3px;
    }
    
    &::-webkit-scrollbar-thumb {
      background: #c1c1c1;
      border-radius: 3px;
      
      &:hover {
        background: #a8a8a8;
      }
    }
  }
  
  :deep(.el-dialog__footer) {
    padding: 10px 20px;
  }
}

// 抽奖类型选择器样式
.lottery-type-group {
  display: flex;
  gap: 10px;
  margin-bottom: 10px;
  
  :deep(.el-radio-button__inner) {
    padding: 8px 16px;
  }
}

.lottery-type-desc {
  margin-top: 10px;
  
  .type-desc-alert {
    :deep(.el-alert__title) {
      font-size: 14px;
      font-weight: 600;
    }
    
    :deep(.el-alert__description) {
      font-size: 13px;
      line-height: 1.6;
      margin-top: 5px;
    }
  }
}

// 开奖消息编辑器样式
.draw-message-editor {
  width: 100%;
  
  .draw-editor {
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
</style>
