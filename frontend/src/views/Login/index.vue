<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="width: 400px; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #303133; margin: 0 0 8px;">Telegram 群管机器人</h1>
        <p style="font-size: 14px; color: #909399; margin: 0;">管理后台登录</p>
      </div>
      
      <!-- 步骤 1: 输入 Telegram ID -->
      <div v-if="step === 1" style="margin-bottom: 24px;">
        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #606266;">
            Telegram 用户名或 ID
          </label>
          <input
            v-model="telegramId"
            type="text"
            placeholder="@username 或数字 ID"
            style="width: 100%; padding: 12px 16px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 16px; box-sizing: border-box;"
            @keyup.enter="sendCode"
          />
          <p style="margin: 8px 0 0; font-size: 12px; color: #909399;">
            💡 提示：请先与机器人开始对话，才能接收验证码
          </p>
        </div>

        <div>
          <button
            @click="sendCode"
            :disabled="sending || !telegramId"
            style="width: 100%; padding: 12px; background: #409eff; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;"
            :style="{ opacity: sending || !telegramId ? 0.6 : 1 }"
          >
            {{ sending ? '发送中...' : '获取验证码' }}
          </button>
        </div>
      </div>

      <!-- 步骤 2: 输入验证码 -->
      <div v-if="step === 2" style="margin-bottom: 24px;">
        <div style="margin-bottom: 20px; text-align: center;">
          <div style="width: 64px; height: 64px; background: #f0f9ff; border-radius: 50%; margin: 0 auto 16px; display: flex; align-items: center; justify-content: center; font-size: 32px;">
            ✉️
          </div>
          <p style="margin: 0 0 8px; font-size: 16px; color: #303133;">验证码已发送</p>
          <p style="margin: 0; font-size: 14px; color: #909399;">请查看 Telegram 私信</p>
        </div>

        <div style="margin-bottom: 20px;">
          <label style="display: block; margin-bottom: 8px; font-size: 14px; color: #606266;">
            验证码
          </label>
          <input
            v-model="code"
            type="text"
            placeholder="请输入 6 位验证码"
            maxlength="6"
            style="width: 100%; padding: 12px 16px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 16px; text-align: center; letter-spacing: 8px; box-sizing: border-box;"
            @keyup.enter="verifyCode"
          />
        </div>

        <div style="margin-bottom: 16px;">
          <button
            @click="verifyCode"
            :disabled="verifying || code.length !== 6"
            style="width: 100%; padding: 12px; background: #67c23a; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;"
            :style="{ opacity: verifying || code.length !== 6 ? 0.6 : 1 }"
          >
            {{ verifying ? '登录中...' : '登录' }}
          </button>
        </div>

        <div style="text-align: center;">
          <button
            @click="backToStep1"
            style="background: none; border: none; color: #909399; font-size: 14px; cursor: pointer; text-decoration: underline;"
          >
            ← 返回重新输入
          </button>
        </div>
      </div>

      <!-- 错误提示 -->
      <div v-if="error" style="margin-bottom: 16px; padding: 12px; background: #fef0f0; border: 1px solid #fde2e2; border-radius: 4px; color: #f56c6c; font-size: 14px;">
        {{ error }}
      </div>

      <!-- 成功提示 -->
      <div v-if="success" style="margin-bottom: 16px; padding: 12px; background: #f0f9ff; border: 1px solid #b3d8ff; border-radius: 4px; color: #409eff; font-size: 14px;">
        {{ success }}
      </div>
      
      <div style="text-align: center; font-size: 12px; color: #909399; margin-top: 16px;">
        <p>🔒 安全登录 · 验证码 5 分钟有效</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const step = ref(1)
const telegramId = ref('')
const code = ref('')
const sending = ref(false)
const verifying = ref(false)
const error = ref('')
const success = ref('')

const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://tg-group-admin.vercel.app'

async function sendCode() {
  if (!telegramId.value) {
    error.value = '请输入 Telegram 用户名或 ID'
    return
  }

  error.value = ''
  success.value = ''
  sending.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/send-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegramId: telegramId.value
      })
    })

    const result = await response.json()

    if (result.success) {
      success.value = result.message
      step.value = 2
      // 3秒后清除成功提示
      setTimeout(() => {
        success.value = ''
      }, 3000)
    } else {
      error.value = result.error || '发送验证码失败'
    }
  } catch (err) {
    console.error('Send code error:', err)
    error.value = '网络错误，请检查连接后重试'
  } finally {
    sending.value = false
  }
}

async function verifyCode() {
  if (code.value.length !== 6) {
    error.value = '请输入完整的 6 位验证码'
    return
  }

  error.value = ''
  verifying.value = true

  try {
    const response = await fetch(`${API_BASE_URL}/api/admin/auth/verify-code`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        telegramId: telegramId.value,
        code: code.value
      })
    })

    const result = await response.json()

    if (result.success && result.token) {
      // 保存 token 和用户信息
      localStorage.setItem('token', result.token)
      localStorage.setItem('user', JSON.stringify(result.user))
      
      // 跳转到首页
      router.push('/')
    } else {
      error.value = result.error || '验证码错误'
      // 清空验证码输入
      code.value = ''
    }
  } catch (err) {
    console.error('Verify code error:', err)
    error.value = '登录失败，请检查网络连接'
  } finally {
    verifying.value = false
  }
}

function backToStep1() {
  step.value = 1
  code.value = ''
  error.value = ''
  success.value = ''
}
</script>
