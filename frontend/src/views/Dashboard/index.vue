<template>
  <div class="dashboard-page">
    <div class="page-header">
      <h1 class="page-title">数据看板</h1>
      <el-button type="primary" :icon="Refresh" @click="fetchData">刷新</el-button>
    </div>
    
    <el-row :gutter="20" class="stat-cards">
      <el-col :xs="12" :sm="6">
        <div class="stat-card">
          <div class="stat-icon">
            <el-icon><ChatLineRound /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.total_groups || 0 }}</div>
            <div class="stat-label">群组数量</div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6">
        <div class="stat-card success">
          <div class="stat-icon">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.total_users || 0 }}</div>
            <div class="stat-label">用户总数</div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6">
        <div class="stat-card warning">
          <div class="stat-icon">
            <el-icon><ChatDotRound /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.messages_today || 0 }}</div>
            <div class="stat-label">今日消息</div>
          </div>
        </div>
      </el-col>
      
      <el-col :xs="12" :sm="6">
        <div class="stat-card info">
          <div class="stat-icon">
            <el-icon><TrendCharts /></el-icon>
          </div>
          <div class="stat-info">
            <div class="stat-value">{{ stats.active_users_today || 0 }}</div>
            <div class="stat-label">活跃用户</div>
          </div>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20">
      <el-col :xs="24" :lg="16">
        <div class="card">
          <div class="card-header">
            <h3>消息趋势</h3>
            <el-radio-group v-model="chartPeriod" size="small">
              <el-radio-button label="7d">7天</el-radio-button>
              <el-radio-button label="30d">30天</el-radio-button>
            </el-radio-group>
          </div>
          <div class="chart-container">
            <v-chart :option="chartOption" style="height: 300px" autoresize />
          </div>
        </div>
      </el-col>
      
      <el-col :xs="24" :lg="8">
        <div class="card">
          <div class="card-header">
            <h3>热门群组</h3>
            <el-link type="primary" :underline="false" @click="$router.push('/groups')">
              查看全部
            </el-link>
          </div>
          <div class="group-list">
            <div
              v-for="group in stats.top_groups"
              :key="group.id"
              class="group-item"
            >
              <div class="group-info">
                <el-icon><ChatLineRound /></el-icon>
                <span class="group-name">{{ group.title }}</span>
              </div>
              <span class="member-count">{{ group.member_count }} 人</span>
            </div>
            <el-empty v-if="!stats.top_groups?.length" description="暂无数据" />
          </div>
        </div>
      </el-col>
    </el-row>
    
    <el-row :gutter="20" style="margin-top: 20px">
      <el-col :xs="24">
        <div class="card">
          <div class="card-header">
            <h3>最近活动</h3>
          </div>
          <el-timeline>
            <el-timeline-item
              v-for="activity in stats.recent_activity"
              :key="activity.id"
              :timestamp="formatTime(activity.created_at)"
              placement="top"
            >
              <div class="activity-item">
                <span class="activity-action">{{ activity.action }}</span>
                <span class="activity-target">
                  {{ activity.target_type }}: {{ activity.target_id }}
                </span>
              </div>
            </el-timeline-item>
            <el-timeline-item v-if="!stats.recent_activity?.length">
              <el-empty description="暂无活动记录" :image-size="60" />
            </el-timeline-item>
          </el-timeline>
        </div>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { Refresh } from '@element-plus/icons-vue'
import dayjs from 'dayjs'
import api from '@/api'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent])

const loading = ref(false)
const chartPeriod = ref('7d')

const stats = reactive({
  total_groups: 0,
  active_groups: 0,
  total_users: 0,
  messages_today: 0,
  messages_this_month: 0,
  active_users_today: 0,
  top_groups: [],
  recent_activity: []
})

const chartOption = computed(() => ({
  tooltip: {
    trigger: 'axis'
  },
  legend: {
    data: ['消息数', '活跃用户']
  },
  grid: {
    left: '3%',
    right: '4%',
    bottom: '3%',
    containLabel: true
  },
  xAxis: {
    type: 'category',
    boundaryGap: false,
    data: ['周一', '周二', '周三', '周四', '周五', '周六', '周日']
  },
  yAxis: {
    type: 'value'
  },
  series: [
    {
      name: '消息数',
      type: 'line',
      smooth: true,
      data: [120, 132, 101, 134, 90, 230, 210],
      itemStyle: { color: '#409eff' }
    },
    {
      name: '活跃用户',
      type: 'line',
      smooth: true,
      data: [220, 182, 191, 234, 290, 330, 310],
      itemStyle: { color: '#67c23a' }
    }
  ]
}))

async function fetchData() {
  loading.value = true
  try {
    const response = await api.get<typeof stats>('/admin/dashboard')
    Object.assign(stats, response)
  } catch (error) {
    console.error('Failed to fetch dashboard data:', error)
  } finally {
    loading.value = false
  }
}

function formatTime(time: string) {
  return dayjs(time).format('YYYY-MM-DD HH:mm')
}

onMounted(() => {
  fetchData()
})
</script>

<style scoped lang="scss">
.dashboard-page {
  padding: 0;
}

.stat-cards {
  margin-bottom: 20px;
}

.stat-card {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: #fff;
  border-radius: 8px;
  padding: 20px;
  display: flex;
  align-items: center;
  gap: 16px;
  
  &.success {
    background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
  }
  
  &.warning {
    background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
  }
  
  &.info {
    background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
  }
  
  .stat-icon {
    font-size: 40px;
    opacity: 0.8;
  }
  
  .stat-value {
    font-size: 28px;
    font-weight: bold;
  }
  
  .stat-label {
    font-size: 14px;
    opacity: 0.9;
  }
}

.card {
  background: #fff;
  border-radius: 8px;
  padding: 20px;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.05);
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  
  h3 {
    font-size: 16px;
    font-weight: 600;
    margin: 0;
  }
}

.group-list {
  .group-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 0;
    border-bottom: 1px solid #ebeef5;
    
    &:last-child {
      border-bottom: none;
    }
    
    .group-info {
      display: flex;
      align-items: center;
      gap: 8px;
      
      .group-name {
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
    }
    
    .member-count {
      color: #909399;
      font-size: 13px;
    }
  }
}

.activity-item {
  .activity-action {
    display: block;
    color: #303133;
  }
  
  .activity-target {
    font-size: 12px;
    color: #909399;
  }
}
</style>
