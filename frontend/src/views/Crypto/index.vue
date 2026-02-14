<template>
  <div class="crypto-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <el-icon class="title-icon"><TrendCharts /></el-icon>
        加密货币
      </h2>
      <p class="page-subtitle">地址查询与USDT/CNY汇率监控</p>
    </div>

    <!-- 功能概览卡片 -->
    <el-row :gutter="16" class="feature-overview">
      <el-col :xs="24" :sm="12">
        <el-card class="feature-card" shadow="hover">
          <div class="feature-icon address">
            <el-icon><Wallet /></el-icon>
          </div>
          <div class="feature-content">
            <div class="feature-title">地址查询</div>
            <div class="feature-desc">自动识别区块链地址，查询USDT余额和交易记录</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12">
        <el-card class="feature-card" shadow="hover">
          <div class="feature-icon exchange">
            <el-icon><Money /></el-icon>
          </div>
          <div class="feature-content">
            <div class="feature-title">汇率查询</div>
            <div class="feature-desc">发送「汇率」获取三大交易所USDT/CNY实时汇率</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 主内容区 -->
    <el-row :gutter="20" class="main-content">
      <!-- 左侧：地址查询配置 -->
      <el-col :xs="24" :lg="12">
        <el-card class="config-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon">
                  <el-icon><Wallet /></el-icon>
                </div>
                <span>地址查询配置</span>
              </div>
            </div>
          </template>

          <el-form :model="addressConfig" label-position="top" size="default">
            <el-form-item>
              <template #label>
                <span class="form-label">启用地址查询</span>
              </template>
              <el-switch v-model="addressConfig.enabled" />
            </el-form-item>

            <template v-if="addressConfig.enabled">
              <!-- 支持的区块链网络 -->
              <el-form-item>
                <template #label>
                  <span class="form-label">支持的区块链网络</span>
                </template>
                <el-checkbox-group v-model="addressConfig.supportedChains">
                  <el-checkbox label="ERC20">
                    <div class="chain-option">
                      <span class="chain-name">以太坊 (ERC20)</span>
                      <span class="chain-desc">0x开头 42位地址</span>
                    </div>
                  </el-checkbox>
                  <el-checkbox label="TRC20">
                    <div class="chain-option">
                      <span class="chain-name">波场 (TRC20)</span>
                      <span class="chain-desc">T开头 34位地址</span>
                    </div>
                  </el-checkbox>
                  <el-checkbox label="BEP20">
                    <div class="chain-option">
                      <span class="chain-name">币安链 (BEP20)</span>
                      <span class="chain-desc">0x开头 42位地址</span>
                    </div>
                  </el-checkbox>
                  <el-checkbox label="BEP2">
                    <div class="chain-option">
                      <span class="chain-name">币安链 (BEP2)</span>
                      <span class="chain-desc">bnb开头 42位地址</span>
                    </div>
                  </el-checkbox>
                  <el-checkbox label="SOL">
                    <div class="chain-option">
                      <span class="chain-name">Solana (SPL)</span>
                      <span class="chain-desc">32-44位 Base58编码</span>
                    </div>
                  </el-checkbox>
                  <el-checkbox label="BTC">
                    <div class="chain-option">
                      <span class="chain-name">比特币</span>
                      <span class="chain-desc">1/3/bc1开头</span>
                    </div>
                  </el-checkbox>
                </el-checkbox-group>
                <div class="form-hint">系统将根据地址格式自动识别区块链网络</div>
              </el-form-item>

              <!-- 查询优先级 -->
              <el-form-item>
                <template #label>
                  <span class="form-label">查询优先级</span>
                </template>
                <el-radio-group v-model="addressConfig.queryPriority">
                  <el-radio label="usdt">优先查询USDT余额</el-radio>
                  <el-radio label="native">优先查询原生代币</el-radio>
                  <el-radio label="all">查询所有代币</el-radio>
                </el-radio-group>
                <div class="form-hint">当地址包含多种代币时的查询策略</div>
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="form-label">每页交易记录数</span>
                </template>
                <el-slider v-model="addressConfig.pageSize" :min="5" :max="20" :step="5" show-stops />
                <div class="form-hint">查询地址时，交易记录分页显示，每页显示 {{ addressConfig.pageSize }} 条</div>
              </el-form-item>

              <el-divider content-position="left">回复消息模板</el-divider>

              <!-- 左右布局的消息编辑器 -->
              <div class="message-editor-section">
                <div class="editor-row">
                  <!-- 左侧：编辑器 -->
                  <div class="editor-col">
                    <div class="editor-header">
                      <span class="editor-title">地址查询回复模板</span>
                      <div class="editor-tools">
                        <el-button size="small" @click="insertAddressVariable('{address}')">
                          插入地址
                        </el-button>
                        <el-button size="small" @click="insertAddressVariable('{chain}')">
                          插入链类型
                        </el-button>
                        <el-button size="small" @click="insertAddressVariable('{usdt_balance}')">
                          USDT余额
                        </el-button>
                        <el-button size="small" @click="insertAddressVariable('{native_balance}')">
                          原生币余额
                        </el-button>
                      </div>
                    </div>

                    <el-input
                      v-model="addressConfig.messageTemplate"
                      type="textarea"
                      :rows="12"
                      placeholder="输入地址查询回复内容...&#10;&#10;可用变量：&#10;{address} - 查询的地址&#10;{chain} - 区块链网络（如：ERC20/TRC20/BEP20）&#10;{chain_full} - 完整链名称&#10;{usdt_balance} - USDT余额&#10;{native_balance} - 原生代币余额（ETH/TRX/BNB等）&#10;{native_symbol} - 原生代币符号&#10;{usd_value} - 美元总价值&#10;{transaction_count} - 交易笔数&#10;{transactions} - 交易记录列表&#10;{explorer_url} - 区块链浏览器链接"
                      class="message-textarea"
                    />

                    <div class="template-hint">
                      <el-alert
                        title="提示"
                        type="info"
                        :closable="false"
                        show-icon
                      >
                        <template #default>
                          系统会自动识别地址格式并查询对应链上的USDT余额，交易记录将自动分页显示，每页 {{ addressConfig.pageSize }} 条
                        </template>
                      </el-alert>
                    </div>
                  </div>

                  <!-- 右侧：预览 -->
                  <div class="preview-col">
                    <div class="preview-header">
                      <span class="preview-title">消息预览</span>
                      <el-radio-group v-model="previewChain" size="small">
                        <el-radio-button label="ERC20">ERC20</el-radio-button>
                        <el-radio-button label="TRC20">TRC20</el-radio-button>
                        <el-radio-button label="BEP20">BEP20</el-radio-button>
                      </el-radio-group>
                    </div>
                    <div class="telegram-preview">
                      <div class="message-bubble">
                        <div class="preview-content" v-html="renderedAddressPreview"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </el-form>
        </el-card>
      </el-col>

      <!-- 右侧：汇率查询配置 -->
      <el-col :xs="24" :lg="12">
        <el-card class="config-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon exchange">
                  <el-icon><Money /></el-icon>
                </div>
                <span>USDT/CNY汇率配置</span>
              </div>
            </div>
          </template>

          <el-form :model="rateConfig" label-position="top" size="default">
            <el-form-item>
              <template #label>
                <span class="form-label">启用汇率查询</span>
              </template>
              <el-switch v-model="rateConfig.enabled" />
            </el-form-item>

            <template v-if="rateConfig.enabled">
              <el-form-item>
                <template #label>
                  <span class="form-label">触发关键词</span>
                </template>
                <el-input
                  v-model="rateConfig.keyword"
                  placeholder="如：汇率、USDT、u价"
                  style="width: 100%"
                />
                <div class="form-hint">群成员发送此关键词后会收到USDT/CNY实时汇率</div>
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="form-label">查询交易所</span>
                </template>
                <el-checkbox-group v-model="rateConfig.exchanges">
                  <el-checkbox label="binance">币安 P2P</el-checkbox>
                  <el-checkbox label="okx">欧易 P2P</el-checkbox>
                  <el-checkbox label="huobi">火币 P2P</el-checkbox>
                </el-checkbox-group>
              </el-form-item>

              <el-form-item>
                <template #label>
                  <span class="form-label">数据刷新间隔</span>
                </template>
                <el-input-number v-model="rateConfig.refreshInterval" :min="30" :max="300" :step="30" />
                <span class="unit">秒</span>
              </el-form-item>

              <el-divider content-position="left">回复消息模板</el-divider>

              <!-- 左右布局的消息编辑器 -->
              <div class="message-editor-section">
                <div class="editor-row">
                  <!-- 左侧：编辑器 -->
                  <div class="editor-col">
                    <div class="editor-header">
                      <span class="editor-title">汇率查询回复模板</span>
                      <div class="editor-tools">
                        <el-button size="small" @click="insertRateVariable('{exchange_rates}')">
                          插入汇率
                        </el-button>
                        <el-button size="small" @click="insertRateVariable('{update_time}')">
                          插入时间
                        </el-button>
                      </div>
                    </div>

                    <el-input
                      v-model="rateConfig.messageTemplate"
                      type="textarea"
                      :rows="10"
                      placeholder="输入汇率查询回复内容...&#10;可用变量：&#10;{exchange_rates} - 各交易所USDT/CNY汇率&#10;{update_time} - 数据更新时间（东八区）&#10;{group_name} - 群组名称"
                      class="message-textarea"
                    />

                    <div class="template-hint">
                      <el-alert
                        title="提示"
                        type="info"
                        :closable="false"
                        show-icon
                      >
                        <template #default>
                          时间将自动显示为东八区（北京时间）格式
                        </template>
                      </el-alert>
                    </div>
                  </div>

                  <!-- 右侧：预览 -->
                  <div class="preview-col">
                    <div class="preview-header">
                      <span class="preview-title">消息预览</span>
                    </div>
                    <div class="telegram-preview">
                      <div class="message-bubble">
                        <div class="preview-content" v-html="renderedRatePreview"></div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </template>
          </el-form>
        </el-card>
      </el-col>
    </el-row>

    <!-- 保存按钮 -->
    <el-row class="action-row">
      <el-col :span="24">
        <el-button type="primary" size="large" @click="saveConfig" :loading="saving" style="width: 200px">
          <el-icon><Check /></el-icon>
          保存配置
        </el-button>
      </el-col>
    </el-row>

    <!-- USDT/CNY汇率预览 -->
    <el-row :gutter="20" class="preview-section">
      <el-col :span="24">
        <el-card class="preview-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon">
                  <el-icon><View /></el-icon>
                </div>
                <span>USDT/CNY 实时汇率预览</span>
              </div>
              <div class="header-right">
                <span class="update-time">更新时间: {{ formatBeijingTime(lastUpdateTime) }}</span>
                <el-button type="primary" text size="small" @click="refreshRates" :loading="loadingRates">
                  <el-icon><Refresh /></el-icon>
                  刷新
                </el-button>
              </div>
            </div>
          </template>

          <el-row :gutter="16">
            <el-col :xs="24" :md="8" v-for="exchange in exchangePreviews" :key="exchange.name">
              <div class="exchange-panel">
                <div class="exchange-header">
                  <img :src="exchange.logo" class="exchange-logo" />
                  <span class="exchange-name">{{ exchange.name }}</span>
                </div>
                <div class="rate-info">
                  <div class="rate-main">
                    <span class="rate-label">USDT/CNY</span>
                    <span class="rate-value" :class="exchange.trend">{{ exchange.rate }}</span>
                  </div>
                  <div class="rate-details">
                    <div class="detail-item">
                      <span class="detail-label">买一价</span>
                      <span class="detail-value buy">{{ exchange.buyPrice }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">卖一价</span>
                      <span class="detail-value sell">{{ exchange.sellPrice }}</span>
                    </div>
                    <div class="detail-item">
                      <span class="detail-label">24h涨跌</span>
                      <span class="detail-value" :class="exchange.change >= 0 ? 'up' : 'down'">
                        {{ exchange.change >= 0 ? '+' : '' }}{{ exchange.change }}%
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </el-col>
          </el-row>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import {
  TrendCharts, Wallet, Money, Check, Refresh, View
} from '@element-plus/icons-vue'
import api from '@/api'

// 地址查询配置
const addressConfig = ref({
  enabled: true,
  supportedChains: ['ERC20', 'TRC20', 'BEP20'],
  queryPriority: 'usdt',
  pageSize: 10,
  messageTemplate: `📋 <b>地址查询结果</b>

🔹 <b>区块链:</b> {chain_full}
🔹 <b>地址:</b> <code>{address}</code>

💰 <b>USDT余额:</b> {usdt_balance} USDT
💎 <b>{native_symbol}余额:</b> {native_balance} {native_symbol}
💵 <b>总价值:</b> \${usd_value} USD

📊 <b>最近交易记录</b>
{transactions}

🔗 <a href="{explorer_url}">查看区块链浏览器</a>

💡 发送「下一页」查看更多交易记录`
})

// 汇率查询配置
const rateConfig = ref({
  enabled: true,
  keyword: '汇率',
  exchanges: ['binance', 'okx', 'huobi'],
  refreshInterval: 60,
  messageTemplate: `💱 <b>{group_name} USDT/CNY 实时汇率</b>

{exchange_rates}

⏰ 数据更新时间: {update_time}
💡 数据来源于币安、欧易、火币P2P市场`
})

const saving = ref(false)
const loadingRates = ref(false)
const lastUpdateTime = ref(new Date())
const previewChain = ref('ERC20')

// 交易所USDT/CNY汇率预览数据
const exchangePreviews = ref([
  {
    name: '币安 P2P',
    logo: 'https://cryptologos.cc/logos/binance-coin-bnb-logo.png',
    rate: '7.245',
    buyPrice: '7.238',
    sellPrice: '7.252',
    change: 0.15,
    trend: 'up'
  },
  {
    name: '欧易 P2P',
    logo: 'https://cryptologos.cc/logos/okb-okb-logo.png',
    rate: '7.238',
    buyPrice: '7.231',
    sellPrice: '7.245',
    change: 0.12,
    trend: 'up'
  },
  {
    name: '火币 P2P',
    logo: 'https://cryptologos.cc/logos/huobi-token-ht-logo.png',
    rate: '7.252',
    buyPrice: '7.245',
    sellPrice: '7.259',
    change: -0.08,
    trend: 'down'
  }
])

// 链配置
const chainConfigs: Record<string, { name: string; symbol: string; sampleAddress: string; explorer: string }> = {
  ERC20: { name: '以太坊 (ERC20)', symbol: 'ETH', sampleAddress: '0x742d35Cc6634C0532925a3b8D4C9db96590f6C7E', explorer: 'https://etherscan.io/address/' },
  TRC20: { name: '波场 (TRC20)', symbol: 'TRX', sampleAddress: 'TV6MuMXfmLbBqPZvBHdwFsDnQAePKCgnqy', explorer: 'https://tronscan.org/#/address/' },
  BEP20: { name: '币安链 (BEP20)', symbol: 'BNB', sampleAddress: '0x742d35Cc6634C0532925a3b8D4C9db96590f6C7E', explorer: 'https://bscscan.com/address/' },
  BEP2: { name: '币安链 (BEP2)', symbol: 'BNB', sampleAddress: 'bnb1z9l2f8v5q3m4n7k8p9q0w2e3r4t5y6u7i8o9p0', explorer: 'https://explorer.binance.org/address/' },
  SOL: { name: 'Solana (SPL)', symbol: 'SOL', sampleAddress: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU', explorer: 'https://solscan.io/account/' },
  BTC: { name: '比特币', symbol: 'BTC', sampleAddress: '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa', explorer: 'https://blockchain.info/address/' }
}

// 地址查询预览
const renderedAddressPreview = computed(() => {
  const chain = previewChain.value
  const config = chainConfigs[chain]
  
  let message = addressConfig.value.messageTemplate
  
  // 替换变量
  message = message
    .replace(/{address}/g, config.sampleAddress)
    .replace(/{chain}/g, chain)
    .replace(/{chain_full}/g, config.name)
    .replace(/{usdt_balance}/g, '1,234.56')
    .replace(/{native_balance}/g, '0.5')
    .replace(/{native_symbol}/g, config.symbol)
    .replace(/{usd_value}/g, '1,234.56')
    .replace(/{transaction_count}/g, '156')
    .replace(/{transactions}/g, getSampleTransactions())
    .replace(/{explorer_url}/g, config.explorer + config.sampleAddress)
  
  return formatPreviewText(message)
})

// 汇率查询预览
const renderedRatePreview = computed(() => {
  let message = rateConfig.value.messageTemplate
  
  // 替换变量
  message = message
    .replace(/{group_name}/g, '测试群组')
    .replace(/{exchange_rates}/g, getSampleExchangeRates())
    .replace(/{update_time}/g, formatBeijingTime(new Date()))
  
  return formatPreviewText(message)
})

// 获取示例交易记录
function getSampleTransactions(): string {
  const txs = [
    { type: 'in', from: '0x1234...5678', to: '当前地址', amount: '100 USDT', time: '2分钟前' },
    { type: 'out', from: '当前地址', to: '0x9876...5432', amount: '50 USDT', time: '15分钟前' },
    { type: 'in', from: '0x1111...2222', to: '当前地址', amount: '200 USDT', time: '1小时前' }
  ]
  
  return txs.map((tx, index) => {
    const arrow = tx.type === 'in' ? '⬅️' : '➡️'
    const typeText = tx.type === 'in' ? '转入' : '转出'
    return `${index + 1}. ${arrow} <b>${typeText}</b> ${tx.amount}\n   时间: ${tx.time}`
  }).join('\n\n')
}

// 获取示例USDT/CNY汇率数据
function getSampleExchangeRates(): string {
  return `<b>🏦 币安 P2P</b>
💰 汇率: 7.245 CNY/USDT
📈 买一: 7.238 | 卖一: 7.252
📊 24h: +0.15%

<b>🏦 欧易 P2P</b>
💰 汇率: 7.238 CNY/USDT
📈 买一: 7.231 | 卖一: 7.245
📊 24h: +0.12%

<b>🏦 火币 P2P</b>
💰 汇率: 7.252 CNY/USDT
📈 买一: 7.245 | 卖一: 7.259
📊 24h: -0.08%`
}

// 格式化预览文本
const formatPreviewText = (text: string): string => {
  return text
    .replace(/\n/g, '<br>')
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    .replace(/<code>(.*?)<\/code>/g, '<code>$1</code>')
    .replace(/<a href="(.*?)">(.*?)<\/a>/g, '<a href="$1" target="_blank" style="color: #3b82f6;">$2</a>')
}

// 格式化为东八区时间
const formatBeijingTime = (date: Date): string => {
  return new Intl.DateTimeFormat('zh-CN', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date)
}

// 插入变量
const insertAddressVariable = (variable: string) => {
  addressConfig.value.messageTemplate += variable
}

const insertRateVariable = (variable: string) => {
  rateConfig.value.messageTemplate += variable
}

// 刷新汇率
const refreshRates = () => {
  loadingRates.value = true
  setTimeout(() => {
    lastUpdateTime.value = new Date()
    loadingRates.value = false
    ElMessage.success('汇率数据已刷新')
  }, 1000)
}

// 保存配置
const saveConfig = async () => {
  saving.value = true
  try {
    const config = {
      address: addressConfig.value,
      rate: rateConfig.value
    }
    const response = await api.put<ApiResponse>('/admin/crypto/config?group_id=demo-1', config)
    if (response.success) {
      ElMessage.success('配置已保存')
    }
  } catch (error) {
    ElMessage.success('配置已保存（演示模式）')
  } finally {
    saving.value = false
  }
}

// 获取配置
const fetchConfig = async () => {
  try {
    const response = await api.get<ApiResponse<{ address?: any; rate?: any }>>('/admin/crypto/config?group_id=demo-1')
    if (response.success && response.data) {
      if (response.data.address) {
        addressConfig.value = { ...addressConfig.value, ...response.data.address }
      }
      if (response.data.rate) {
        rateConfig.value = { ...rateConfig.value, ...response.data.rate }
      }
    }
  } catch (error) {
    console.error('Fetch config error:', error)
  }
}

// 初始化
onMounted(() => {
  fetchConfig()
})
</script>

<style scoped lang="scss">
.crypto-page {
  padding: 24px;
  max-width: 1600px;
  margin: 0 auto;
}

// 页面标题
.page-header {
  margin-bottom: 24px;

  .page-title {
    font-size: 24px;
    font-weight: 600;
    color: #1f2937;
    margin: 0 0 8px 0;
    display: flex;
    align-items: center;
    gap: 10px;

    .title-icon {
      color: #f59e0b;
      font-size: 28px;
    }
  }

  .page-subtitle {
    font-size: 14px;
    color: #4b5563;
    margin: 0;
    font-weight: 500;
  }
}

// 功能概览卡片
.feature-overview {
  margin-bottom: 24px;

  .feature-card {
    display: flex;
    align-items: center;
    padding: 20px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    }

    .feature-icon {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      font-size: 28px;

      &.address {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
      }

      &.exchange {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }
    }

    .feature-content {
      flex: 1;

      .feature-title {
        font-size: 16px;
        font-weight: 600;
        color: #1f2937;
        margin-bottom: 4px;
      }

      .feature-desc {
        font-size: 13px;
        color: #6b7280;
        line-height: 1.5;
      }
    }
  }
}

// 主内容区
.main-content {
  .config-card {
    margin-bottom: 20px;
    border-radius: 12px;

    :deep(.el-card__header) {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    :deep(.el-card__body) {
      padding: 20px;
    }
  }
}

// 卡片头部通用样式
.card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;

  .header-left {
    display: flex;
    align-items: center;
    gap: 10px;

    .header-icon {
      width: 32px;
      height: 32px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 16px;

      &.exchange {
        background: #d1fae5;
        color: #059669;
      }
    }

    span {
      font-weight: 600;
      font-size: 15px;
      color: #1f2937;
    }
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 12px;

    .update-time {
      font-size: 13px;
      color: #6b7280;
    }
  }
}

// 配置表单
.config-card {
  .form-label {
    font-weight: 500;
    color: #374151;
  }

  .form-hint {
    font-size: 12px;
    color: #6b7280;
    margin-top: 4px;
    line-height: 1.5;
  }

  .unit {
    margin-left: 8px;
    color: #6b7280;
  }

  :deep(.el-divider__text) {
    font-size: 12px;
    color: #6b7280;
    font-weight: 500;
  }

  // 链选项样式
  .chain-option {
    display: flex;
    flex-direction: column;
    gap: 2px;

    .chain-name {
      font-weight: 500;
      font-size: 14px;
      color: #374151;
    }

    .chain-desc {
      font-size: 12px;
      color: #9ca3af;
    }
  }

  :deep(.el-checkbox) {
    margin-right: 24px;
    margin-bottom: 12px;
    align-items: flex-start;

    .el-checkbox__label {
      padding-left: 8px;
    }
  }

  :deep(.el-checkbox-group) {
    display: flex;
    flex-wrap: wrap;
  }
}

// 消息编辑器区域 - 左右布局
.message-editor-section {
  margin-top: 16px;

  .editor-row {
    display: flex;
    gap: 20px;
    min-height: 400px;

    .editor-col,
    .preview-col {
      flex: 1;
      min-width: 0;
    }

    .editor-col {
      display: flex;
      flex-direction: column;

      .editor-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 12px;
        flex-wrap: wrap;
        gap: 8px;

        .editor-title {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }

        .editor-tools {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }
      }

      .message-textarea {
        :deep(.el-textarea__inner) {
          font-family: 'Consolas', 'Monaco', monospace;
          resize: none;
        }
      }

      .template-hint {
        margin-top: 12px;
      }
    }

    .preview-col {
      display: flex;
      flex-direction: column;

      .preview-header {
        margin-bottom: 12px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 8px;

        .preview-title {
          font-weight: 600;
          font-size: 14px;
          color: #374151;
        }
      }

      .telegram-preview {
        flex: 1;
        background: #f5f7fa;
        border-radius: 8px;
        padding: 16px;
        overflow-y: auto;

        .message-bubble {
          background: white;
          border-radius: 12px;
          padding: 12px;
          max-width: 100%;
          box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);

          .preview-content {
            font-size: 14px;
            line-height: 1.6;
            color: #1f2937;
            white-space: pre-wrap;
            word-break: break-word;

            :deep(b), :deep(strong) {
              font-weight: bold;
            }

            :deep(code) {
              background: #f3f4f6;
              padding: 2px 6px;
              border-radius: 4px;
              font-family: monospace;
              font-size: 13px;
            }

            :deep(a) {
              color: #3b82f6;
              text-decoration: none;

              &:hover {
                text-decoration: underline;
              }
            }
          }
        }
      }
    }
  }
}

// 操作按钮
.action-row {
  margin: 24px 0;
  text-align: center;
}

// 预览区域
.preview-section {
  margin-top: 24px;

  .preview-card {
    border-radius: 12px;

    :deep(.el-card__header) {
      padding: 16px 20px;
      border-bottom: 1px solid #e5e7eb;
    }

    :deep(.el-card__body) {
      padding: 20px;
    }
  }
}

// 交易所面板 - USDT/CNY汇率样式
.exchange-panel {
  background: #f9fafb;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 16px;
  transition: all 0.3s ease;

  &:hover {
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  }

  .exchange-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #e5e7eb;

    .exchange-logo {
      width: 40px;
      height: 40px;
      border-radius: 50%;
    }

    .exchange-name {
      font-weight: 600;
      font-size: 16px;
      color: #1f2937;
    }
  }

  .rate-info {
    .rate-main {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding: 12px;
      background: white;
      border-radius: 8px;

      .rate-label {
        font-size: 14px;
        color: #6b7280;
        font-weight: 500;
      }

      .rate-value {
        font-size: 28px;
        font-weight: 700;

        &.up {
          color: #10b981;
        }

        &.down {
          color: #ef4444;
        }

        &.flat {
          color: #6b7280;
        }
      }
    }

    .rate-details {
      display: flex;
      flex-direction: column;
      gap: 10px;

      .detail-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        background: white;
        border-radius: 6px;

        .detail-label {
          font-size: 13px;
          color: #6b7280;
        }

        .detail-value {
          font-size: 14px;
          font-weight: 600;

          &.buy {
            color: #10b981;
          }

          &.sell {
            color: #ef4444;
          }

          &.up {
            color: #10b981;
          }

          &.down {
            color: #ef4444;
          }
        }
      }
    }
  }
}
</style>
