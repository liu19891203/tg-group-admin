<template>
  <div class="commands-config">
    <el-card class="config-card">
      <template #header>
        <div class="card-header">
          <span>群组命令管理</span>
          <el-button type="primary" @click="saveConfig">保存配置</el-button>
        </div>
      </template>

      <el-form :model="formData" label-width="120px">
        <el-form-item label="启用命令系统">
          <el-switch
            v-model="formData.enabled"
            active-text="启用"
            inactive-text="禁用"
          />
        </el-form-item>

        <el-form-item label="自动删除命令">
          <el-switch
            v-model="formData.auto_delete_all"
            active-text="启用"
            inactive-text="禁用"
          />
          <span class="tip">启用后所有命令和响应内容都会自动删除</span>
        </el-form-item>
      </el-form>

      <el-divider content-position="left">管理员命令</el-divider>

      <div class="commands-section">
        <el-table :data="adminCommands" style="width: 100%">
          <el-table-column prop="command" label="命令" width="120" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="自动删除" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.auto_delete" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="权限" width="180">
            <template #default="{ row }">
              <el-tag 
                v-for="perm in row.permissions" 
                :key="perm"
                size="small"
                style="margin-right: 5px;"
              >
                {{ perm }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>
      </div>

      <el-divider content-position="left">用户命令</el-divider>

      <div class="commands-section">
        <el-table :data="userCommands" style="width: 100%">
          <el-table-column prop="command" label="命令" width="120" />
          <el-table-column prop="description" label="描述" />
          <el-table-column label="启用" width="80">
            <template #default="{ row }">
              <el-switch v-model="row.enabled" size="small" />
            </template>
          </el-table-column>
          <el-table-column label="自动删除" width="100">
            <template #default="{ row }">
              <el-switch v-model="row.auto_delete" size="small" />
            </template>
          </el-table-column>
        </el-table>
      </div>
    </el-card>

    <el-card class="help-card">
      <template #header>
        <span>命令说明</span>
      </template>
      
      <div class="help-content">
        <h4>管理员命令</h4>
        <ul>
          <li><code>/reload</code> - 更新群组管理员列表，绑定频道后需要发送</li>
          <li><code>/mute [时间]</code> - 回复消息禁言消息主，可设定时间（秒）</li>
          <li><code>/ban</code> - 回复消息封禁消息主</li>
          <li><code>/kick</code> - 回复消息踢出消息主（踢出后可以重新加群）</li>
          <li><code>/warn</code> - 回复消息警告消息主（警告超过次数踢出）</li>
          <li><code>/config</code> - 呼出配置内容</li>
        </ul>
        
        <h4>用户命令</h4>
        <ul>
          <li><code>/checkin</code> - 签到获取积分</li>
          <li><code>/me</code> - 查看个人信息与积分</li>
          <li><code>/help</code> - 查看帮助信息</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useSelectedGroup } from '@/composables/useSelectedGroup'

interface GroupCommand {
  command: string
  description: string
  type: 'admin' | 'user'
  enabled: boolean
  auto_delete: boolean
  delete_delay?: number
  response?: string
  permissions?: string[]
}

interface CommandConfig {
  enabled: boolean
  auto_delete_all: boolean
  commands: GroupCommand[]
}

const { currentGroupId, hasGroup } = useSelectedGroup()

const formData = ref<CommandConfig>({
  enabled: true,
  auto_delete_all: true,
  commands: []
})

const adminCommands = computed(() => {
  return formData.value.commands.filter(cmd => cmd.type === 'admin')
})

const userCommands = computed(() => {
  return formData.value.commands.filter(cmd => cmd.type === 'user')
})

async function loadConfig() {
  if (!currentGroupId.value) return
  try {
    const response = await api.get<{ data: CommandConfig }>(`/admin/commands?group_id=${currentGroupId.value}`)
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
    const response = await api.post<ApiResponse>('/admin/commands', {
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

onMounted(() => {
  loadConfig()
})
</script>

<style scoped lang="scss">
.commands-config {
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

.tip {
  margin-left: 10px;
  color: #909399;
  font-size: 12px;
}

.commands-section {
  margin-bottom: 20px;
}

.help-card {
  margin-top: 20px;
}

.help-content {
  h4 {
    margin: 15px 0 10px 0;
    color: #409eff;
    
    &:first-child {
      margin-top: 0;
    }
  }
  
  ul {
    margin: 0;
    padding-left: 20px;
    
    li {
      margin: 8px 0;
      font-size: 14px;
      
      code {
        padding: 2px 6px;
        background: #f5f7fa;
        border-radius: 4px;
        color: #409eff;
        font-family: 'Courier New', monospace;
      }
    }
  }
}
</style>
