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
    
    <!-- 功能开关总览 -->
    <el-card class="feature-overview">
      <template #header>
        <div class="card-header">
          <span>⚡ 功能开关总览（与 Telegram 菜单同步）</span>
        </div>
      </template>
      
      <div class="feature-sections">
        <!-- 初级功能 -->
        <div class="feature-section">
          <h4>🟢 初级功能</h4>
          <div class="feature-grid">
            <el-switch v-model="config.verification_enabled" active-text="进群验证" />
            <el-switch v-model="config.welcome_enabled" active-text="欢迎消息" />
            <el-switch v-model="config.auto_reply_enabled" active-text="自动回复" />
            <el-switch v-model="config.auto_delete_enabled" active-text="自动删除" />
            <el-switch v-model="config.auto_ban_enabled" active-text="自动封禁" />
            <el-switch v-model="config.auto_warn_enabled" active-text="自动警告" />
            <el-switch v-model="config.auto_mute_enabled" active-text="自动禁言" />
            <el-switch v-model="config.flood_control_enabled" active-text="刷屏处理" />
            <el-switch v-model="config.ad_block_enabled" active-text="广告封杀" />
            <el-switch v-model="config.command_disable_enabled" active-text="命令关闭" />
          </div>
        </div>
        
        <!-- 中级功能 -->
        <div class="feature-section">
          <h4>🟡 中级功能</h4>
          <div class="feature-grid">
            <el-switch v-model="config.crypto_enabled" active-text="加密货币" />
            <el-switch v-model="config.members_enabled" active-text="群组成员" />
            <el-switch v-model="config.scheduled_msg_enabled" active-text="定时消息" />
            <el-switch v-model="config.points_enabled" active-text="积分相关" />
            <el-switch v-model="config.activity_stats_enabled" active-text="活跃度统计" />
            <el-switch v-model="config.entertainment_enabled" active-text="娱乐功能" />
            <el-switch v-model="config.usdt_price_enabled" active-text="实时查U价" />
            <el-switch v-model="config.channel_link_enabled" active-text="关联频道" />
          </div>
        </div>
        
        <!-- 高级功能 -->
        <div class="feature-section">
          <h4>🔴 高级功能</h4>
          <div class="feature-grid">
            <el-switch v-model="config.admin_perms_enabled" active-text="管理权限" />
            <el-switch v-model="config.nsfw_detection_enabled" active-text="色情检测" />
            <el-switch v-model="config.language_whitelist_enabled" active-text="语言白名单" />
            <el-switch v-model="config.invite_links_enabled" active-text="邀请链接" />
            <el-switch v-model="config.lottery_enabled" active-text="抽奖" />
            <el-switch v-model="config.verified_users_enabled" active-text="认证用户" />
          </div>
        </div>
      </div>
    </el-card>
    
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
  // 功能开关字段（与 Telegram 菜单同步）
  verification_enabled: false,
  welcome_enabled: false,
  auto_reply_enabled: false,
  auto_delete_enabled: false,
  auto_ban_enabled: false,
  auto_warn_enabled: false,
  auto_mute_enabled: false,
  flood_control_enabled: false,
  ad_block_enabled: false,
  command_disable_enabled: false,
  crypto_enabled: false,
  members_enabled: false,
  scheduled_msg_enabled: false,
  points_enabled: false,
  activity_stats_enabled: false,
  entertainment_enabled: false,
  usdt_price_enabled: false,
  channel_link_enabled: false,
  admin_perms_enabled: false,
  nsfw_detection_enabled: false,
  language_whitelist_enabled: false,
  invite_links_enabled: false,
  lottery_enabled: false,
  verified_users_enabled: false,
  // 详细配置对象
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
      // 功能开关字段
      verification_enabled: currentConfig.value.verification_enabled ?? false,
      welcome_enabled: currentConfig.value.welcome_enabled ?? false,
      auto_reply_enabled: currentConfig.value.auto_reply_enabled ?? false,
      auto_delete_enabled: currentConfig.value.auto_delete_enabled ?? false,
      auto_ban_enabled: currentConfig.value.auto_ban_enabled ?? false,
      auto_warn_enabled: currentConfig.value.auto_warn_enabled ?? false,
      auto_mute_enabled: currentConfig.value.auto_mute_enabled ?? false,
      flood_control_enabled: currentConfig.value.flood_control_enabled ?? false,
      ad_block_enabled: currentConfig.value.ad_block_enabled ?? false,
      command_disable_enabled: currentConfig.value.command_disable_enabled ?? false,
      crypto_enabled: currentConfig.value.crypto_enabled ?? false,
      members_enabled: currentConfig.value.members_enabled ?? false,
      scheduled_msg_enabled: currentConfig.value.scheduled_msg_enabled ?? false,
      points_enabled: currentConfig.value.points_enabled ?? false,
      activity_stats_enabled: currentConfig.value.activity_stats_enabled ?? false,
      entertainment_enabled: currentConfig.value.entertainment_enabled ?? false,
      usdt_price_enabled: currentConfig.value.usdt_price_enabled ?? false,
      channel_link_enabled: currentConfig.value.channel_link_enabled ?? false,
      admin_perms_enabled: currentConfig.value.admin_perms_enabled ?? false,
      nsfw_detection_enabled: currentConfig.value.nsfw_detection_enabled ?? false,
      language_whitelist_enabled: currentConfig.value.language_whitelist_enabled ?? false,
      invite_links_enabled: currentConfig.value.invite_links_enabled ?? false,
      lottery_enabled: currentConfig.value.lottery_enabled ?? false,
      verified_users_enabled: currentConfig.value.verified_users_enabled ?? false,
      // 详细配置对象
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
  
  .feature-overview {
    margin-bottom: 20px;
    
    .card-header {
      font-weight: 600;
      font-size: 16px;
    }
    
    .feature-sections {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    
    .feature-section {
      h4 {
        margin: 0 0 12px 0;
        font-size: 14px;
        color: #606266;
        border-bottom: 1px solid #ebeef5;
        padding-bottom: 8px;
      }
    }
    
    .feature-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
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
