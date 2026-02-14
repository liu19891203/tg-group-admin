<template>
  <div class="config-form">
    <el-form label-width="120px">
      <el-form-item label="启用命令">
        <el-switch v-model="modelValue.enabled" />
      </el-form-item>
      
      <template v-if="modelValue.enabled">
        <el-form-item label="群组命令">
          <div class="commands-list">
            <div v-for="(cmd, key) in commands" :key="key" class="command-item">
              <el-tag size="small">{{ key }}</el-tag>
              <el-switch v-model="commands[key].enabled" size="small" />
              
              <template v-if="commands[key].roles?.length">
                <el-tag
                  v-for="role in commands[key].roles"
                  :key="role"
                  :type="role === 'admin' ? 'warning' : 'danger'"
                  size="small"
                >
                  {{ role === 'admin' ? '管理员' : '群主' }}
                </el-tag>
              </template>
              <el-tag v-else type="info" size="small">所有人</el-tag>
              
              <el-button
                v-if="key.startsWith('/')"
                type="primary"
                link
                size="small"
                @click="editCommand(key)"
              >
                设置
              </el-button>
            </div>
          </div>
        </el-form-item>
        
        <el-form-item label="自定义命令">
          <el-button type="primary" plain size="small" @click="showAddCustom = true">
            <el-icon><Plus /></el-icon>
            添加自定义命令
          </el-button>
        </el-form-item>
      </template>
    </el-form>
    
    <el-dialog v-model="showAddCustom" title="添加自定义命令" width="400px">
      <el-form :model="customCmd" label-width="100px">
        <el-form-item label="命令">
          <el-input v-model="customCmd.command" placeholder="/mycommand" />
        </el-form-item>
        <el-form-item label="响应内容">
          <el-input
            v-model="customCmd.response"
            type="textarea"
            :rows="3"
            placeholder="命令响应内容"
          />
        </el-form-item>
        <el-form-item label="权限">
          <el-checkbox-group v-model="customCmd.roles">
            <el-checkbox label="admin">仅管理员</el-checkbox>
            <el-checkbox label="owner">仅群主</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showAddCustom = false">取消</el-button>
        <el-button type="primary" @click="addCustomCommand">添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive } from 'vue'
import { Plus } from '@element-plus/icons-vue'

interface CommandConfig {
  enabled: boolean
  roles?: ('admin' | 'owner')[]
  response?: string
}

interface CommandsConfig {
  enabled: boolean
  [key: string]: CommandConfig | boolean
}

const props = defineProps<{
  modelValue?: CommandsConfig
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CommandsConfig]
}>()

const commands = reactive<Record<string, CommandConfig>>({
  '/checkin': { enabled: true },
  '/me': { enabled: true },
  '/rank': { enabled: true },
  '/help': { enabled: true },
  '/config': { enabled: true, roles: ['admin'] },
  '/mute': { enabled: true, roles: ['admin'] },
  '/ban': { enabled: true, roles: ['admin'] },
  '/kick': { enabled: true, roles: ['admin'] },
  '/warn': { enabled: true, roles: ['admin'] }
})

const showAddCustom = ref(false)
const customCmd = reactive({
  command: '',
  response: '',
  roles: [] as string[]
})

function editCommand(key: string) {
  // Open command edit dialog
}

function addCustomCommand() {
  const cmdKey = customCmd.command.startsWith('/') ? customCmd.command : `/${customCmd.command}`
  commands[cmdKey] = {
    enabled: true,
    response: customCmd.response,
    roles: customCmd.roles as ('admin' | 'owner')[]
  }
  emit('update:modelValue', { ...props.modelValue, ...commands })
  showAddCustom.value = false
  Object.assign(customCmd, { command: '', response: '', roles: [] })
}
</script>

<style scoped lang="scss">
.config-form {
  .commands-list {
    width: 100%;
  }
  
  .command-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border-bottom: 1px solid #ebeef5;
  }
}
</style>
