<template>
  <div class="auto-ban-page">
    <div class="page-header">
      <h2 class="page-title">自动封禁/禁言</h2>
      <el-button type="primary" @click="showAddDialog">
        <el-icon><Plus /></el-icon>
        添加规则
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
      <!-- 规则列表 -->
      <el-card>
        <el-table
          v-loading="loading"
          :data="rules"
          style="width: 100%"
          stripe
        >
          <el-table-column label="规则名称" min-width="150">
            <template #default="{ row }">
              <div class="rule-name">
                <el-icon :size="18" :class="getActionIcon(row.action)">
                  <component :is="getActionIcon(row.action)" />
                </el-icon>
                <span>{{ row.name }}</span>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="匹配模式" min-width="200">
            <template #default="{ row }">
              <div>
                <el-tag size="small" :type="row.is_regex ? 'warning' : 'info'">
                  {{ row.is_regex ? '正则' : '关键词' }}
                </el-tag>
                <div class="pattern-text">{{ row.pattern }}</div>
              </div>
            </template>
          </el-table-column>

          <el-table-column label="操作" width="120">
            <template #default="{ row }">
              <el-tag :type="getActionType(row.action)" effect="dark">
                {{ getActionLabel(row.action) }}
              </el-tag>
            </template>
          </el-table-column>

          <el-table-column label="时长" width="120">
            <template #default="{ row }">
              <span v-if="row.duration > 0">{{ formatDuration(row.duration) }}</span>
              <el-tag v-else size="small" type="danger">永久</el-tag>
            </template>
          </el-table-column>

          <el-table-column label="状态" width="100">
            <template #default="{ row }">
              <el-switch
                v-model="row.is_active"
                @change="toggleRuleStatus(row)"
              />
            </template>
          </el-table-column>

          <el-table-column label="操作" width="200" fixed="right">
            <template #default="{ row }">
              <el-button link type="primary" @click="editRule(row)">
                编辑
              </el-button>
              <el-button link type="danger" @click="deleteRule(row)">
                删除
              </el-button>
            </template>
          </el-table-column>
        </el-table>

        <!-- 空状态 -->
        <el-empty v-if="!loading && rules.length === 0" description="暂无规则">
          <template #description>
            <p>暂无自动封禁规则</p>
            <p class="empty-tip">添加规则来自动处理违规消息</p>
          </template>
        </el-empty>
      </el-card>

      <!-- 添加/编辑对话框 -->
      <el-dialog
        v-model="dialogVisible"
        :title="isEdit ? '编辑规则' : '添加规则'"
        width="600px"
      >
        <el-form
          ref="formRef"
          :model="formData"
          :rules="formRules"
          label-width="120px"
        >
          <el-form-item label="规则名称" prop="name">
            <el-input v-model="formData.name" placeholder="例如：禁止广告" />
          </el-form-item>

          <el-form-item label="匹配类型" prop="match_type">
            <el-radio-group v-model="formData.match_type">
              <el-radio label="keyword">关键词</el-radio>
              <el-radio label="regex">正则表达式</el-radio>
            </el-radio-group>
          </el-form-item>

          <el-form-item label="匹配内容" prop="pattern">
            <el-input
              v-model="formData.pattern"
              type="textarea"
              :rows="3"
              :placeholder="formData.match_type === 'regex' ? '输入正则表达式' : '输入关键词，多个用逗号分隔'"
            />
          </el-form-item>

          <el-form-item label="操作类型" prop="action">
            <el-select v-model="formData.action" placeholder="选择操作" style="width: 100%">
              <el-option label="禁言" value="mute">
                <el-icon><Microphone /></el-icon>
                <span>禁言</span>
              </el-option>
              <el-option label="封禁" value="ban">
                <el-icon><CircleClose /></el-icon>
                <span>封禁</span>
              </el-option>
              <el-option label="踢出" value="kick">
                <el-icon><Back /></el-icon>
                <span>踢出</span>
              </el-option>
              <el-option label="警告" value="warn">
                <el-icon><Warning /></el-icon>
                <span>警告</span>
              </el-option>
              <el-option label="删除消息" value="delete">
                <el-icon><Delete /></el-icon>
                <span>删除消息</span>
              </el-option>
            </el-select>
          </el-form-item>

          <el-form-item 
            label="惩罚时长" 
            prop="duration"
            v-if="['mute', 'ban'].includes(formData.action)"
          >
            <el-input-number
              v-model="formData.duration"
              :min="0"
              :max="31536000"
              :step="3600"
              style="width: 200px"
            />
            <span class="unit">秒（0为永久）</span>
            <div class="duration-presets">
              <el-button link size="small" @click="formData.duration = 3600">1小时</el-button>
              <el-button link size="small" @click="formData.duration = 86400">1天</el-button>
              <el-button link size="small" @click="formData.duration = 604800">7天</el-button>
              <el-button link size="small" @click="formData.duration = 2592000">30天</el-button>
            </div>
          </el-form-item>

          <el-form-item label="警告消息" prop="warning_message">
            <el-input
              v-model="formData.warning_message"
              type="textarea"
              :rows="3"
              placeholder="违规时发送的警告消息（可选）"
            />
          </el-form-item>
        </el-form>

        <template #footer>
          <el-button @click="dialogVisible = false">取消</el-button>
          <el-button type="primary" @click="submitForm" :loading="submitting">
            确定
          </el-button>
        </template>
      </el-dialog>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted, computed } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import {
  Plus,
  Microphone,
  CircleClose,
  Back,
  Warning,
  Delete,
  Timer,
  CloseBold,
  Remove
} from '@element-plus/icons-vue'
import axios from 'axios'

interface AutoBanRule {
  id: string
  group_id: string
  name: string
  match_type: 'keyword' | 'regex'
  pattern: string
  action: 'mute' | 'ban' | 'kick' | 'warn' | 'delete'
  duration: number
  warning_message?: string
  is_regex: boolean
  is_active: boolean
}

const selectedGroupId = computed(() => localStorage.getItem('selected_group_id'))

const loading = ref(false)
const rules = ref<AutoBanRule[]>([])
const dialogVisible = ref(false)
const isEdit = ref(false)
const submitting = ref(false)
const formRef = ref()

const formData = reactive({
  id: '',
  name: '',
  match_type: 'keyword' as 'keyword' | 'regex',
  pattern: '',
  action: 'mute' as 'mute' | 'ban' | 'kick' | 'warn' | 'delete',
  duration: 3600,
  warning_message: ''
})

const formRules = {
  name: [{ required: true, message: '请输入规则名称', trigger: 'blur' }],
  pattern: [{ required: true, message: '请输入匹配内容', trigger: 'blur' }],
  action: [{ required: true, message: '请选择操作类型', trigger: 'change' }]
}

// 获取操作类型标签
const getActionLabel = (action: string) => {
  const labels: Record<string, string> = {
    'mute': '禁言',
    'ban': '封禁',
    'kick': '踢出',
    'warn': '警告',
    'delete': '删除'
  }
  return labels[action] || action
}

const getActionType = (action: string) => {
  const types: Record<string, any> = {
    'mute': 'warning',
    'ban': 'danger',
    'kick': 'info',
    'warn': '',
    'delete': 'danger'
  }
  return types[action] || ''
}

const getActionIcon = (action: string) => {
  const icons: Record<string, string> = {
    'mute': 'Microphone',
    'ban': 'CircleClose',
    'kick': 'Back',
    'warn': 'Warning',
    'delete': 'Delete'
  }
  return icons[action] || 'Remove'
}

// 格式化时长
const formatDuration = (seconds: number) => {
  if (seconds < 60) return `${seconds}秒`
  if (seconds < 3600) return `${Math.floor(seconds / 60)}分钟`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}小时`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)}天`
  return `${Math.floor(seconds / 604800)}周`
}

// 加载规则列表
const loadRules = async () => {
  if (!selectedGroupId.value) return
  
  loading.value = true
  try {
    const response = await axios.get(`/api/admin/auto-ban?group_id=${selectedGroupId.value}`)
    if (response.data.success) {
      rules.value = response.data.data || []
    }
  } catch (error) {
    console.error('加载规则失败:', error)
    ElMessage.error('加载规则失败')
  } finally {
    loading.value = false
  }
}

// 显示添加对话框
const showAddDialog = () => {
  isEdit.value = false
  formData.id = ''
  formData.name = ''
  formData.match_type = 'keyword'
  formData.pattern = ''
  formData.action = 'mute'
  formData.duration = 3600
  formData.warning_message = ''
  dialogVisible.value = true
}

// 编辑规则
const editRule = (rule: AutoBanRule) => {
  isEdit.value = true
  formData.id = rule.id
  formData.name = rule.name
  formData.match_type = rule.match_type
  formData.pattern = rule.pattern
  formData.action = rule.action
  formData.duration = rule.duration
  formData.warning_message = rule.warning_message || ''
  dialogVisible.value = true
}

// 提交表单
const submitForm = async () => {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return

  if (!selectedGroupId.value) {
    ElMessage.warning('请先选择群组')
    return
  }

  submitting.value = true
  try {
    const url = isEdit.value 
      ? `/api/admin/auto-ban?id=${formData.id}`
      : '/api/admin/auto-ban'
    const method = isEdit.value ? 'put' : 'post'
    
    const response = await axios[method](url, {
      group_id: selectedGroupId.value,
      name: formData.name,
      match_type: formData.match_type,
      pattern: formData.pattern,
      action: formData.action,
      duration: formData.duration,
      warning_message: formData.warning_message,
      is_regex: formData.match_type === 'regex',
      is_active: true
    })

    if (response.data.success) {
      ElMessage.success(isEdit.value ? '规则已更新' : '规则已添加')
      dialogVisible.value = false
      loadRules()
    }
  } catch (error) {
    console.error('保存规则失败:', error)
    ElMessage.error('保存失败')
  } finally {
    submitting.value = false
  }
}

// 切换规则状态
const toggleRuleStatus = async (rule: AutoBanRule) => {
  try {
    const response = await axios.put(`/api/admin/auto-ban?id=${rule.id}`, {
      is_active: rule.is_active
    })

    if (response.data.success) {
      ElMessage.success(rule.is_active ? '规则已启用' : '规则已禁用')
    }
  } catch (error) {
    console.error('切换状态失败:', error)
    rule.is_active = !rule.is_active
    ElMessage.error('操作失败')
  }
}

// 删除规则
const deleteRule = async (rule: AutoBanRule) => {
  try {
    await ElMessageBox.confirm(
      `确定要删除规则 "${rule.name}" 吗？`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    )

    const response = await axios.delete(`/api/admin/auto-ban?id=${rule.id}`)

    if (response.data.success) {
      rules.value = rules.value.filter(r => r.id !== rule.id)
      ElMessage.success('规则已删除')
    }
  } catch (error: any) {
    if (error !== 'cancel') {
      console.error('删除规则失败:', error)
      ElMessage.error('删除失败')
    }
  }
}

onMounted(() => {
  loadRules()
})
</script>

<style scoped lang="scss">
.auto-ban-page {
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

  .rule-name {
    display: flex;
    align-items: center;
    gap: 8px;

    .el-icon {
      color: #409eff;
    }
  }

  .pattern-text {
    margin-top: 4px;
    font-size: 12px;
    color: #606266;
    word-break: break-all;
  }

  .empty-tip {
    font-size: 13px;
    color: #909399;
    margin-top: 8px;
  }

  .unit {
    margin-left: 8px;
    color: #606266;
  }

  .duration-presets {
    margin-top: 8px;

    .el-button {
      margin-right: 8px;
    }
  }

  .mb-4 {
    margin-bottom: 16px;
  }
}
</style>
