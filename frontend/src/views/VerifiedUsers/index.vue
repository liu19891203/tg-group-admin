<template>
  <div class="verified-users">
    <!-- 认证等级配置 -->
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>认证等级配置</span>
          <el-button type="primary" @click="saveLevelConfig">
            <el-icon><Check /></el-icon>
            保存配置
          </el-button>
        </div>
      </template>

      <el-row :gutter="20">
        <el-col :span="8" v-for="level in [1, 2, 3]" :key="level">
          <el-card class="level-card" :class="'level-' + level">
            <template #header>
              <div class="level-header">
                <span>等级 {{ level }}</span>
                <el-tag :type="getLevelType(level)">{{ getLevelBadge(level) }}</el-tag>
              </div>
            </template>
            <el-form label-position="top">
              <el-form-item label="等级名称">
                <el-input 
                  v-model="levelConfig[level - 1].name" 
                  placeholder="如: 普通认证"
                  style="width: 100%;"
                />
              </el-form-item>
              <el-form-item label="徽章">
                <el-select 
                  v-model="levelConfig[level - 1].badge" 
                  placeholder="选择徽章"
                  style="width: 100%;"
                  filterable
                  allow-create
                >
                  <template #prefix>
                    <span style="font-size: 20px;">{{ levelConfig[level - 1].badge }}</span>
                  </template>
                  <el-option
                    v-for="badge in badgeOptions"
                    :key="badge.value"
                    :label="badge.label"
                    :value="badge.value"
                  >
                    <span style="font-size: 18px; margin-right: 8px;">{{ badge.value }}</span>
                    <span style="color: #8492a6; font-size: 13px;">{{ badge.label }}</span>
                  </el-option>
                </el-select>
              </el-form-item>
              <el-form-item label="颜色">
                <el-color-picker 
                  v-model="levelConfig[level - 1].color" 
                  show-alpha
                />
              </el-form-item>
            </el-form>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- 消息配置 -->
    <el-card class="message-config-card">
      <template #header>
        <div class="card-header">
          <span>认证识别消息配置</span>
          <div class="header-actions">
            <el-tooltip content="当群成员发送消息包含认证用户的用户名或ID时触发" placement="top">
              <el-icon><QuestionFilled /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </template>

      <el-row :gutter="30">
        <!-- 未认证消息 -->
        <el-col :span="12">
          <div class="message-section">
            <h4>未认证用户回复消息</h4>
            <p class="section-desc">当识别到非认证用户时发送此消息</p>
            
            <MessageEditor
              v-model="messageConfig.unverifiedMessage"
              v-model:html="messageConfig.unverifiedMessageHtml"
              :variables="unverifiedVariables"
              placeholder="输入未认证用户的回复消息..."
            />
          </div>
        </el-col>

        <!-- 已认证消息 -->
        <el-col :span="12">
          <div class="message-section">
            <h4>已认证用户回复消息</h4>
            <p class="section-desc">当识别到认证用户时发送此消息</p>
            
            <MessageEditor
              v-model="messageConfig.verifiedMessage"
              v-model:html="messageConfig.verifiedMessageHtml"
              :variables="verifiedVariables"
              placeholder="输入已认证用户的回复消息..."
            />
          </div>
        </el-col>
      </el-row>

      <el-divider />

      <!-- 等级变量选择 -->
      <el-form label-width="120px">
        <el-form-item label="消息中包含等级">
          <el-checkbox-group v-model="messageConfig.includeLevels">
            <el-checkbox 
              v-for="level in levelConfig" 
              :key="level.level" 
              :label="level.level"
            >
              {{ level.name || '等级' + level.level }}
            </el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>

      <div class="save-actions">
        <el-button type="primary" @click="saveMessageConfig">
          <el-icon><Check /></el-icon>
          保存消息配置
        </el-button>
      </div>
    </el-card>

    <!-- 认证用户列表 -->
    <el-card class="users-card">
      <template #header>
        <div class="card-header">
          <span>认证用户列表</span>
          <div class="header-actions">
            <el-input
              v-model="searchQuery"
              placeholder="搜索用户ID或用户名"
              style="width: 220px;"
              clearable
            >
              <template #prefix>
                <el-icon><Search /></el-icon>
              </template>
            </el-input>
            <el-button type="primary" @click="showAddDialog = true">
              <el-icon><Plus /></el-icon>
              添加认证用户
            </el-button>
          </div>
        </div>
      </template>

      <el-table :data="filteredUsers" style="width: 100%" v-loading="loading">
        <el-table-column label="用户信息" min-width="200">
          <template #default="{ row }">
            <div class="user-info">
              <el-avatar :size="40" :src="row.avatar_url">
                {{ row.username ? row.username[0].toUpperCase() : 'U' }}
              </el-avatar>
              <div class="user-details">
                <div class="username">{{ row.username || '未知用户' }}</div>
                <div class="user-id">ID: {{ row.telegram_id }}</div>
              </div>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="认证等级" width="150">
          <template #default="{ row }">
            <el-tag 
              :type="getLevelType(row.verified_level)"
              :style="{ backgroundColor: getLevelColor(row.verified_level) + '20', borderColor: getLevelColor(row.verified_level), color: getLevelColor(row.verified_level) }"
            >
              {{ getLevelBadge(row.verified_level) }} {{ getLevelName(row.verified_level) }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="认证时间" width="160">
          <template #default="{ row }">
            {{ formatDate(row.verified_at) }}
          </template>
        </el-table-column>

        <el-table-column label="过期时间" width="160">
          <template #default="{ row }">
            <span v-if="row.expires_at" :class="{ 'expired': isExpired(row.expires_at) }">
              {{ formatDate(row.expires_at) }}
            </span>
            <span v-else class="permanent">永久</span>
          </template>
        </el-table-column>

        <el-table-column label="备注" min-width="150">
          <template #default="{ row }">
            {{ row.notes || '-' }}
          </template>
        </el-table-column>

        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button size="small" @click="editUser(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="removeUser(row)">
              移除
            </el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-pagination
        v-if="total > 0"
        v-model:current-page="currentPage"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, sizes, prev, pager, next"
        :page-sizes="[10, 20, 50, 100]"
        @size-change="loadUsers"
        @current-change="loadUsers"
      />
    </el-card>

    <!-- 添加/编辑认证用户对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingUser ? '编辑认证用户' : '添加认证用户'"
      width="500px"
    >
      <el-form :model="userForm" label-width="100px" :rules="userRules" ref="userFormRef">
        <el-form-item label="用户ID" prop="telegram_id">
          <el-input 
            v-model="userForm.telegram_id" 
            placeholder="Telegram用户ID"
            :disabled="!!editingUser"
          />
        </el-form-item>

        <el-form-item label="用户名">
          <el-input v-model="userForm.username" placeholder="用户名(可选)" />
        </el-form-item>

        <el-form-item label="认证等级" prop="verified_level">
          <el-select v-model="userForm.verified_level" style="width: 100%;">
            <el-option 
              v-for="level in levelConfig" 
              :key="level.level" 
              :label="`${level.badge} ${level.name || '等级' + level.level}`"
              :value="level.level"
            />
          </el-select>
        </el-form-item>

        <el-form-item label="过期时间">
          <el-date-picker
            v-model="userForm.expires_at"
            type="datetime"
            placeholder="留空表示永久有效"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="备注">
          <el-input 
            v-model="userForm.notes" 
            type="textarea" 
            :rows="3"
            placeholder="备注信息"
          />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveUser" :loading="saving">
          保存
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, Search, Check, QuestionFilled } from '@element-plus/icons-vue'
import axios from 'axios'
import MessageEditor from '@/components/MessageEditor/index.vue'
import dayjs from 'dayjs'

// 认证等级配置
interface LevelConfig {
  level: number
  name: string
  badge: string
  color: string
}

// 消息配置
interface MessageConfig {
  unverifiedMessage: string
  unverifiedMessageHtml: string
  verifiedMessage: string
  verifiedMessageHtml: string
  includeLevels: number[]
}

// 认证用户
interface VerifiedUser {
  id: string
  telegram_id: string
  username: string
  avatar_url?: string
  verified_level: number
  verified_at: string
  expires_at?: string
  notes?: string
}

const loading = ref(false)
const saving = ref(false)
const searchQuery = ref('')
const currentPage = ref(1)
const pageSize = ref(20)
const total = ref(0)
const users = ref<VerifiedUser[]>([])

// 等级配置
const levelConfig = reactive<LevelConfig[]>([
  { level: 1, name: '普通认证', badge: '✓', color: '#67C23A' },
  { level: 2, name: '高级认证', badge: '⭐', color: '#E6A23C' },
  { level: 3, name: 'VIP认证', badge: '👑', color: '#F56C6C' }
])

// 徽章选项
const badgeOptions = [
  { value: '✓', label: '对勾' },
  { value: '✅', label: '绿色对勾' },
  { value: '⭐', label: '星星' },
  { value: '🌟', label: '闪亮星星' },
  { value: '👑', label: '皇冠' },
  { value: '💎', label: '钻石' },
  { value: '🏆', label: '奖杯' },
  { value: '🥇', label: '金牌' },
  { value: '🥈', label: '银牌' },
  { value: '🥉', label: '铜牌' },
  { value: '🔥', label: '火焰' },
  { value: '⚡', label: '闪电' },
  { value: '💫', label: '闪光' },
  { value: '✨', label: '星星闪烁' },
  { value: '🛡️', label: '盾牌' },
  { value: '🔰', label: '日本新手' },
  { value: '💚', label: '绿心' },
  { value: '💙', label: '蓝心' },
  { value: '💜', label: '紫心' },
  { value: '❤️', label: '红心' },
  { value: '🧡', label: '橙心' },
  { value: '💛', label: '黄心' },
  { value: '🔴', label: '红圆' },
  { value: '🟠', label: '橙圆' },
  { value: '🟡', label: '黄圆' },
  { value: '🟢', label: '绿圆' },
  { value: '🔵', label: '蓝圆' },
  { value: '🟣', label: '紫圆' },
  { value: '⚪', label: '白圆' },
  { value: '⚫', label: '黑圆' },
  { value: '🔺', label: '红三角' },
  { value: '🔻', label: '红倒三角' },
  { value: '🔸', label: '橙小菱形' },
  { value: '🔹', label: '蓝小菱形' },
  { value: '🔶', label: '橙大菱形' },
  { value: '🔷', label: '蓝大菱形' },
  { value: '💠', label: '菱形加点' },
  { value: '🔘', label: '单选按钮' },
  { value: '🔳', label: '白方块' },
  { value: '🔲', label: '黑方块' },
  { value: '▪️', label: '小黑方块' },
  { value: '▫️', label: '小白方块' },
  { value: '◾', label: '中小黑方块' },
  { value: '◽', label: '中小白方块' },
  { value: '◼️', label: '中黑方块' },
  { value: '◻️', label: '中白方块' },
  { value: '🟥', label: '红方块' },
  { value: '🟧', label: '橙方块' },
  { value: '🟨', label: '黄方块' },
  { value: '🟩', label: '绿方块' },
  { value: '🟦', label: '蓝方块' },
  { value: '🟪', label: '紫方块' },
  { value: '⬛', label: '大黑方块' },
  { value: '⬜', label: '大白方块' },
  { value: '🏅', label: '奖牌' },
  { value: '🎖️', label: '军功章' },
  { value: '🎗️', label: '纪念丝带' },
  { value: '🎫', label: '票' },
  { value: '🎟️', label: '入场券' },
  { value: '🎁', label: '礼物' },
  { value: '🎀', label: '蝴蝶结' },
  { value: '🏵️', label: '花环' },
  { value: '🌸', label: '樱花' },
  { value: '🌺', label: '芙蓉' },
  { value: '🌻', label: '向日葵' },
  { value: '🌹', label: '玫瑰' },
  { value: '🌷', label: '郁金香' },
  { value: '💐', label: '花束' },
  { value: '🍀', label: '四叶草' },
  { value: '🌿', label: '草药' },
  { value: '🌱', label: '幼苗' },
  { value: '🌲', label: '常青树' },
  { value: '🌳', label: '落叶树' },
  { value: '🌴', label: '棕榈树' },
  { value: '🌵', label: '仙人掌' },
  { value: '🍁', label: '枫叶' },
  { value: '🍂', label: '落叶' },
  { value: '🍃', label: '风吹叶' },
  { value: '🌾', label: '稻穗' },
  { value: '🌷', label: '郁金香' },
  { value: '💮', label: '白花' },
  { value: '🏵️', label: '花环' },
  { value: '🪷', label: '莲花' },
  { value: '🪻', label: '风信子' },
  { value: '🌼', label: '开花' },
  { value: '🌻', label: '向日葵' },
  { value: '🌞', label: '太阳' },
  { value: '🌝', label: '满月脸' },
  { value: '🌛', label: '上弦月脸' },
  { value: '🌜', label: '下弦月脸' },
  { value: '🌚', label: '新月脸' },
  { value: '🌕', label: '满月' },
  { value: '🌖', label: '亏凸月' },
  { value: '🌗', label: '下弦月' },
  { value: '🌘', label: '残月' },
  { value: '🌑', label: '新月' },
  { value: '🌒', label: '娥眉月' },
  { value: '🌓', label: '上弦月' },
  { value: '🌔', label: '盈凸月' },
  { value: '🌙', label: '弯月' },
  { value: '🌎', label: '地球美洲' },
  { value: '🌍', label: '地球欧洲' },
  { value: '🌏', label: '地球亚洲' },
  { value: '🪐', label: '土星' },
  { value: '💫', label: '头晕' },
  { value: '⭐', label: '星星' },
  { value: '🌟', label: '闪亮星星' },
  { value: '✨', label: '闪烁' },
  { value: '⚡', label: '闪电' },
  { value: '🔥', label: '火焰' },
  { value: '💥', label: '爆炸' },
  { value: '☄️', label: '彗星' },
  { value: '☀️', label: '太阳' },
  { value: '🌤️', label: '晴间多云' },
  { value: '⛅', label: '多云' },
  { value: '🌥️', label: '阴天' },
  { value: '☁️', label: '云' },
  { value: '🌦️', label: '晴转雨' },
  { value: '🌧️', label: '下雨' },
  { value: '⛈️', label: '雷雨' },
  { value: '🌩️', label: '打雷' },
  { value: '🌨️', label: '下雪' },
  { value: '❄️', label: '雪花' },
  { value: '☃️', label: '雪人' },
  { value: '⛄', label: '小雪人' },
  { value: '🌬️', label: '大风' },
  { value: '💨', label: '尾气' },
  { value: '💧', label: '水滴' },
  { value: '💦', label: '汗滴' },
  { value: '☔', label: '雨伞' },
  { value: '☂️', label: '伞' },
  { value: '🌊', label: '海浪' },
  { value: '🌫️', label: '雾' },
  { value: '🌀', label: '台风' },
  { value: '🌈', label: '彩虹' },
  { value: '🏳️', label: '白旗' },
  { value: '🏴', label: '黑旗' },
  { value: '🏴‍☠️', label: '海盗旗' },
  { value: '🚩', label: '三角旗' },
  { value: '🎌', label: '交叉旗' },
  { value: '🏳️‍🌈', label: '彩虹旗' },
  { value: '🏳️‍⚧️', label: '跨性别旗' },
  { value: '🏴‍☠️', label: '海盗旗' }
]

// 消息配置
const messageConfig = reactive<MessageConfig>({
  unverifiedMessage: '',
  unverifiedMessageHtml: '',
  verifiedMessage: '',
  verifiedMessageHtml: '',
  includeLevels: [1, 2, 3]
})

// 未认证消息变量
const unverifiedVariables = [
  { key: 'user_id', label: '{user_id}', description: '用户ID' },
  { key: 'username', label: '{username}', description: '用户名' },
  { key: 'group_name', label: '{group_name}', description: '群组名称' }
]

// 已认证消息变量
const verifiedVariables = [
  { key: 'user_id', label: '{user_id}', description: '用户ID' },
  { key: 'username', label: '{username}', description: '用户名' },
  { key: 'group_name', label: '{group_name}', description: '群组名称' },
  { key: 'verified_level', label: '{verified_level}', description: '认证等级' },
  { key: 'verified_name', label: '{verified_name}', description: '等级名称' },
  { key: 'verified_badge', label: '{verified_badge}', description: '等级徽章' },
  { key: 'verified_at', label: '{verified_at}', description: '认证时间' }
]

// 用户表单
const showAddDialog = ref(false)
const editingUser = ref<VerifiedUser | null>(null)
const userFormRef = ref()
const userForm = reactive({
  telegram_id: '',
  username: '',
  verified_level: 1,
  expires_at: '',
  notes: ''
})

const userRules = {
  telegram_id: [{ required: true, message: '请输入用户ID', trigger: 'blur' }],
  verified_level: [{ required: true, message: '请选择认证等级', trigger: 'change' }]
}

// 过滤用户
const filteredUsers = computed(() => {
  if (!searchQuery.value) return users.value
  const query = searchQuery.value.toLowerCase()
  return users.value.filter(u => 
    (u.username && u.username.toLowerCase().includes(query)) ||
    u.telegram_id.includes(query)
  )
})

// 获取等级类型
function getLevelType(level: number): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const types: Record<number, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    1: 'success',
    2: 'warning',
    3: 'danger'
  }
  return types[level] || 'info'
}

// 获取等级名称
function getLevelName(level: number): string {
  const config = levelConfig.find(l => l.level === level)
  return config?.name || `等级${level}`
}

// 获取等级徽章
function getLevelBadge(level: number): string {
  const config = levelConfig.find(l => l.level === level)
  return config?.badge || '✓'
}

// 获取等级颜色
function getLevelColor(level: number): string {
  const config = levelConfig.find(l => l.level === level)
  return config?.color || '#909399'
}

// 格式化日期
function formatDate(date: string): string {
  return dayjs(date).format('YYYY-MM-DD HH:mm')
}

// 检查是否过期
function isExpired(date: string): boolean {
  return dayjs(date).isBefore(dayjs())
}

// 加载数据
async function loadData() {
  await Promise.all([
    loadLevelConfig(),
    loadMessageConfig(),
    loadUsers()
  ])
}

// 加载等级配置
async function loadLevelConfig() {
  try {
    const response = await axios.get('/api/admin/verified-levels')
    if (response.data.success && response.data.data) {
      response.data.data.forEach((item: LevelConfig) => {
        const index = levelConfig.findIndex(l => l.level === item.level)
        if (index >= 0) {
          levelConfig[index] = { ...item }
        }
      })
    }
  } catch (error) {
    console.error('加载等级配置失败:', error)
  }
}

// 保存等级配置
async function saveLevelConfig() {
  try {
    const response = await axios.post('/api/admin/verified-levels', {
      levels: levelConfig
    })
    if (response.data.success) {
      ElMessage.success('等级配置已保存')
    }
  } catch (error) {
    console.error('保存等级配置失败:', error)
    ElMessage.error('保存失败')
  }
}

// 加载消息配置
async function loadMessageConfig() {
  try {
    const response = await axios.get('/api/admin/verified-messages')
    if (response.data.success && response.data.data) {
      const data = response.data.data
      messageConfig.unverifiedMessage = data.unverified_message || ''
      messageConfig.unverifiedMessageHtml = data.unverified_message_html || ''
      messageConfig.verifiedMessage = data.verified_message || ''
      messageConfig.verifiedMessageHtml = data.verified_message_html || ''
      messageConfig.includeLevels = [
        data.include_level_1 ? 1 : null,
        data.include_level_2 ? 2 : null,
        data.include_level_3 ? 3 : null
      ].filter(Boolean) as number[]
    }
  } catch (error) {
    console.error('加载消息配置失败:', error)
  }
}

// 保存消息配置
async function saveMessageConfig() {
  try {
    const response = await axios.post('/api/admin/verified-messages', {
      unverified_message: messageConfig.unverifiedMessage,
      unverified_message_html: messageConfig.unverifiedMessageHtml,
      verified_message: messageConfig.verifiedMessage,
      verified_message_html: messageConfig.verifiedMessageHtml,
      include_level_1: messageConfig.includeLevels.includes(1),
      include_level_2: messageConfig.includeLevels.includes(2),
      include_level_3: messageConfig.includeLevels.includes(3)
    })
    if (response.data.success) {
      ElMessage.success('消息配置已保存')
    }
  } catch (error) {
    console.error('保存消息配置失败:', error)
    ElMessage.error('保存失败')
  }
}

// 加载用户列表
async function loadUsers() {
  loading.value = true
  try {
    const response = await axios.get('/api/admin/verified-users', {
      params: {
        page: currentPage.value,
        limit: pageSize.value
      }
    })
    if (response.data.success) {
      users.value = response.data.data || []
      total.value = response.data.pagination?.total || 0
    }
  } catch (error) {
    console.error('加载用户列表失败:', error)
    ElMessage.error('加载失败')
  } finally {
    loading.value = false
  }
}

// 编辑用户
function editUser(user: VerifiedUser) {
  editingUser.value = user
  userForm.telegram_id = user.telegram_id
  userForm.username = user.username
  userForm.verified_level = user.verified_level
  userForm.expires_at = user.expires_at || ''
  userForm.notes = user.notes || ''
  showAddDialog.value = true
}

// 移除用户
async function removeUser(user: VerifiedUser) {
  try {
    await ElMessageBox.confirm(
      `确定移除认证用户 "${user.username || user.telegram_id}" 吗？`,
      '确认移除',
      { type: 'warning' }
    )
    
    const response = await axios.delete(`/api/admin/verified-users/${user.id}`)
    if (response.data.success) {
      ElMessage.success('认证用户已移除')
      await loadUsers()
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('移除用户失败:', error)
      ElMessage.error('移除失败')
    }
  }
}

// 保存用户
async function saveUser() {
  const valid = await userFormRef.value?.validate().catch(() => false)
  if (!valid) return

  saving.value = true
  try {
    const data = {
      telegram_id: userForm.telegram_id,
      username: userForm.username,
      verified_level: userForm.verified_level,
      expires_at: userForm.expires_at || null,
      notes: userForm.notes
    }

    const response = editingUser.value
      ? await axios.put(`/api/admin/verified-users/${editingUser.value.id}`, data)
      : await axios.post('/api/admin/verified-users', data)

    if (response.data.success) {
      ElMessage.success(editingUser.value ? '认证用户更新成功' : '认证用户添加成功')
      showAddDialog.value = false
      resetForm()
      await loadUsers()
    }
  } catch (error: any) {
    console.error('保存用户失败:', error)
    ElMessage.error(error.response?.data?.error || '保存失败')
  } finally {
    saving.value = false
  }
}

// 重置表单
function resetForm() {
  editingUser.value = null
  userForm.telegram_id = ''
  userForm.username = ''
  userForm.verified_level = 1
  userForm.expires_at = ''
  userForm.notes = ''
  userFormRef.value?.resetFields()
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.verified-users {
  padding: 20px;

  .config-card,
  .message-config-card,
  .users-card {
    margin-bottom: 20px;
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .level-card {
    .level-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    &.level-1 {
      :deep(.el-card__header) {
        background-color: #f0f9eb;
      }
    }

    &.level-2 {
      :deep(.el-card__header) {
        background-color: #fdf6ec;
      }
    }

    &.level-3 {
      :deep(.el-card__header) {
        background-color: #fef0f0;
      }
    }
  }

  .message-section {
    h4 {
      margin: 0 0 8px;
      font-size: 16px;
      color: #303133;
    }

    .section-desc {
      margin: 0 0 16px;
      font-size: 13px;
      color: #909399;
    }
  }

  .save-actions {
    display: flex;
    justify-content: center;
    margin-top: 20px;
  }

  .user-info {
    display: flex;
    align-items: center;
    gap: 12px;

    .user-details {
      .username {
        font-weight: 500;
        color: #303133;
      }

      .user-id {
        font-size: 12px;
        color: #909399;
        margin-top: 2px;
      }
    }
  }

  .header-actions {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .permanent {
    color: #67C23A;
  }

  .expired {
    color: #F56C6C;
    text-decoration: line-through;
  }

  :deep(.el-pagination) {
    margin-top: 20px;
    justify-content: flex-end;
  }
}
</style>
