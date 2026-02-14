<template>
  <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);">
    <div style="width: 400px; padding: 40px; background: #fff; border-radius: 12px; box-shadow: 0 20px 60px rgba(0, 0, 0, 0.2);">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="font-size: 24px; font-weight: 600; color: #303133; margin: 0 0 8px;">Telegram 群管机器人</h1>
        <p style="font-size: 14px; color: #909399; margin: 0;">管理后台登录</p>
      </div>
      
      <form style="margin-bottom: 24px;" @submit.prevent="handleLogin">
        <div style="margin-bottom: 20px;">
          <input
            v-model="username"
            type="text"
            placeholder="请输入用户名"
            style="width: 100%; padding: 12px 16px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 16px;"
          />
        </div>

        <div style="margin-bottom: 24px;">
          <input
            v-model="password"
            type="password"
            placeholder="请输入密码"
            style="width: 100%; padding: 12px 16px; border: 1px solid #dcdfe6; border-radius: 4px; font-size: 16px;"
          />
        </div>
        
        <div>
          <button
            type="submit"
            :disabled="loading"
            style="width: 100%; padding: 12px; background: #409eff; color: #fff; border: none; border-radius: 4px; font-size: 16px; cursor: pointer;"
          >
            {{ loading ? '登录中...' : '登录' }}
          </button>
        </div>
      </form>
      
      <div style="text-align: center; font-size: 12px; color: #909399;">
        默认管理员: admin / ******
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const username = ref('')
const password = ref('')
const loading = ref(false)

async function handleLogin() {
  if (!username.value || !password.value) {
    alert('请输入用户名和密码')
    return
  }
  
  loading.value = true
  
  try {
    // 管理员登录验证
    const ADMIN_USERNAME = 'admin'
    const ADMIN_PASSWORD = 'your-new-password-here'  // 修改这里
    
    if (username.value === ADMIN_USERNAME && password.value === ADMIN_PASSWORD) {
      localStorage.setItem('token', 'test-token')
      router.push('/')
    } else {
      alert('用户名或密码错误')
    }
  } catch (error) {
    alert('登录失败，请重试')
  } finally {
    loading.value = false
  }
}
</script>