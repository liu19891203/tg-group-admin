<template>
  <div class="settings-page">
    <div class="page-header">
      <h1 class="page-title">系统设置</h1>
    </div>
    
    <el-tabs v-model="activeTab" type="border-card" class="settings-tabs">
      <!-- 通用设置 -->
      <el-tab-pane label="通用设置" name="general">
        <el-row :gutter="20">
          <el-col :xs="24" :lg="16">
            <el-card>
              <template #header>
                <span>基本设置</span>
              </template>
              
              <el-form :model="generalSettings" label-width="120px">
                <el-form-item label="系统名称">
                  <el-input v-model="generalSettings.system_name" placeholder="Telegram 群管机器人" />
                </el-form-item>
                
                <el-form-item label="默认群组">
                  <el-select v-model="generalSettings.default_group" placeholder="选择默认群组">
                    <el-option
                      v-for="g in groups"
                      :key="g.id"
                      :label="g.title"
                      :value="g.id"
                    />
                  </el-select>
                </el-form-item>
                
                <el-form-item label="时区设置">
                  <el-select v-model="generalSettings.timezone">
                    <el-option label="UTC+8 (北京/上海)" value="Asia/Shanghai" />
                    <el-option label="UTC+0 (伦敦)" value="UTC" />
                    <el-option label="UTC-5 (纽约)" value="America/New_York" />
                  </el-select>
                </el-form-item>
                
                <el-form-item label="语言">
                  <el-select v-model="generalSettings.language">
                    <el-option label="简体中文" value="zh-CN" />
                    <el-option label="English" value="en-US" />
                  </el-select>
                </el-form-item>
              </el-form>
            </el-card>
            
            <el-card style="margin-top: 20px">
              <template #header>
                <span>管理员设置</span>
              </template>
              
              <el-table :data="admins" style="width: 100%">
                <el-table-column prop="username" label="用户名" width="150">
                  <template #default="{ row }">
                    {{ row.username ? `@${row.username}` : row.telegram_id }}
                  </template>
                </el-table-column>
                
                <el-table-column prop="level" label="权限等级" width="120">
                  <template #default="{ row }">
                    <el-tag :type="row.level === 10 ? 'danger' : 'primary'" size="small">
                      {{ row.level === 10 ? '超级管理员' : '管理员' }}
                    </el-tag>
                  </template>
                </el-table-column>
                
                <el-table-column prop="created_at" label="添加时间" width="180">
                  <template #default="{ row }">
                    {{ formatTime(row.created_at) }}
                  </template>
                </el-table-column>
                
                <el-table-column label="操作" width="150">
                  <template #default="{ row }">
                    <el-button type="danger" link size="small" @click="removeAdmin(row)">
                      移除
                    </el-button>
                  </template>
                </el-table-column>
              </el-table>
              
              <div style="margin-top: 16px">
                <el-button type="primary" @click="showAddAdminDialog = true">
                  添加管理员
                </el-button>
              </div>
            </el-card>
          </el-col>
          
          <el-col :xs="24" :lg="8">
            <el-card>
              <template #header>
                <span>系统信息</span>
              </template>
              
              <el-descriptions :column="1" border>
                <el-descriptions-item label="版本">
                  v1.0.0
                </el-descriptions-item>
                <el-descriptions-item label="群组数量">
                  {{ stats.total_groups }}
                </el-descriptions-item>
                <el-descriptions-item label="用户数量">
                  {{ stats.total_users }}
                </el-descriptions-item>
                <el-descriptions-item label="运行时间">
                  {{ stats.uptime }}
                </el-descriptions-item>
              </el-descriptions>
            </el-card>
            
            <el-card style="margin-top: 20px">
              <template #header>
                <span>API 配置</span>
              </template>
              
              <el-form :model="apiSettings" label-width="100px" size="small">
                <el-form-item label="API Key">
                  <el-input v-model="apiSettings.api_key" placeholder="••••••••" />
                </el-form-item>
                <el-form-item label="Webhook">
                  <el-input v-model="apiSettings.webhook_url" placeholder="https://..." />
                </el-form-item>
                <el-form-item>
                  <el-button type="primary" size="small">保存</el-button>
                  <el-button size="small">测试连接</el-button>
                </el-form-item>
              </el-form>
            </el-card>
          </el-col>
        </el-row>
      </el-tab-pane>
      
      <!-- 群组管理 -->
      <el-tab-pane label="群组管理" name="groups">
        <GroupsTab />
      </el-tab-pane>
    </el-tabs>
    
    <div class="action-buttons" v-if="activeTab === 'general'">
      <el-button type="primary" @click="saveSettings">保存设置</el-button>
    </div>
    
    <el-dialog
      v-model="showAddAdminDialog"
      title="添加管理员"
      width="400px"
    >
      <el-form :model="adminForm" label-width="100px">
        <el-form-item label="Telegram ID">
          <el-input v-model.number="adminForm.telegram_id" placeholder="请输入用户 Telegram ID" />
        </el-form-item>
        
        <el-form-item label="权限等级">
          <el-radio-group v-model="adminForm.level">
            <el-radio :label="1">管理员</el-radio>
            <el-radio :label="10">超级管理员</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showAddAdminDialog = false">取消</el-button>
        <el-button type="primary" @click="addAdmin">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import dayjs from 'dayjs'
import api from '@/api'
import { useGroupsStore } from '@/stores/groups'

import GroupsTab from './GroupsTab.vue'

const groupsStore = useGroupsStore()

const activeTab = ref('general')
const showAddAdminDialog = ref(false)
const groups = ref<any[]>([])
const admins = ref<any[]>([])

const generalSettings = reactive({
  system_name: 'Telegram 群管机器人',
  default_group: '',
  timezone: 'Asia/Shanghai',
  language: 'zh-CN'
})

const apiSettings = reactive({
  api_key: '',
  webhook_url: ''
})

const adminForm = reactive({
  telegram_id: null as number | null,
  level: 1
})

const stats = reactive({
  total_groups: 0,
  total_users: 0,
  uptime: '0 天'
})

async function fetchAdmins() {
  try {
    const response = await api.get<ApiResponse<Admin[]>>('/admin/admins')
    if (response.success && response.data) {
      admins.value = response.data
    }
  } catch (error) {
    console.error('获取管理员列表失败:', error)
  }
}

async function addAdmin() {
  if (!adminForm.telegram_id) {
    ElMessage.warning('请输入 Telegram ID')
    return
  }
  
  try {
    const response = await api.post<ApiResponse>('/admin/admins', {
      telegram_id: adminForm.telegram_id,
      level: adminForm.level
    })
    
    if (response.success) {
      ElMessage.success('管理员添加成功')
      showAddAdminDialog.value = false
      adminForm.telegram_id = null
      adminForm.level = 1
      fetchAdmins()
    }
  } catch (error: any) {
    ElMessage.error(error.message || '添加失败')
  }
}

async function removeAdmin(row: any) {
  try {
    await api.delete(`/admin/admins/${row.id}`)
    ElMessage.success('管理员移除成功')
    fetchAdmins()
  } catch (error: any) {
    ElMessage.error(error.message || '移除失败')
  }
}

async function saveSettings() {
  try {
    await api.post('/admin/settings', generalSettings)
    ElMessage.success('设置保存成功')
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

function formatTime(time: string) {
  return dayjs(time).format('YYYY-MM-DD HH:mm:ss')
}

onMounted(() => {
  fetchAdmins()
  groupsStore.fetchGroups().then(() => {
    groups.value = groupsStore.groups
  })
})
</script>

<style scoped lang="scss">
.settings-page {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
  
  .page-title {
    margin: 0;
    font-size: 24px;
    font-weight: 600;
  }
}

.settings-tabs {
  :deep(.el-tabs__content) {
    padding: 20px;
  }
}

.action-buttons {
  margin-top: 20px;
  display: flex;
  justify-content: center;
}
</style>
