<template>
  <div class="messages-page">
    <div class="page-header">
      <h1 class="page-title">自动回复管理</h1>
      <el-button type="primary" @click="showCreateDialog = true">
        <el-icon><Plus /></el-icon>
        添加规则
      </el-button>
    </div>
    
    <el-card>
      <el-table :data="autoReplyRules" :loading="loading" style="width: 100%" stripe>
        <el-table-column prop="keyword" label="关键词" min-width="150" />
        
        <el-table-column label="匹配模式" width="120">
          <template #default="{ row }">
            <el-tag size="small">
              {{ row.is_regex ? '正则' : row.match_mode }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="response_type" label="回复类型" width="100">
          <template #default="{ row }">
            <el-tag :type="getResponseTypeColor(row.response_type)" size="small">
              {{ row.response_type }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="weight" label="权重" width="80" align="center" />
        
        <el-table-column prop="used_count" label="使用次数" width="100" align="center" />
        
        <el-table-column prop="is_enabled" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-switch
              :model-value="row.is_enabled"
              @update:model-value="toggleRule(row)"
            />
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="editRule(row)">
              编辑
            </el-button>
            <el-button type="primary" link size="small" @click="duplicateRule(row)">
              复制
            </el-button>
            <el-button type="danger" link size="small" @click="deleteRule(row)">
              删除
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
    
    <el-dialog
      v-model="showCreateDialog"
      :title="editingRule ? '编辑规则' : '添加规则'"
      width="600px"
      :close-on-click-modal="false"
    >
      <el-form :model="form" :rules="rulesForm" ref="formRef" label-width="100px">
        <el-form-item label="关键词" prop="keyword">
          <el-input v-model="form.keyword" placeholder="输入关键词" />
        </el-form-item>
        
        <el-form-item label="匹配模式">
          <el-radio-group v-model="form.match_mode">
            <el-radio label="contains">包含</el-radio>
            <el-radio label="exact">完全匹配</el-radio>
            <el-radio label="starts_with">开头匹配</el-radio>
            <el-radio label="ends_with">结尾匹配</el-radio>
          </el-radio-group>
          <el-checkbox v-model="form.is_regex" style="margin-left: 20px">使用正则表达式</el-checkbox>
        </el-form-item>
        
        <el-form-item label="回复类型" prop="response_type">
          <el-select v-model="form.response_type" placeholder="选择回复类型">
            <el-option label="文本" value="text" />
            <el-option label="图片" value="image" />
            <el-option label="链接" value="link" />
            <el-option label="按钮" value="button" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="回复内容" prop="response_content.text">
          <el-input
            v-model="form.response_content.text"
            type="textarea"
            :rows="3"
            placeholder="输入回复内容"
          />
        </el-form-item>
        
        <el-form-item v-if="form.response_type === 'image'" label="图片链接">
          <el-input v-model="form.response_content.image_url" placeholder="图片 URL" />
        </el-form-item>
        
        <el-form-item label="权重">
          <el-input-number v-model="form.weight" :min="1" :max="100" />
          <span class="tip"> 权重越高，被选中的概率越大</span>
        </el-form-item>
        
        <el-form-item label="额外选项">
          <el-checkbox v-model="form.delete_trigger">删除触发消息</el-checkbox>
          <el-checkbox v-model="form.require_username">需要用户名才能触发</el-checkbox>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="closeDialog">取消</el-button>
        <el-button type="primary" :loading="saving" @click="saveRule">
          {{ editingRule ? '更新' : '添加' }}
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import api from '@/api'

const loading = ref(false)
const autoReplyRules = ref<any[]>([])
const showCreateDialog = ref(false)
const saving = ref(false)
const editingRule = ref<any>(null)
const formRef = ref()

const form = reactive({
  keyword: '',
  is_regex: false,
  match_mode: 'contains',
  weight: 1,
  response_type: 'text',
  response_content: {
    text: '',
    image_url: ''
  },
  delete_trigger: false,
  require_username: false
})

const rulesForm = {
  keyword: [{ required: true, message: '请输入关键词', trigger: 'blur' }],
  response_type: [{ required: true, message: '请选择回复类型', trigger: 'change' }],
  'response_content.text': [{ required: true, message: '请输入回复内容', trigger: 'blur' }]
}

async function fetchRules() {
  loading.value = true
  try {
    const response = await api.get<any[]>('/admin/auto-replies')
    autoReplyRules.value = Array.isArray(response) ? response : []
  } catch (error) {
    console.error('Failed to fetch rules:', error)
  } finally {
    loading.value = false
  }
}

function getResponseTypeColor(type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const colors: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    text: 'primary',
    image: 'success',
    link: 'warning',
    button: 'info'
  }
  return colors[type] || 'info'
}

function editRule(rule: any) {
  editingRule.value = rule
  Object.assign(form, {
    keyword: rule.keyword,
    is_regex: rule.is_regex,
    match_mode: rule.match_mode,
    weight: rule.weight,
    response_type: rule.response_type,
    response_content: { ...rule.response_content },
    delete_trigger: rule.delete_trigger,
    require_username: rule.require_username
  })
  showCreateDialog.value = true
}

async function saveRule() {
  const valid = await formRef.value?.validate().catch(() => false)
  if (!valid) return
  
  saving.value = true
  try {
    if (editingRule.value) {
      await api.put(`/admin/auto-replies/${editingRule.value.id}`, form)
      ElMessage.success('更新成功')
    } else {
      await api.post('/admin/auto-replies', form)
      ElMessage.success('添加成功')
    }
    closeDialog()
    fetchRules()
  } catch (error) {
    ElMessage.error('操作失败')
  } finally {
    saving.value = false
  }
}

async function duplicateRule(rule: any) {
  try {
    await api.post(`/admin/auto-replies/${rule.id}/duplicate`)
    ElMessage.success('复制成功')
    fetchRules()
  } catch (error) {
    ElMessage.error('复制失败')
  }
}

async function toggleRule(rule: any) {
  try {
    await api.patch(`/admin/auto-replies/${rule.id}`, {
      is_enabled: !rule.is_enabled
    })
    ElMessage.success(rule.is_enabled ? '已禁用' : '已启用')
    fetchRules()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function deleteRule(rule: any) {
  try {
    await ElMessageBox.confirm('确定要删除此规则吗？', '确认', { type: 'warning' })
    await api.delete(`/admin/auto-replies/${rule.id}`)
    ElMessage.success('删除成功')
    fetchRules()
  } catch (error) {
    // User cancelled
  }
}

function closeDialog() {
  showCreateDialog.value = false
  editingRule.value = null
  Object.assign(form, {
    keyword: '',
    is_regex: false,
    match_mode: 'contains',
    weight: 1,
    response_type: 'text',
    response_content: { text: '', image_url: '' },
    delete_trigger: false,
    require_username: false
  })
}

onMounted(() => {
  fetchRules()
})
</script>

<style scoped lang="scss">
.messages-page {
  .tip {
    margin-left: 10px;
    color: #909399;
    font-size: 12px;
  }
}
</style>
