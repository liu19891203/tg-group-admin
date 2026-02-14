<template>
  <div class="config-form">
    <div class="form-header">
      <el-button type="primary" @click="$router.push(`/groups/${effectiveGroupId}/auto-replies/new`)">
        <el-icon><Plus /></el-icon>
        添加规则
      </el-button>
    </div>
    
    <el-table :data="rules" style="width: 100%" stripe>
      <el-table-column prop="keyword" label="关键词" min-width="150" />
      
      <el-table-column label="匹配模式" width="120">
        <template #default="{ row }">
          <el-tag size="small">{{ row.is_regex ? '正则' : row.match_mode }}</el-tag>
        </template>
      </el-table-column>
      
      <el-table-column prop="response_type" label="回复类型" width="100">
        <template #default="{ row }">
          <el-tag :type="getTypeColor(row.response_type)" size="small">
            {{ row.response_type }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column prop="weight" label="权重" width="80" align="center" />
      
      <el-table-column prop="is_enabled" label="状态" width="80" align="center">
        <template #default="{ row }">
          <el-switch :model-value="row.is_enabled" @update:model-value="toggleRule(row)" />
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="150">
        <template #default="{ row }">
          <el-button type="primary" link size="small" @click="editRule(row)">编辑</el-button>
          <el-button type="danger" link size="small" @click="deleteRule(row)">删除</el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <el-empty v-if="!rules.length" description="暂无自动回复规则" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import api from '@/api'

const props = defineProps<{
  groupId?: string
  modelValue?: any
}>()

const rules = ref<any[]>([])

const effectiveGroupId = computed(() => props.groupId || props.modelValue?.groupId || 'demo')

function getTypeColor(type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const colors: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    text: 'primary',
    image: 'success',
    link: 'warning',
    button: 'info'
  }
  return colors[type] || 'info'
}

async function fetchRules() {
  try {
    const response = await api.get<any[]>(`/admin/groups/${effectiveGroupId.value}/auto-replies`)
    rules.value = Array.isArray(response) ? response : []
  } catch (error) {
    console.error('Failed to fetch rules:', error)
  }
}

async function toggleRule(rule: any) {
  try {
    await api.patch(`/admin/auto-replies/${rule.id}`, {
      is_enabled: !rule.is_enabled
    })
    fetchRules()
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

function editRule(rule: any) {
  // Navigate to edit page or open dialog
}

async function deleteRule(rule: any) {
  try {
    await api.delete(`/admin/auto-replies/${rule.id}`)
    ElMessage.success('删除成功')
    fetchRules()
  } catch (error) {
    ElMessage.error('删除失败')
  }
}

onMounted(() => {
  fetchRules()
})
</script>

<style scoped lang="scss">
.config-form {
  .form-header {
    margin-bottom: 16px;
  }
}
</style>
