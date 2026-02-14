<template>
  <div class="stats-page">
    <div class="page-header">
      <h1 class="page-title">数据统计</h1>
      <el-button type="primary" :icon="Download" @click="exportData">
        导出数据
      </el-button>
    </div>
    
    <el-row :gutter="20">
      <el-col :xs="24" :lg="16">
        <el-card>
          <template #header>
            <div class="card-header">
              <span>消息统计</span>
              <el-date-picker
                v-model="dateRange"
                type="daterange"
                range-separator="至"
                start-placeholder="开始日期"
                end-placeholder="结束日期"
                size="small"
                @change="fetchMessageStats"
              />
            </div>
          </template>
          
          <div class="chart-container">
            <v-chart :option="messageChartOption" style="height: 350px" autoresize />
          </div>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :lg="8">
        <el-card>
          <template #header>
            <span>积分分布</span>
          </template>
          
          <div class="chart-container">
            <v-chart :option="pointsChartOption" style="height: 350px" autoresize />
          </div>
        </el-card>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <span>活跃度排行</span>
          </template>
          
          <el-table :data="topUsers" style="width: 100%">
            <el-table-column type="index" width="60" label="排名" />
            <el-table-column label="用户" min-width="150">
              <template #default="{ row }">
                {{ row.username || `用户${row.telegramId}` }}
              </template>
            </el-table-column>
            <el-table-column prop="points" label="积分" align="right" />
          </el-table>
        </el-card>
      </el-col>
      
      <el-col :xs="24" :lg="12">
        <el-card>
          <template #header>
            <span>签到统计</span>
          </template>
          
          <el-descriptions :column="2" border>
            <el-descriptions-item label="今日签到">
              {{ stats.today_checkins || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="本周签到">
              {{ stats.week_checkins || 0 }}
            </el-descriptions-item>
            <el-descriptions-item label="平均连续签到">
              {{ stats.avg_streak?.toFixed(1) || 0 }} 天
            </el-descriptions-item>
            <el-descriptions-item label="最高连续签到">
              {{ stats.max_streak || 0 }} 天
            </el-descriptions-item>
          </el-descriptions>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { PieChart, BarChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Download } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import api from '@/api'

use([CanvasRenderer, PieChart, BarChart, GridComponent, TooltipComponent, LegendComponent])

const dateRange = ref<[Date, Date] | null>(null)
const messageStats = ref<any[]>([])
const topUsers = ref<any[]>([])
const pointsStats = ref({
  total_users: 0,
  total_points: 0,
  points_distribution: [
    { range: '0-100', count: 0 },
    { range: '101-500', count: 0 },
    { range: '501-1000', count: 0 },
    { range: '1000+', count: 0 }
  ]
})

const stats = reactive({
  today_checkins: 0,
  week_checkins: 0,
  avg_streak: 0,
  max_streak: 0
})

const messageChartOption = computed(() => ({
  tooltip: { trigger: 'axis' },
  legend: { data: ['消息数', '活跃用户'] },
  xAxis: {
    type: 'category',
    data: messageStats.value.map((s: any) => s.date)
  },
  yAxis: { type: 'value' },
  series: [
    {
      name: '消息数',
      type: 'bar',
      data: messageStats.value.map((s: any) => s.message_count),
      itemStyle: { color: '#409eff' }
    },
    {
      name: '活跃用户',
      type: 'line',
      data: messageStats.value.map((s: any) => s.active_users),
      smooth: true,
      itemStyle: { color: '#67c23a' }
    }
  ]
}))

const pointsChartOption = computed(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: '5%' },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    avoidLabelOverlap: false,
    label: { show: true, formatter: '{b}: {c}' },
    data: pointsStats.value.points_distribution.map((p: any) => ({
      value: p.count,
      name: p.range
    }))
  }]
}))

async function fetchMessageStats() {
  try {
    const [start, end] = dateRange.value || [
      dayjs().subtract(7, 'day').toDate(),
      new Date()
    ]
    
    const response = await api.get<any[]>('/admin/stats/messages', {
      start_date: dayjs(start).format('YYYY-MM-DD'),
      end_date: dayjs(end).format('YYYY-MM-DD'),
      granularity: 'day'
    })
    messageStats.value = response
  } catch (error) {
    console.error('Failed to fetch message stats:', error)
  }
}

async function fetchPointsStats() {
  try {
    const response = await api.get<any>('/admin/stats/points')
    Object.assign(pointsStats.value, response)
  } catch (error) {
    console.error('Failed to fetch points stats:', error)
  }
}

async function fetchTopUsers() {
  try {
    const response = await api.get<any[]>('/admin/points/leaderboard', {
      group_id: undefined,
      type: 'total',
      limit: 10
    })
    topUsers.value = Array.isArray(response) ? response : []
  } catch (error) {
    console.error('Failed to fetch top users:', error)
  }
}

async function exportData() {
  ElMessage.info('正在导出...')
}

onMounted(() => {
  dateRange.value = [
    dayjs().subtract(7, 'day').toDate(),
    new Date()
  ]
  fetchMessageStats()
  fetchPointsStats()
  fetchTopUsers()
})
</script>

<style scoped lang="scss">
.stats-page {
  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  
  .chart-container {
    width: 100%;
    min-height: 300px;
  }
}
</style>
