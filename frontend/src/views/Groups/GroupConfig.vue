<template>
  <div class="group-config-page">
    <div class="page-header">
      <div class="header-left">
        <el-button :icon="ArrowLeft" @click="goBack">返回</el-button>
        <h1 class="page-title">{{ group?.title || '群组配置' }}</h1>
      </div>
      <el-button type="primary" :loading="saving" @click="saveConfig">
        保存配置
      </el-button>
    </div>
    
    <el-tabs v-model="activeTab" class="config-tabs">
      <el-tab-pane label="欢迎消息" name="welcome">
        <WelcomeConfig v-model="config.welcome_config" />
      </el-tab-pane>
      
      <el-tab-pane label="入群验证" name="verification">
        <VerificationConfig v-model="config.verification_config" />
      </el-tab-pane>
      
      <el-tab-pane label="广告过滤" name="anti-ads">
        <AntiAdsConfig v-model="config.anti_ads_config" />
      </el-tab-pane>
      
      <el-tab-pane label="自动回复" name="auto-reply">
        <AutoReplyConfig :group-id="groupId" />
      </el-tab-pane>
      
      <el-tab-pane label="自动删除" name="auto-delete">
        <AutoDeleteConfig v-model="config.auto_delete_config" />
      </el-tab-pane>
      
      <el-tab-pane label="刷屏检测" name="anti-spam">
        <AntiSpamConfig v-model="config.anti_spam_config" />
      </el-tab-pane>
      
      <el-tab-pane label="积分配置" name="points">
        <PointsConfig v-model="config.points_config" />
      </el-tab-pane>
      
      <el-tab-pane label="命令设置" name="commands">
        <CommandsConfig v-model="config.commands_config" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { ArrowLeft } from '@element-plus/icons-vue'
import { useGroupsStore } from '@/stores/groups'
import WelcomeConfig from './components/WelcomeConfig.vue'
import VerificationConfig from './components/VerificationConfig.vue'
import AntiAdsConfig from './components/AntiAdsConfig.vue'
import AutoReplyConfig from './components/AutoReplyConfig.vue'
import AutoDeleteConfig from './components/AutoDeleteConfig.vue'
import AntiSpamConfig from './components/AntiSpamConfig.vue'
import PointsConfig from './components/PointsConfig.vue'
import CommandsConfig from './components/CommandsConfig.vue'

const route = useRoute()
const router = useRouter()
const groupsStore = useGroupsStore()

const groupId = computed(() => route.params.id as string)
const activeTab = ref('welcome')
const saving = ref(false)

const group = computed(() => groupsStore.currentGroup)
const currentConfig = computed(() => groupsStore.currentConfig)

const config = reactive<Record<string, any>>({
  welcome_config: {},
  verification_config: {},
  anti_ads_config: {},
  auto_reply_config: {},
  auto_delete_config: {},
  anti_spam_config: {},
  points_config: {},
  commands_config: {},
  crypto_config: {}
})

function goBack() {
  router.push('/groups')
}

async function saveConfig() {
  saving.value = true
  try {
    await groupsStore.updateConfig(groupId.value, config)
    ElMessage.success('配置保存成功')
  } catch (error) {
    ElMessage.error('配置保存失败')
  } finally {
    saving.value = false
  }
}

onMounted(async () => {
  await groupsStore.fetchGroup(groupId.value)
  if (currentConfig.value) {
    Object.assign(config, {
      welcome_config: currentConfig.value.welcome_config,
      verification_config: currentConfig.value.verification_config,
      anti_ads_config: currentConfig.value.anti_ads_config,
      auto_reply_config: currentConfig.value.auto_reply_config,
      auto_delete_config: currentConfig.value.auto_delete_config,
      anti_spam_config: currentConfig.value.anti_spam_config,
      points_config: currentConfig.value.points_config,
      commands_config: currentConfig.value.commands_config,
      crypto_config: currentConfig.value.crypto_config
    })
  }
})
</script>

<style scoped lang="scss">
.group-config-page {
  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
    
    .header-left {
      display: flex;
      align-items: center;
      gap: 16px;
    }
  }
  
  .config-tabs {
    background: #fff;
    border-radius: 8px;
    padding: 20px;
    
    :deep(.el-tabs__content) {
      padding-top: 20px;
    }
  }
}
</style>
