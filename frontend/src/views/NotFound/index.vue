<template>
  <div class="not-found-page">
    <div class="content">
      <h1>404</h1>
      <p>页面不存在</p>
      <el-button type="primary" @click="$router.push('/')">
        返回首页
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
</script>

<style scoped lang="scss">
.not-found-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  
  .content {
    text-align: center;
    
    h1 {
      font-size: 120px;
      font-weight: bold;
      color: #409eff;
      margin: 0;
      line-height: 1;
    }
    
    p {
      font-size: 24px;
      color: #606266;
      margin: 20px 0 40px;
    }
  }
}
</style>
