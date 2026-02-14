<template>
  <div class="invite-links">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>邀请链接配置</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-form :model="config" label-width="120px" inline>
        <el-form-item label="启用邀请系统">
          <el-switch v-model="config.enabled" />
        </el-form-item>

        <el-form-item label="自动创建链接">
          <el-switch v-model="config.auto_create" />
        </el-form-item>

        <el-form-item label="追踪邀请">
          <el-switch v-model="config.track_invites" />
        </el-form-item>

        <el-form-item label="默认过期天数">
          <el-input-number v-model="config.default_expire_days" :min="0" :max="365" />
          <span class="unit">天 (0表示永不过期)</span>
        </el-form-item>

        <el-form-item label="默认人数限制">
          <el-input-number v-model="config.default_member_limit" :min="0" :max="100000" />
          <span class="unit">人 (0表示无限制)</span>
        </el-form-item>
      </el-form>
    </el-card>

    <el-card class="links-card">
      <template #header>
        <div class="card-header">
          <span>邀请链接列表</span>
          <el-button type="primary" @click="showCreateDialog = true">
            <el-icon><Plus /></el-icon>
            创建邀请链接
          </el-button>
        </div>
      </template>

      <el-table :data="links" style="width: 100%">
        <el-table-column label="链接名称" width="150">
          <template #default="{ row }">
            <div class="link-name">
              {{ row.name }}
              <el-tag v-if="row.is_primary" size="small" type="success">主链接</el-tag>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="邀请链接">
          <template #default="{ row }">
            <div class="link-url">
              <span class="url">{{ row.link }}</span>
              <el-button size="small" text @click="copyLink(row.link)">
                <el-icon><CopyDocument /></el-icon>
              </el-button>
            </div>
          </template>
        </el-table-column>

        <el-table-column label="创建者" width="120">
          <template #default="{ row }">
            {{ row.creator_name }}
          </template>
        </el-table-column>

        <el-table-column label="使用情况" width="120">
          <template #default="{ row }">
            <span :class="{ 'limit-reached': row.member_limit && row.member_count >= row.member_limit }">
              {{ row.member_count }}{{ row.member_limit ? ` / ${row.member_limit}` : '' }}
            </span>
          </template>
        </el-table-column>

        <el-table-column label="创建时间" width="120">
          <template #default="{ row }">
            {{ new Date(row.created_at).toLocaleDateString() }}
          </template>
        </el-table-column>

        <el-table-column label="过期时间" width="120">
          <template #default="{ row }">
            <span v-if="row.expires_at">
              {{ new Date(row.expires_at).toLocaleDateString() }}
            </span>
            <span v-else class="permanent">永不过期</span>
          </template>
        </el-table-column>

        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag :type="row.is_revoked ? 'danger' : 'success'">
              {{ row.is_revoked ? '已撤销' : '有效' }}
            </el-tag>
          </template>
        </el-table-column>

        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button 
              size="small" 
              :disabled="row.is_revoked"
              @click="editLink(row)"
            >
              编辑
            </el-button>
            <el-button 
              size="small" 
              type="danger"
              :disabled="row.is_revoked || row.is_primary"
              @click="revokeLink(row.link_id)"
            >
              撤销
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 创建/编辑邀请链接对话框 -->
    <el-dialog
      v-model="showCreateDialog"
      :title="editingLink ? '编辑邀请链接' : '创建邀请链接'"
      width="500px"
    >
      <el-form :model="newLink" label-width="100px">
        <el-form-item label="链接名称">
          <el-input v-model="newLink.name" placeholder="如：活动邀请链接" />
        </el-form-item>

        <el-form-item label="过期时间">
          <el-date-picker
            v-model="newLink.expires_at"
            type="datetime"
            placeholder="留空表示永不过期"
            style="width: 100%;"
          />
        </el-form-item>

        <el-form-item label="人数限制">
          <el-input-number 
            v-model="newLink.member_limit" 
            :min="0" 
            :max="100000"
            style="width: 100%;"
          />
          <span class="unit">0表示无限制</span>
        </el-form-item>

        <el-form-item label="设为主链接" v-if="!editingLink">
          <el-switch v-model="newLink.is_primary" />
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="showCreateDialog = false">取消</el-button>
        <el-button type="primary" @click="createLink">创建</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus, CopyDocument } from '@element-plus/icons-vue'
import api from '@/api'

interface InviteLink {
  link_id: string
  link: string
  name: string
  creator_id: string
  creator_name: string
  created_at: string
  expires_at?: string
  member_limit?: number
  member_count: number
  is_revoked: boolean
  is_primary: boolean
}

interface InviteConfig {
  enabled: boolean
  auto_create: boolean
  default_expire_days: number
  default_member_limit: number
  track_invites: boolean
}

const links = ref<InviteLink[]>([])
const config = ref<InviteConfig>({
  enabled: true,
  auto_create: false,
  default_expire_days: 30,
  default_member_limit: 0,
  track_invites: true
})

const showCreateDialog = ref(false)
const editingLink = ref<InviteLink | null>(null)

const newLink = ref<Partial<InviteLink>>({
  name: '',
  member_limit: 0,
  is_primary: false
})

async function loadData() {
  try {
    const response = await api.get<{ data: { links: InviteLink[]; config: InviteConfig } }>('/admin/invite-links?groupId=demo')
    if (response.data) {
      links.value = response.data.links
      config.value = response.data.config
    }
  } catch (error) {
    console.error('加载数据失败:', error)
  }
}

function copyLink(link: string) {
  navigator.clipboard.writeText(link)
  ElMessage.success('链接已复制到剪贴板')
}

function editLink(link: InviteLink) {
  editingLink.value = link
  newLink.value = { ...link }
  showCreateDialog.value = true
}

async function revokeLink(linkId: string) {
  try {
    await ElMessageBox.confirm('撤销后此链接将无法使用，确定撤销吗？', '确认撤销', {
      type: 'warning'
    })
    
    const response = await api.delete<ApiResponse>('/admin/invite-links', {
      groupId: 'demo',
      linkId
    })
    
    if (response.success) {
      const link = links.value.find(l => l.link_id === linkId)
      if (link) link.is_revoked = true
      ElMessage.success('邀请链接已撤销')
    }
  } catch (error) {
    // 用户取消
  }
}

async function createLink() {
  if (!newLink.value.name) {
    ElMessage.warning('请输入链接名称')
    return
  }

  try {
    const response = await api.post<ApiResponse>('/admin/invite-links', {
      groupId: 'demo',
      link: newLink.value
    })
    
    if (response.success) {
      ElMessage.success(editingLink.value ? '邀请链接更新成功' : '邀请链接创建成功')
      showCreateDialog.value = false
      resetNewLink()
      await loadData()
    }
  } catch (error: any) {
    ElMessage.error(error.message || '操作失败')
  }
}

async function saveConfig() {
  try {
    const response = await api.post<ApiResponse>('/admin/invite-links', {
      groupId: 'demo',
      config: config.value
    })
    
    if (response.success) {
      ElMessage.success('配置保存成功')
    }
  } catch (error: any) {
    ElMessage.error(error.message || '保存失败')
  }
}

function resetNewLink() {
  newLink.value = {
    name: '',
    member_limit: 0,
    is_primary: false
  }
  editingLink.value = null
}

onMounted(() => {
  loadData()
})
</script>

<style scoped lang="scss">
.invite-links {
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
  font-size: 12px;
}

.links-card {
  margin-top: 20px;
}

.link-name {
  display: flex;
  align-items: center;
  gap: 8px;
}

.link-url {
  display: flex;
  align-items: center;
  gap: 8px;
  
  .url {
    font-family: monospace;
    font-size: 13px;
    color: #606266;
  }
}

.limit-reached {
  color: #f56c6c;
  font-weight: 500;
}

.permanent {
  color: #67c23a;
}
</style>
