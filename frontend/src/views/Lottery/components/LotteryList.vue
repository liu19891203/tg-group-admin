<template>
  <div class="lottery-list">
    <el-table v-if="lotteries.length" :data="lotteries" style="width: 100%" stripe>
      <el-table-column prop="title" label="抽奖名称" min-width="200" />
      
      <el-table-column prop="type" label="类型" width="120">
        <template #default="{ row }">
          <el-tag :type="getTypeColor(row.type)" size="small">
            {{ getTypeName(row.type) }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column prop="prize" label="奖品" min-width="150" />
      
      <el-table-column prop="winner_count" label="中奖人数" width="100" align="center" />
      
      <el-table-column label="参与人数" width="100" align="center">
        <template #default="{ row }">
          {{ row.participant_count || 0 }}
        </template>
      </el-table-column>
      
      <el-table-column label="状态" width="100" align="center">
        <template #default="{ row }">
          <el-tag :type="getStatusColor(row.status)" size="small">
            {{ getStatusName(row.status) }}
          </el-tag>
        </template>
      </el-table-column>
      
      <el-table-column label="时间" width="180">
        <template #default="{ row }">
          <template v-if="row.status === 'active'">
            {{ row.end_at ? `结束: ${formatTime(row.end_at)}` : '未设置结束时间' }}
          </template>
          <template v-else>
            {{ formatTime(row.updated_at) }}
          </template>
        </template>
      </el-table-column>
      
      <el-table-column label="操作" width="200" fixed="right">
        <template #default="{ row }">
          <template v-if="row.status === 'draft'">
            <el-button type="primary" link size="small" @click="startLottery(row)">
              开始
            </el-button>
          </template>
          <template v-else-if="row.status === 'active'">
            <el-button type="warning" link size="small" @click="endLottery(row)">
              结束
            </el-button>
            <el-button type="success" link size="small" @click="drawLottery(row)">
              抽奖
            </el-button>
          </template>
          <el-button type="primary" link size="small" @click="viewLottery(row)">
            查看
          </el-button>
          <el-button type="danger" link size="small" @click="deleteLottery(row)">
            删除
          </el-button>
        </template>
      </el-table-column>
    </el-table>
    
    <el-empty v-else description="暂无抽奖活动" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import dayjs from 'dayjs'

const props = defineProps<{
  lotteries: any[]
  ended?: boolean
  draft?: boolean
}>()

const emit = defineEmits<{
  refresh: []
  delete: [lottery: any]
}>()

function getTypeColor(type: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const colors: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    basic: 'primary',
    points: 'warning',
    lotto: 'danger'
  }
  return colors[type] || 'info'
}

function getTypeName(type: string) {
  const names: Record<string, string> = {
    basic: '基础抽奖',
    points: '积分抽奖',
    lotto: '乐透抽奖'
  }
  return names[type] || type
}

function getStatusColor(status: string): 'primary' | 'success' | 'warning' | 'info' | 'danger' {
  const colors: Record<string, 'primary' | 'success' | 'warning' | 'info' | 'danger'> = {
    draft: 'info',
    active: 'success',
    ended: 'warning'
  }
  return colors[status] || 'info'
}

function getStatusName(status: string) {
  const names: Record<string, string> = {
    draft: '草稿',
    active: '进行中',
    ended: '已结束'
  }
  return names[status] || status
}

function formatTime(time: string) {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

async function startLottery(lottery: any) {
  try {
    await api.post(`/admin/lotteries/${lottery.id}`, { action: 'start' })
    ElMessage.success('抽奖已开始')
    emit('refresh')
  } catch (error) {
    ElMessage.error('操作失败')
  }
}

async function endLottery(lottery: any) {
  try {
    await ElMessageBox.confirm('确定要结束此抽奖吗？', '确认', { type: 'warning' })
    await api.post(`/admin/lotteries/${lottery.id}`, { action: 'end' })
    ElMessage.success('抽奖已结束')
    emit('refresh')
  } catch (error) {
    // User cancelled
  }
}

async function drawLottery(lottery: any) {
  try {
    await ElMessageBox.confirm('确定要抽取中奖者吗？', '确认', { type: 'warning' })
    const response = await api.post<any>(`/admin/lotteries/${lottery.id}`, { action: 'draw' })
    
    const winners = response.data?.winners || []
    let message = `🎉 抽奖结果\n\n奖品：${lottery.prize}\n\n中奖者：\n`
    winners.forEach((w: any, i: number) => {
      message += `${i + 1}. ${w.username || '用户'}\n`
    })
    
    ElMessageBox.alert(message, '抽奖结果', { type: 'success' })
    emit('refresh')
  } catch (error) {
    if (error !== 'cancel') {
      ElMessage.error('抽奖失败')
    }
  }
}

function viewLottery(lottery: any) {
  // Navigate to lottery detail page or open dialog
}

function deleteLottery(lottery: any) {
  emit('delete', lottery)
}
</script>

<style scoped lang="scss">
.lottery-list {
  width: 100%;
}
</style>
