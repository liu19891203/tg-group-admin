<template>
  <div class="groups-page">
    <div class="page-header">
      <h1 class="page-title">群组管理</h1>
      <el-button type="primary" @click="showAddDialog = true">
        <el-icon><Plus /></el-icon>
        添加群组
      </el-button>
    </div>
    
    <el-card class="filter-card">
      <el-form :inline="true" :model="filters">
        <el-form-item label="群组名称">
          <el-input
            v-model="filters.search"
            placeholder="搜索群组"
            prefix-icon="Search"
            clearable
            style="width: 200px"
            @input="debouncedSearch"
          />
        </el-form-item>
        
        <el-form-item label="状态">
          <el-select v-model="filters.is_active" placeholder="全部" clearable style="width: 120px">
            <el-option label="已启用" :value="true" />
            <el-option label="已禁用" :value="false" />
          </el-select>
        </el-form-item>
        
        <el-form-item>
          <el-button type="primary" @click="fetchGroups">搜索</el-button>
          <el-button @click="resetFilters">重置</el-button>
        </el-form-item>
      </el-form>
    </el-card>
    
    <el-card>
      <el-table
        :data="groups"
        :loading="loading"
        style="width: 100%"
        stripe
      >
        <el-table-column prop="title" label="群组名称" min-width="200">
          <template #default="{ row }">
            <div class="group-name">
              <el-icon><ChatLineRound /></el-icon>
              <span>{{ row.title }}</span>
            </div>
          </template>
        </el-table-column>
        
        <el-table-column prop="username" label="Username" width="150">
          <template #default="{ row }">
            {{ row.username ? `@${row.username}` : '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="member_count" label="成员数" width="100" align="center" />
        
        <el-table-column prop="is_active" label="状态" width="100" align="center">
          <template #default="{ row }">
            <el-tag :type="row.is_active ? 'success' : 'danger'" size="small">
              {{ row.is_active ? '启用' : '禁用' }}
            </el-tag>
          </template>
        </el-table-column>
        
        <el-table-column prop="linked_channel_id" label="关联频道" width="150">
          <template #default="{ row }">
            {{ row.linked_channel_id || '-' }}
          </template>
        </el-table-column>
        
        <el-table-column prop="created_at" label="创建时间" width="180">
          <template #default="{ row }">
            {{ formatTime(row.created_at) }}
          </template>
        </el-table-column>
        
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{ row }">
            <div class="table-actions">
              <el-button
                type="primary"
                link
                size="small"
                @click="openConfig(row)"
              >
                配置
              </el-button>
              <el-button
                type="primary"
                link
                size="small"
                @click="toggleStatus(row)"
              >
                {{ row.is_active ? '禁用' : '启用' }}
              </el-button>
              <el-button
                type="danger"
                link
                size="small"
                @click="deleteGroup(row)"
              >
                删除
              </el-button>
            </div>
          </template>
        </el-table-column>
      </el-table>
      
      <div class="pagination-container">
        <el-pagination
          v-model:current-page="pagination.page"
          v-model:page-size="pagination.limit"
          :page-sizes="[10, 20, 50, 100]"
          :total="pagination.total"
          layout="total, sizes, prev, pager, next, jumper"
          @size-change="fetchGroups"
          @current-change="fetchGroups"
        />
      </div>
    </el-card>
    
    <el-dialog
      v-model="showAddDialog"
      title="添加群组"
      width="500px"
      :close-on-click-modal="false"
    >
      <el-form
        ref="addFormRef"
        :model="addForm"
        :rules="addRules"
        label-width="100px"
      >
        <el-form-item label="Chat ID" prop="chat_id">
          <el-input v-model.number="addForm.chat_id" placeholder="请输入 Telegram Chat ID" />
        </el-form-item>
        
        <el-form-item label="群组名称" prop="title">
          <el-input v-model="addForm.title" placeholder="请输入群组名称" />
        </el-form-item>
        
        <el-form-item label="类型" prop="chat_type">
          <el-select v-model="addForm.chat_type" placeholder="请选择类型">
            <el-option label="超级群组" value="supergroup" />
            <el-option label="频道" value="channel" />
          </el-select>
        </el-form-item>
        
        <el-form-item label="Username" prop="username">
          <el-input v-model="addForm.username" placeholder="可选" />
        </el-form-item>
      </el-form>
      
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" :loading="addLoading" @click="handleAdd">
          添加
        </el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Plus } from '@element-plus/icons-vue'
import { useDebounceFn } from '@vueuse/core'
import dayjs from 'dayjs'
import { useGroupsStore } from '@/stores/groups'

const router = useRouter()
const groupsStore = useGroupsStore()

const loading = ref(false)
const showAddDialog = ref(false)
const addLoading = ref(false)
const addFormRef = ref()

const groups = computed(() => groupsStore.groups)
const pagination = computed(() => ({
  page: groupsStore.page,
  limit: groupsStore.limit,
  total: groupsStore.total
}))

const filters = reactive({
  search: '',
  is_active: null as boolean | null
})

const addForm = reactive({
  chat_id: null as number | null,
  title: '',
  chat_type: 'supergroup',
  username: ''
})

const addRules = {
  chat_id: [{ required: true, message: '请输入 Chat ID', trigger: 'blur' }],
  title: [{ required: true, message: '请输入群组名称', trigger: 'blur' }],
  chat_type: [{ required: true, message: '请选择类型', trigger: 'change' }]
}

const debouncedSearch = useDebounceFn(() => {
  fetchGroups()
}, 300)

async function fetchGroups() {
  loading.value = true
  try {
    await groupsStore.fetchGroups({
      search: filters.search || undefined,
      is_active: filters.is_active ?? undefined
    })
  } finally {
    loading.value = false
  }
}

function resetFilters() {
  filters.search = ''
  filters.is_active = null
  fetchGroups()
}

function openConfig(group: any) {
  router.push(`/groups/${group.id}/config`)
}

async function toggleStatus(group: any) {
  try {
    await groupsStore.updateGroup(group.id, {
      is_active: !group.is_active
    })
    ElMessage.success(group.is_active ? '已禁用' : '已启用')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function deleteGroup(group: any) {
  try {
    await ElMessageBox.confirm(
      `确定要删除群组 "${group.title}" 吗？此操作不可恢复。`,
      '删除确认',
      { type: 'warning' }
    )
    
    await groupsStore.deleteGroup(group.id)
    ElMessage.success('删除成功')
  } catch (error) {
    // User cancelled
  }
}

async function handleAdd() {
  const valid = await addFormRef.value?.validate().catch(() => false)
  if (!valid) return
  
  addLoading.value = true
  try {
    await groupsStore.createGroup(addForm)
    ElMessage.success('添加成功')
    showAddDialog.value = false
    Object.assign(addForm, { chat_id: null, title: '', chat_type: 'supergroup', username: '' })
  } catch (error) {
    ElMessage.error('添加失败')
  } finally {
    addLoading.value = false
  }
}

function formatTime(time: string) {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  fetchGroups()
})
</script>

<style scoped lang="scss">
.groups-page {
  .filter-card {
    margin-bottom: 20px;
  }
  
  .group-name {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  
  .table-actions {
    display: flex;
    gap: 4px;
  }
  
  .pagination-container {
    display: flex;
    justify-content: flex-end;
    margin-top: 20px;
  }
}
</style>
