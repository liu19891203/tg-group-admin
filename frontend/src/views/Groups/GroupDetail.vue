<template>
  <div class="group-detail">
    <el-page-header @back="router.back()" class="page-header">
      <template #content>
        <span class="page-title">{{ group?.title || '群组详情' }}</span>
      </template>
      <template #extra>
        <el-button type="primary" @click="handleEdit">编辑配置</el-button>
        <el-button @click="handleRefresh">刷新</el-button>
      </template>
    </el-page-header>

    <el-card class="info-card" v-if="group">
      <el-descriptions :column="2" border>
        <el-descriptions-item label="群组ID">{{ group.chat_id }}</el-descriptions-item>
        <el-descriptions-item label="群组名称">{{ group.title }}</el-descriptions-item>
        <el-descriptions-item label="成员数量">{{ group.member_count || 0 }}</el-descriptions-item>
        <el-descriptions-item label="状态">
          <el-tag :type="group.is_active ? 'success' : 'danger'">
            {{ group.is_active ? '已启用' : '已禁用' }}
          </el-tag>
        </el-descriptions-item>
        <el-descriptions-item label="创建时间">{{ formatDate(group.created_at) }}</el-descriptions-item>
        <el-descriptions-item label="更新时间">{{ formatDate(group.updated_at) }}</el-descriptions-item>
      </el-descriptions>
    </el-card>

    <el-card class="tabs-card">
      <el-tabs v-model="activeTab" @tab-change="handleTabChange">
        <el-tab-pane label="基本配置" name="basic">
          <BasicConfig :modelValue="groupConfig.basic" @update:modelValue="updateConfig('basic', $event)" />
        </el-tab-pane>

        <el-tab-pane label="入群验证" name="verification">
          <VerificationConfig :modelValue="groupConfig.verification" @update:modelValue="updateConfig('verification', $event)" />
        </el-tab-pane>

        <el-tab-pane label="广告过滤" name="ads">
          <AntiAdsConfig :modelValue="groupConfig.antiAds" @update:modelValue="updateConfig('antiAds', $event)" />
        </el-tab-pane>

        <el-tab-pane label="自动回复" name="autoreply">
          <AutoReplyConfig :modelValue="groupConfig.autoReply" @update:modelValue="updateConfig('autoReply', $event)" />
        </el-tab-pane>

        <el-tab-pane label="自动删除" name="autodelete">
          <AutoDeleteConfig :modelValue="groupConfig.autoDelete" @update:modelValue="updateConfig('autoDelete', $event)" />
        </el-tab-pane>

        <el-tab-pane label="防刷屏" name="antispam">
          <AntiSpamConfig :modelValue="groupConfig.antiSpam" @update:modelValue="updateConfig('antiSpam', $event)" />
        </el-tab-pane>

        <el-tab-pane label="积分系统" name="points">
          <PointsConfig :modelValue="groupConfig.points" @update:modelValue="updateConfig('points', $event)" />
        </el-tab-pane>

        <el-tab-pane label="指令管理" name="commands">
          <CommandsConfig :modelValue="groupConfig.commands" @update:modelValue="updateConfig('commands', $event)" />
        </el-tab-pane>
      </el-tabs>
    </el-card>

    <el-card class="stats-card">
      <template #header>
        <div class="card-header">
          <span>群组统计</span>
          <el-button type="primary" link @click="handleViewStats">查看详情</el-button>
        </div>
      </template>
      <el-row :gutter="20" v-if="stats">
        <el-col :span="6">
          <el-statistic title="今日消息" :value="stats.messages_today || 0" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="活跃成员" :value="stats.active_members || 0" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="今日新成员" :value="stats.new_members_today || 0" />
        </el-col>
        <el-col :span="6">
          <el-statistic title="已过滤广告" :value="stats.ads_blocked_today || 0" />
        </el-col>
      </el-row>
      <el-skeleton v-else :rows="2" animated />
    </el-card>

    <el-dialog v-model="editDialogVisible" title="编辑群组配置" width="600px">
      <el-form :model="editForm" label-width="100px">
        <el-form-item label="群组名称">
          <el-input v-model="editForm.title" placeholder="请输入群组名称" />
        </el-form-item>
        <el-form-item label="欢迎消息">
          <el-input
            v-model="editForm.welcome_message"
            type="textarea"
            :rows="3"
            placeholder="请输入欢迎消息内容，支持变量：{username}, {first_name}"
          />
        </el-form-item>
        <el-form-item label="状态">
          <el-switch v-model="editForm.is_active" active-text="启用" inactive-text="禁用" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="editDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSaveEdit" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { useGroupsStore } from '@/stores/groups';
import BasicConfig from './components/BasicConfig.vue';
import VerificationConfig from './components/VerificationConfig.vue';
import AntiAdsConfig from './components/AntiAdsConfig.vue';
import AutoReplyConfig from './components/AutoReplyConfig.vue';
import AutoDeleteConfig from './components/AutoDeleteConfig.vue';
import AntiSpamConfig from './components/AntiSpamConfig.vue';
import PointsConfig from './components/PointsConfig.vue';
import CommandsConfig from './components/CommandsConfig.vue';

const route = useRoute();
const router = useRouter();
const groupsStore = useGroupsStore();

const groupId = computed(() => route.params.id as string);
const activeTab = ref('basic');
const editDialogVisible = ref(false);
const saving = ref(false);

const group = computed(() => groupsStore.currentGroup);
const stats = computed(() => (groupsStore as any).currentStats || null);

// 默认配置
const defaultConfig: Record<string, any> = {
  basic: {},
  verification: { is_enabled: false },
  antiAds: { is_enabled: false },
  autoReply: { is_enabled: false },
  autoDelete: { is_enabled: false },
  antiSpam: { is_enabled: false },
  points: { is_enabled: false },
  commands: { is_enabled: false }
};

const groupConfig = computed(() => {
  return group.value?.config || defaultConfig;
});

const editForm = ref({
  title: '',
  welcome_message: '',
  is_active: true
});

const formatDate = (date: string | undefined) => {
  if (!date) return '-';
  return new Date(date).toLocaleString('zh-CN');
};

const fetchGroupDetail = async () => {
  await groupsStore.fetchGroup(groupId.value);
};

const handleRefresh = () => {
  fetchGroupDetail();
  ElMessage.success('刷新成功');
};

const handleTabChange = (tab: string) => {
  console.log('Tab changed:', tab);
};

const handleEdit = () => {
  if (group.value) {
    editForm.value = {
      title: group.value.title,
      welcome_message: (group.value as any).config?.welcome_message || '',
      is_active: group.value.is_active
    };
    editDialogVisible.value = true;
  }
};

const handleSaveEdit = async () => {
  saving.value = true;
  try {
    await groupsStore.updateGroup(groupId.value, editForm.value);
    ElMessage.success('保存成功');
    editDialogVisible.value = false;
  } catch (error) {
    ElMessage.error('保存失败');
  } finally {
    saving.value = false;
  }
};

const handleViewStats = () => {
  router.push(`/chat-stats?groupId=${groupId.value}`);
};

const updateConfig = (key: string, value: any) => {
  console.log('Update config:', key, value);
  // 这里可以实现配置更新逻辑
};

onMounted(() => {
  fetchGroupDetail();
});
</script>

<style scoped lang="scss">
.group-detail {
  padding: 20px;
}

.page-header {
  margin-bottom: 20px;
}

.page-title {
  font-size: 18px;
  font-weight: 600;
}

.info-card {
  margin-bottom: 20px;
}

.tabs-card {
  margin-bottom: 20px;
}

.stats-card {
  margin-bottom: 20px;
}

.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
</style>
