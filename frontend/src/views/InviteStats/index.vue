<template>
  <div class="invite-stats-page">
    <!-- 页面标题 -->
    <div class="page-header">
      <h2 class="page-title">
        <el-icon class="title-icon"><Trophy /></el-icon>
        邀请统计
      </h2>
      <p class="page-subtitle">管理群组邀请链接、查看排行榜和配置验证规则</p>
    </div>

    <!-- 统计概览卡片 -->
    <el-row :gutter="16" class="stats-overview">
      <el-col :xs="12" :sm="8" :md="4">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon users">
            <el-icon><User /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total_inviters }}</div>
            <div class="stat-label">邀请人数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="5">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon total">
            <el-icon><Link /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total_invites }}</div>
            <div class="stat-label">总邀请次数</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="8" :md="5">
        <el-card class="stat-card highlight" shadow="hover">
          <div class="stat-icon valid">
            <el-icon><CircleCheck /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.valid_invites }}</div>
            <div class="stat-label">有效邀请</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="12" :sm="12" :md="5">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-icon pending">
            <el-icon><Timer /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.pending_invites }}</div>
            <div class="stat-label">待验证</div>
          </div>
        </el-card>
      </el-col>
      <el-col :xs="24" :sm="12" :md="5">
        <el-card class="stat-card reward" shadow="hover">
          <div class="stat-icon reward">
            <el-icon><Coin /></el-icon>
          </div>
          <div class="stat-content">
            <div class="stat-value">{{ stats.total_rewards }}</div>
            <div class="stat-label">总奖励积分</div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 主内容区 -->
    <el-row :gutter="20" class="main-content">
      <!-- 左侧：排行榜和链接管理 -->
      <el-col :xs="24" :lg="16">
        <!-- 邀请排行榜 -->
        <el-card class="leaderboard-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon">
                  <el-icon><Trophy /></el-icon>
                </div>
                <div class="header-title">
                  <span>邀请排行榜</span>
                  <el-tag 
                    v-if="config.ranking_period === 'monthly'" 
                    size="small" 
                    type="warning"
                    effect="light"
                  >本月</el-tag>
                  <el-tag 
                    v-else-if="config.ranking_period === 'weekly'" 
                    size="small" 
                    type="success"
                    effect="light"
                  >本周</el-tag>
                  <el-tag v-else size="small" effect="light">总榜</el-tag>
                </div>
              </div>
              <div class="header-actions">
                <el-button type="primary" plain size="small" @click="showPublishDialog">
                  <el-icon><Promotion /></el-icon>
                  发布
                </el-button>
                <el-button text size="small" @click="refreshLeaderboard">
                  <el-icon><Refresh /></el-icon>
                </el-button>
              </div>
            </div>
          </template>

          <div v-if="leaderboard.length === 0" class="empty-state">
            <el-empty description="暂无邀请数据" :image-size="120">
              <template #description>
                <p>暂无邀请数据</p>
                <p class="empty-hint">用户开始邀请后将显示排行榜</p>
              </template>
            </el-empty>
          </div>

          <div v-else class="leaderboard-list">
            <!-- 前三名特殊展示 -->
            <div v-if="leaderboard.length >= 3" class="top-three-section">
              <div
                v-for="(item, index) in leaderboard.slice(0, 3)"
                :key="item.user_id"
                class="top-item"
                :class="['rank-' + (index + 1)]"
              >
                <div class="rank-crown">
                  <el-icon v-if="index === 0"><Trophy /></el-icon>
                  <span v-else class="rank-number">{{ index + 1 }}</span>
                </div>
                <el-avatar :size="index === 0 ? 64 : 56" :src="item.avatar_url" class="top-avatar">
                  {{ item.first_name?.charAt(0) || '?' }}
                </el-avatar>
                <div class="top-name">{{ item.first_name || item.username || '未知用户' }}</div>
                <div class="top-stats">
                  <span class="top-value">{{ item.valid_invites }}</span>
                  <span class="top-label">有效邀请</span>
                </div>
              </div>
            </div>

            <!-- 其他排名（分页显示） -->
            <div class="other-ranks">
              <div
                v-for="(item, index) in paginatedOtherRanks"
                :key="item.user_id"
                class="rank-item"
              >
                <div class="rank-number">{{ (currentPage - 1) * pageSize + index + 4 }}</div>
                <el-avatar :size="40" :src="item.avatar_url">
                  {{ item.first_name?.charAt(0) || '?' }}
                </el-avatar>
                <div class="rank-info">
                  <div class="rank-name">{{ item.first_name || item.username || '未知用户' }}</div>
                  <div v-if="item.username" class="rank-username">@{{ item.username }}</div>
                </div>
                <div class="rank-stats">
                  <div class="stat-box">
                    <span class="stat-num">{{ item.valid_invites }}</span>
                    <span class="stat-text">有效邀请</span>
                  </div>
                  <div class="stat-box">
                    <span class="stat-num reward">{{ item.total_rewards }}</span>
                    <span class="stat-text">获得奖励</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- 分页控件 -->
            <div class="pagination-controls" v-if="otherRanks.length > pageSize">
              <el-button
                size="small"
                :disabled="currentPage === 1"
                @click="currentPage--"
              >
                <el-icon><ArrowLeft /></el-icon>
                上一页
              </el-button>
              <span class="page-info">第 {{ currentPage }} / {{ totalPages }} 页</span>
              <el-button
                size="small"
                :disabled="currentPage === totalPages"
                @click="currentPage++"
              >
                下一页
                <el-icon><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </el-card>

        <!-- 邀请链接列表 -->
        <el-card class="links-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon link">
                  <el-icon><Link /></el-icon>
                </div>
                <span>邀请链接管理</span>
                <el-tag size="small" type="info">{{ filteredLinks.length }} 人</el-tag>
              </div>
              <el-input
                v-model="searchQuery"
                placeholder="搜索用户"
                clearable
                size="small"
                class="search-input"
              >
                <template #prefix>
                  <el-icon><Search /></el-icon>
                </template>
              </el-input>
            </div>
          </template>

          <el-table 
            :data="filteredLinks" 
            style="width: 100%"
            :header-cell-style="{ background: '#f5f7fa', fontWeight: 600 }"
            stripe
          >
            <el-table-column label="用户" min-width="160">
              <template #default="{ row }">
                <div class="user-cell">
                  <el-avatar :size="36" :src="row.user?.avatar_url">
                    {{ row.user?.first_name?.charAt(0) || '?' }}
                  </el-avatar>
                  <div class="user-info-cell">
                    <div class="name">{{ row.user?.first_name || '未知用户' }}</div>
                    <div v-if="row.user?.username" class="username">@{{ row.user.username }}</div>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="邀请码" width="140">
              <template #default="{ row }">
                <div class="code-cell">
                  <code class="invite-code">{{ row.invite_code }}</code>
                  <el-button 
                    size="small" 
                    text 
                    @click="copyLink(row.invite_link)"
                    class="copy-btn"
                  >
                    <el-icon><CopyDocument /></el-icon>
                  </el-button>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="邀请统计" width="180">
              <template #default="{ row }">
                <div class="stats-tags">
                  <div class="stat-tag valid">
                    <span class="tag-num">{{ row.valid_invites }}</span>
                    <span class="tag-label">有效</span>
                  </div>
                  <div class="stat-tag pending">
                    <span class="tag-num">{{ row.pending_invites }}</span>
                    <span class="tag-label">待验证</span>
                  </div>
                  <div class="stat-tag total">
                    <span class="tag-num">{{ row.total_invites }}</span>
                    <span class="tag-label">总计</span>
                  </div>
                </div>
              </template>
            </el-table-column>

            <el-table-column label="奖励" width="90" align="center">
              <template #default="{ row }">
                <span class="reward-badge">
                  <el-icon><Coin /></el-icon>
                  {{ row.total_rewards }}
                </span>
              </template>
            </el-table-column>

            <el-table-column label="状态" width="80" align="center">
              <template #default="{ row }">
                <el-switch
                  v-model="row.is_active"
                  size="small"
                  @change="(val: boolean) => toggleLinkStatus(row, val)"
                />
              </template>
            </el-table-column>

            <el-table-column label="操作" width="90" align="center">
              <template #default="{ row }">
                <el-button size="small" text type="primary" @click="viewRecords(row)">
                  记录
                </el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 右侧：配置面板 -->
      <el-col :xs="24" :lg="8">
        <!-- 排行榜配置 -->
        <el-card class="config-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-icon setting">
                <el-icon><Setting /></el-icon>
              </div>
              <span>排行榜配置</span>
            </div>
          </template>

          <el-form :model="config" label-position="top" size="default">
            <el-form-item>
              <template #label>
                <span class="form-label">启用排行榜</span>
              </template>
              <el-switch v-model="config.is_enabled" />
            </el-form-item>

            <el-form-item>
              <template #label>
                <span class="form-label">统计周期</span>
              </template>
              <el-radio-group v-model="config.ranking_period" size="small">
                <el-radio-button label="all_time">总榜</el-radio-button>
                <el-radio-button label="monthly">本月</el-radio-button>
                <el-radio-button label="weekly">本周</el-radio-button>
              </el-radio-group>
            </el-form-item>

            <el-form-item>
              <template #label>
                <span class="form-label">显示前 {{ config.show_top_count }} 名</span>
              </template>
              <el-slider v-model="config.show_top_count" :min="3" :max="50" :step="1" show-stops />
            </el-form-item>

            <el-form-item>
              <template #label>
                <span class="form-label">显示自己排名</span>
              </template>
              <el-switch v-model="config.show_self_rank" />
            </el-form-item>

            <el-divider content-position="left">消息模板</el-divider>

            <!-- 左右布局的消息编辑器 -->
            <div class="message-editor-section">
              <div class="editor-row">
                <!-- 左侧：编辑器 -->
                <div class="editor-col">
                  <div class="editor-header">
                    <span class="editor-title">排行榜消息编辑</span>
                    <div class="editor-tools">
                      <el-button size="small" @click="insertVariable('{leaderboard}')">
                        插入排行榜
                      </el-button>
                      <el-button size="small" @click="insertVariable('{group_name}')">
                        插入群名
                      </el-button>
                    </div>
                  </div>

                  <!-- 页眉 -->
                  <div class="input-section">
                    <div class="input-label">页眉文字</div>
                    <el-input
                      v-model="config.header_text"
                      placeholder="如：🎉 恭喜以下成员成为邀请达人！"
                      size="small"
                    />
                  </div>

                  <!-- 主体内容 -->
                  <div class="input-section">
                    <div class="input-label">消息内容</div>
                    <el-input
                      ref="messageTemplateRef"
                      v-model="config.message_template"
                      type="textarea"
                      :rows="8"
                      placeholder="输入排行榜消息内容...&#10;可用变量：&#10;{leaderboard} - 排行榜列表&#10;{group_name} - 群组名称&#10;{rank} - 用户排名&#10;{name} - 用户名称&#10;{invites} - 邀请人数&#10;{valid_invites} - 有效邀请&#10;{rewards} - 奖励积分"
                      class="message-textarea"
                    />
                  </div>

                  <!-- 页脚 -->
                  <div class="input-section">
                    <div class="input-label">页脚文字</div>
                    <el-input
                      v-model="config.footer_text"
                      placeholder="如：📢 邀请越多，奖励越多，快来参与吧！"
                      size="small"
                    />
                  </div>

                  <!-- 图片上传 -->
                  <div class="image-upload-section">
                    <el-button size="small" @click="showImageUpload = true">
                      <el-icon><Picture /></el-icon>
                      添加图片
                    </el-button>
                    <div v-if="config.image_url" class="image-preview">
                      <img :src="config.image_url" alt="预览" />
                      <el-button type="danger" link size="small" @click="config.image_url = ''">
                        <el-icon><Delete /></el-icon>
                      </el-button>
                    </div>
                  </div>

                  <!-- 内联按钮配置 -->
                  <div class="buttons-section">
                    <div class="section-title">
                      <span>内联按钮</span>
                      <el-button type="primary" link size="small" @click="addInlineButton">
                        <el-icon><Plus /></el-icon> 添加
                      </el-button>
                    </div>
                    <div class="buttons-list">
                      <div v-for="(btn, index) in config.inline_buttons" :key="index" class="button-item">
                        <el-input v-model="btn.text" placeholder="按钮文字" size="small" style="width: 120px;" />
                        <el-input v-model="btn.callback_data" placeholder="回调数据" size="small" style="width: 120px;" />
                        <el-button type="danger" link size="small" @click="removeInlineButton(index)">
                          <el-icon><Delete /></el-icon>
                        </el-button>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- 右侧：预览 -->
                <div class="preview-col">
                  <div class="preview-header">
                    <span class="preview-title">消息预览</span>
                  </div>
                  <div class="telegram-preview">
                    <div class="message-bubble">
                      <!-- 图片预览 -->
                      <div v-if="config.image_url" class="preview-image">
                        <img :src="config.image_url" />
                      </div>

                      <!-- 页眉 -->
                      <div v-if="config.header_text" class="preview-header-text" v-html="formatPreviewText(config.header_text)"></div>

                      <!-- 消息内容预览 -->
                      <div class="preview-content" v-html="renderedPreviewMessage"></div>

                      <!-- 页脚 -->
                      <div v-if="config.footer_text" class="preview-footer-text" v-html="formatPreviewText(config.footer_text)"></div>

                      <!-- 内联按钮预览 -->
                      <div v-if="config.inline_buttons && config.inline_buttons.length > 0" class="preview-inline-buttons">
                        <button
                          v-for="(btn, index) in config.inline_buttons"
                          :key="index"
                          class="preview-inline-btn"
                        >
                          {{ btn.text || '按钮' }}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <el-divider content-position="left">关键词触发</el-divider>

            <el-form-item>
              <template #label>
                <span class="form-label">启用关键词触发</span>
              </template>
              <el-switch v-model="config.enable_keyword_trigger" />
            </el-form-item>

            <el-form-item v-if="config.enable_keyword_trigger">
              <template #label>
                <span class="form-label">触发关键词</span>
              </template>
              <el-input
                v-model="config.trigger_keyword"
                placeholder="如: 邀请排行、排行榜"
                style="width: 100%"
              />
              <div class="form-hint">群成员发送此关键词后会收到排行榜消息</div>
            </el-form-item>

            <el-form-item class="form-actions">
              <el-button type="primary" @click="saveConfig" :loading="saving" style="width: 100%">
                <el-icon><Check /></el-icon>
                保存配置
              </el-button>
            </el-form-item>
          </el-form>
        </el-card>

        <!-- 验证规则 -->
        <el-card class="rules-card" shadow="never">
          <template #header>
            <div class="card-header">
              <div class="header-left">
                <div class="header-icon check">
                  <el-icon><CircleCheck /></el-icon>
                </div>
                <span>验证规则</span>
              </div>
              <el-button type="primary" text size="small" @click="showAddRuleDialog">
                <el-icon><Plus /></el-icon>
                添加
              </el-button>
            </div>
          </template>

          <div v-if="rules.length === 0" class="empty-rules">
            <el-empty description="暂无验证规则" :image-size="80">
              <template #description>
                <p>暂无验证规则</p>
                <p class="empty-hint">添加规则以验证邀请有效性</p>
              </template>
            </el-empty>
          </div>

          <div v-else class="rules-list">
            <div
              v-for="rule in rules"
              :key="rule.id"
              class="rule-item"
              :class="{ inactive: !rule.is_active }"
            >
              <div class="rule-header">
                <div class="rule-icon">
                  <el-icon>
                    <Timer v-if="rule.verification_type === 'stay_time'" />
                    <ChatDotRound v-else-if="rule.verification_type === 'message_count'" />
                    <Calendar v-else-if="rule.verification_type === 'checkin_count'" />
                    <Coin v-else />
                  </el-icon>
                </div>
                <div class="rule-title">
                  <span class="rule-name">{{ rule.name }}</span>
                  <el-switch v-model="rule.is_active" size="small" />
                </div>
              </div>
              <div class="rule-desc">{{ rule.description }}</div>
              <div class="rule-footer">
                <el-tag size="small" effect="plain" class="rule-type">
                  {{ getVerificationTypeLabel(rule.verification_type) }}
                </el-tag>
                <div class="rule-rewards">
                  <span class="reward-tag">
                    <el-icon><User /></el-icon>
                    +{{ rule.reward_points }}
                  </span>
                  <span class="reward-tag invited">
                    <el-icon><UserFilled /></el-icon>
                    +{{ rule.invited_reward_points }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 添加规则对话框 -->
    <el-dialog v-model="ruleDialogVisible" title="添加验证规则" width="520px" destroy-on-close>
      <el-form :model="newRule" label-width="100px" class="rule-form">
        <el-form-item label="规则名称" required>
          <el-input v-model="newRule.name" placeholder="如：停留时间验证" />
        </el-form-item>

        <el-form-item label="规则描述">
          <el-input v-model="newRule.description" type="textarea" :rows="2" />
        </el-form-item>

        <el-form-item label="验证类型" required>
          <el-select v-model="newRule.verification_type" style="width: 100%">
            <el-option label="⏱️ 停留时间" value="stay_time" />
            <el-option label="💬 发言数量" value="message_count" />
            <el-option label="📅 签到次数" value="checkin_count" />
            <el-option label="🎯 积分达到" value="points_reached" />
          </el-select>
        </el-form-item>

        <el-form-item label="验证参数" required>
          <el-input-number
            v-if="newRule.verification_type === 'stay_time'"
            v-model="newRule.verification_params.minutes"
            :min="1"
            :max="1440"
            style="width: 100%"
          >
            <template #append>分钟</template>
          </el-input-number>
          <el-input-number
            v-else-if="['message_count', 'checkin_count'].includes(newRule.verification_type)"
            v-model="newRule.verification_params.count"
            :min="1"
            :max="100"
            style="width: 100%"
          >
            <template #append>次</template>
          </el-input-number>
          <el-input-number
            v-else-if="newRule.verification_type === 'points_reached'"
            v-model="newRule.verification_params.points"
            :min="1"
            :max="10000"
            style="width: 100%"
          >
            <template #append>分</template>
          </el-input-number>
        </el-form-item>

        <el-form-item label="验证窗口" required>
          <el-input-number v-model="newRule.verification_window_hours" :min="1" :max="168" style="width: 100%">
            <template #append>小时</template>
          </el-input-number>
        </el-form-item>

        <el-divider content-position="left">奖励设置</el-divider>

        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="邀请人奖励">
              <el-input-number v-model="newRule.reward_points" :min="0" :max="10000" style="width: 100%">
                <template #append>分</template>
              </el-input-number>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="被邀请人奖励">
              <el-input-number v-model="newRule.invited_reward_points" :min="0" :max="10000" style="width: 100%">
                <template #append>分</template>
              </el-input-number>
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>

      <template #footer>
        <el-button @click="ruleDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="addRule" :loading="addingRule">添加规则</el-button>
      </template>
    </el-dialog>

    <!-- 发布对话框 -->
    <el-dialog v-model="publishDialogVisible" title="发布排行榜" width="700px">
      <div class="publish-preview">
        <h4>消息预览</h4>
        <div class="telegram-message-preview publish-message-preview">
          <div class="message-bubble">
            <!-- 头部文本 -->
            <div v-if="config.header_text" class="preview-header-text">
              {{ config.header_text }}
            </div>
            
            <!-- 预览图片 -->
            <div v-if="config.image_url" class="preview-image">
              <img :src="config.image_url" />
            </div>
            
            <!-- 预览消息内容 -->
            <div class="preview-message-content" v-html="renderedPublishMessage"></div>
            
            <!-- 预览内联按钮 -->
            <div v-if="config.inline_buttons && config.inline_buttons.length > 0" class="preview-inline-buttons">
              <div 
                v-for="(row, rowIndex) in getInlineButtonRows(config.inline_buttons)" 
                :key="rowIndex" 
                class="button-row"
              >
                <button
                  v-for="(btn, btnIndex) in row"
                  :key="btnIndex"
                  class="preview-inline-btn"
                >
                  {{ btn.text }}
                </button>
              </div>
            </div>
          </div>
          
          <!-- 预览回复按钮 -->
          <div v-if="config.reply_buttons && config.reply_buttons.length > 0" class="preview-reply-area">
            <div class="reply-buttons-container">
              <button
                v-for="(btn, index) in config.reply_buttons"
                :key="index"
                class="preview-reply-btn"
              >
                {{ btn.text }}
              </button>
            </div>
          </div>
          
          <!-- 尾部文本 -->
          <div v-if="config.footer_text" class="preview-footer-text">
            {{ config.footer_text }}
          </div>
        </div>
      </div>

      <template #footer>
        <el-button @click="publishDialogVisible = false">取消</el-button>
        <el-button type="primary" @click="publishLeaderboard" :loading="publishing">
          <el-icon><Promotion /></el-icon>
          发布到群组
        </el-button>
      </template>
    </el-dialog>

    <!-- 图片上传对话框 -->
    <el-dialog v-model="showImageUpload" title="上传图片" width="500px">
      <el-upload
        class="image-uploader"
        action="#"
        :auto-upload="false"
        :on-change="handleImageChange"
        :show-file-list="false"
        accept="image/*"
      >
        <img v-if="tempImageUrl" :src="tempImageUrl" class="upload-preview" />
        <div v-else class="upload-placeholder">
          <el-icon><Plus /></el-icon>
          <div>点击上传图片</div>
        </div>
      </el-upload>
      <template #footer>
        <el-button @click="showImageUpload = false">取消</el-button>
        <el-button type="primary" @click="confirmImageUpload">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import {
  Trophy, Link, Setting, Check, Plus, Refresh,
  Promotion, Search, CopyDocument, User, UserFilled,
  CircleCheck, Timer, Coin, ChatDotRound, Calendar,
  Picture, Delete, ArrowLeft, ArrowRight
} from '@element-plus/icons-vue'
import api from '@/api'

// 统计数据
const stats = ref({
  total_inviters: 0,
  total_invites: 0,
  valid_invites: 0,
  pending_invites: 0,
  total_rewards: 0
})

// 排行榜数据
const leaderboard = ref<any[]>([])
const inviteLinks = ref<any[]>([])
const searchQuery = ref('')

// 分页相关
const currentPage = ref(1)
const pageSize = 10

// 其他排名数据（第4名及以后）
const otherRanks = computed(() => {
  return leaderboard.value.slice(3)
})

// 分页后的其他排名数据
const paginatedOtherRanks = computed(() => {
  const start = (currentPage.value - 1) * pageSize
  const end = start + pageSize
  return otherRanks.value.slice(start, end)
})

// 总页数
const totalPages = computed(() => {
  return Math.ceil(otherRanks.value.length / pageSize)
})

// 配置
const config = ref({
  is_enabled: true,
  update_frequency: 'realtime',
  show_top_count: 10,
  show_self_rank: true,
  ranking_period: 'monthly',
  message_template: `📊 <b>{group_name} 邀请排行榜</b>

{leaderboard}

💡 发送「邀请链接」获取您的专属邀请链接
🏆 邀请好友加入即可获得奖励积分！`,
  header_text: '🎉 恭喜以下成员成为邀请达人！',
  footer_text: '📢 邀请越多，奖励越多，快来参与吧！',
  image_url: '',
  inline_buttons: [
    { text: '获取邀请链接', callback_data: 'get_invite_link' },
    { text: '查看我的排名', callback_data: 'my_rank' }
  ],
  reply_buttons: [],
  enable_keyword_trigger: false,
  trigger_keyword: '邀请排行'
})

// 消息编辑器变量
const messageVariables = [
  { key: 'leaderboard', label: '{leaderboard}', description: '排行榜列表' },
  { key: 'rank', label: '{rank}', description: '用户排名' },
  { key: 'name', label: '{name}', description: '用户名称' },
  { key: 'invites', label: '{invites}', description: '邀请人数' },
  { key: 'valid_invites', label: '{valid_invites}', description: '有效邀请' },
  { key: 'rewards', label: '{rewards}', description: '奖励积分' },
  { key: 'group_name', label: '{group_name}', description: '群组名称' }
]

// 验证规则
const rules = ref<any[]>([])

// 对话框状态
const ruleDialogVisible = ref(false)
const publishDialogVisible = ref(false)
const saving = ref(false)
const addingRule = ref(false)
const publishing = ref(false)
const messageTemplateRef = ref<any>(null)

// 新规则
const newRule = ref<{
  name: string
  description: string
  verification_type: string
  verification_params: { minutes?: number; count?: number; points?: number }
  verification_window_hours: number
  reward_points: number
  invited_reward_points: number
}>({
  name: '',
  description: '',
  verification_type: 'stay_time',
  verification_params: { minutes: 60 },
  verification_window_hours: 24,
  reward_points: 100,
  invited_reward_points: 50
})

// 消息预览渲染（用于左右布局的实时预览）
const renderedPreviewMessage = computed(() => {
  let message = config.value.message_template || ''

  // 替换变量
  message = message
    .replace(/{leaderboard}/g, '🥇 用户A - 50人\n🥈 用户B - 35人\n🥉 用户C - 28人')
    .replace(/{rank}/g, '1')
    .replace(/{name}/g, '示例用户')
    .replace(/{invites}/g, '50')
    .replace(/{valid_invites}/g, '45')
    .replace(/{rewards}/g, '1000')
    .replace(/{group_name}/g, '示例群组')

  // 转换HTML标签
  return formatPreviewText(message)
})

// 格式化预览文本
const formatPreviewText = (text: string): string => {
  return text
    .replace(/\n/g, '<br>')
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
    .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
    .replace(/<s>(.*?)<\/s>/g, '<del>$1</del>')
    .replace(/<code>(.*?)<\/code>/g, '<code>$1</code>')
    .replace(/<a href=['"](.*?)['"]>(.*?)<\/a>/g, '<a href="$1" target="_blank">$2</a>')
}

// 插入变量到光标位置
const insertVariable = (variable: string) => {
  const textarea = messageTemplateRef.value?.$el?.querySelector('textarea')
  const currentValue = config.value.message_template || ''
  
  if (!textarea) {
    config.value.message_template = currentValue + variable
    return
  }
  
  const start = textarea.selectionStart
  const end = textarea.selectionEnd
  
  config.value.message_template = currentValue.substring(0, start) + variable + currentValue.substring(end)
  
  nextTick(() => {
    const newCursorPos = start + variable.length
    textarea.focus()
    textarea.setSelectionRange(newCursorPos, newCursorPos)
  })
}

// 添加内联按钮
const addInlineButton = () => {
  config.value.inline_buttons.push({
    text: '',
    callback_data: ''
  })
}

// 移除内联按钮
const removeInlineButton = (index: number) => {
  config.value.inline_buttons.splice(index, 1)
}

// 图片上传相关
const showImageUpload = ref(false)
const tempImageUrl = ref('')

const handleImageChange = (file: any) => {
  const reader = new FileReader()
  reader.onload = (e) => {
    tempImageUrl.value = e.target?.result as string
  }
  reader.readAsDataURL(file.raw)
}

const confirmImageUpload = () => {
  config.value.image_url = tempImageUrl.value
  showImageUpload.value = false
  tempImageUrl.value = ''
}

// 发布消息预览渲染
const renderedPublishMessage = computed(() => {
  let message = config.value.message_template || ''

  // 替换变量
  message = message
    .replace(/{leaderboard}/g, '🥇 用户A - 50人\n🥈 用户B - 35人\n🥉 用户C - 28人')
    .replace(/{rank}/g, '1')
    .replace(/{name}/g, '示例用户')
    .replace(/{invites}/g, '50')
    .replace(/{valid_invites}/g, '45')
    .replace(/{rewards}/g, '1000')
    .replace(/{group_name}/g, '示例群组')

  // 转换HTML标签
  message = message
    .replace(/\n/g, '<br>')
    .replace(/<b>(.*?)<\/b>/g, '<strong>$1</strong>')
    .replace(/<i>(.*?)<\/i>/g, '<em>$1</em>')
    .replace(/<u>(.*?)<\/u>/g, '<u>$1</u>')
    .replace(/<s>(.*?)<\/s>/g, '<del>$1</del>')
    .replace(/<code>(.*?)<\/code>/g, '<code>$1</code>')
    .replace(/<a href=['"](.*?)['"]>(.*?)<\/a>/g, '<a href="$1" target="_blank">$2</a>')

  return message
})

// 获取内联按钮行（每行2个按钮）
const getInlineButtonRows = (buttons: any[]) => {
  const rows: any[][] = []
  for (let i = 0; i < buttons.length; i += 2) {
    rows.push(buttons.slice(i, i + 2))
  }
  return rows
}

// 过滤后的链接
const filteredLinks = computed(() => {
  if (!searchQuery.value) return inviteLinks.value
  const query = searchQuery.value.toLowerCase()
  return inviteLinks.value.filter(link =>
    link.user?.first_name?.toLowerCase().includes(query) ||
    link.user?.username?.toLowerCase().includes(query)
  )
})

// 获取统计数据
const fetchStats = async () => {
  try {
    const response = await api.get<ApiResponse<InviteStats>>('/admin/invite-stats?action=stats&group_id=demo-1')
    if (response.success && response.data) {
      stats.value = response.data
    }
  } catch (error) {
    console.error('Fetch stats error:', error)
  }
}

// 获取排行榜
const fetchLeaderboard = async () => {
  try {
    const response = await api.get<ApiResponse<Inviter[]>>('/admin/invite-stats?action=leaderboard&group_id=demo-1')
    if (response.success && response.data) {
      leaderboard.value = response.data
    }
  } catch (error) {
    console.error('Fetch leaderboard error:', error)
  }
}

// 获取邀请链接
const fetchInviteLinks = async () => {
  try {
    const response = await api.get<ApiResponse<any[]>>('/admin/invite-stats?action=links&group_id=demo-1')
    if (response.success && response.data) {
      inviteLinks.value = response.data
    }
  } catch (error) {
    console.error('Fetch invite links error:', error)
  }
}

// 获取配置
const fetchConfig = async () => {
  try {
    const response = await api.get<ApiResponse<any>>('/admin/invite-stats?action=config&group_id=demo-1')
    if (response.success && response.data) {
      config.value = { ...config.value, ...response.data }
    }
  } catch (error) {
    console.error('Fetch config error:', error)
  }
}

// 获取验证规则
const fetchRules = async () => {
  try {
    const response = await api.get<ApiResponse<any[]>>('/admin/invite-stats?action=rules&group_id=demo-1')
    if (response.success && response.data) {
      rules.value = response.data
    }
  } catch (error) {
    console.error('Fetch rules error:', error)
  }
}

// 保存配置
const saveConfig = async () => {
  saving.value = true
  try {
    const response = await api.put<ApiResponse>('/admin/invite-stats?action=config&group_id=demo-1', config.value)
    if (response.success) {
      ElMessage.success('配置已保存')
    }
  } catch (error) {
    ElMessage.error('保存失败')
  } finally {
    saving.value = false
  }
}

// 显示添加规则对话框
const showAddRuleDialog = () => {
  newRule.value = {
    name: '',
    description: '',
    verification_type: 'stay_time',
    verification_params: { minutes: 60 },
    verification_window_hours: 24,
    reward_points: 100,
    invited_reward_points: 50
  }
  ruleDialogVisible.value = true
}

// 添加规则
const addRule = async () => {
  addingRule.value = true
  try {
    const response = await api.post<ApiResponse>('/admin/invite-stats?action=rules&group_id=demo-1', newRule.value)
    if (response.success) {
      ElMessage.success('规则已添加')
      ruleDialogVisible.value = false
      fetchRules()
    }
  } catch (error) {
    ElMessage.error('添加失败')
  } finally {
    addingRule.value = false
  }
}

// 获取验证类型标签
const getVerificationTypeLabel = (type: string) => {
  const labels: Record<string, string> = {
    stay_time: '停留时间',
    message_count: '发言数量',
    checkin_count: '签到次数',
    points_reached: '积分达到'
  }
  return labels[type] || type
}

// 复制链接
const copyLink = (link: string) => {
  navigator.clipboard.writeText(link)
  ElMessage.success('链接已复制')
}

// 切换链接状态
const toggleLinkStatus = async (row: any, val: boolean) => {
  try {
    ElMessage.success(val ? '链接已启用' : '链接已禁用')
  } catch (error) {
    ElMessage.error('操作失败')
    row.is_active = !val
  }
}

// 查看记录
const viewRecords = (row: any) => {
  ElMessage.info(`查看 ${row.user?.first_name} 的邀请记录`)
}

// 刷新排行榜
const refreshLeaderboard = () => {
  currentPage.value = 1 // 重置到第一页
  fetchLeaderboard()
  ElMessage.success('排行榜已刷新')
}

// 显示发布对话框
const showPublishDialog = () => {
  publishDialogVisible.value = true
}

// 发布排行榜
const publishLeaderboard = async () => {
  publishing.value = true
  try {
    await new Promise(resolve => setTimeout(resolve, 1000))
    ElMessage.success('排行榜已发布到群组')
    publishDialogVisible.value = false
  } catch (error) {
    ElMessage.error('发布失败')
  } finally {
    publishing.value = false
  }
}

// 初始化
onMounted(() => {
  fetchStats()
  fetchLeaderboard()
  fetchInviteLinks()
  fetchConfig()
  fetchRules()
})
</script>

<style scoped lang="scss">
.invite-stats-page {
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

// 统计概览卡片
.stats-overview {
  margin-bottom: 24px;

  .stat-card {
    display: flex;
    align-items: center;
    padding: 20px;
    transition: all 0.3s ease;

    &:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 16px rgba(0, 0, 0, 0.08);
    }

    .stat-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 16px;
      font-size: 24px;

      &.users {
        background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
        color: white;
      }

      &.total {
        background: linear-gradient(135deg, #8b5cf6 0%, #7c3aed 100%);
        color: white;
      }

      &.valid {
        background: linear-gradient(135deg, #10b981 0%, #059669 100%);
        color: white;
      }

      &.pending {
        background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%);
        color: white;
      }

      &.reward {
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
      }
    }

    .stat-content {
      flex: 1;

      .stat-value {
        font-size: 28px;
        font-weight: 700;
        color: #1f2937;
        line-height: 1.2;
        margin-bottom: 4px;
      }

      .stat-label {
        font-size: 13px;
        color: #374151;
        font-weight: 500;
      }
    }

    &.highlight {
      .stat-value {
        color: #059669;
      }
    }

    &.reward {
      .stat-value {
        color: #ea580c;
      }
    }
  }
}

// 主内容区
.main-content {
  .leaderboard-card,
  .links-card,
  .config-card,
  .rules-card {
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

      &.link {
        background: #dbeafe;
        color: #2563eb;
      }

      &.setting {
        background: #f3e8ff;
        color: #7c3aed;
      }

      &.check {
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

  .header-actions {
    display: flex;
    gap: 8px;
  }
}

// 排行榜样式
.leaderboard-card {
  .card-header {
    .header-left {
      .header-icon {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: white;
      }

      .header-title {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    }
  }
}

// 前三名特殊展示
.top-three-section {
  display: flex;
  justify-content: center;
  align-items: flex-end;
  gap: 24px;
  padding: 24px 0 32px;
  margin-bottom: 24px;
  border-bottom: 1px dashed #e5e7eb;

  .top-item {
    display: flex;
    flex-direction: column;
    align-items: center;
    text-align: center;
    position: relative;

    &.rank-1 {
      order: 2;
      transform: scale(1.1);
      z-index: 3;

      .rank-crown {
        background: linear-gradient(135deg, #fbbf24 0%, #f59e0b 100%);
        color: white;
      }
    }

    &.rank-2 {
      order: 1;
      z-index: 2;

      .rank-crown {
        background: linear-gradient(135deg, #9ca3af 0%, #6b7280 100%);
        color: white;
      }
    }

    &.rank-3 {
      order: 3;
      z-index: 1;

      .rank-crown {
        background: linear-gradient(135deg, #f97316 0%, #ea580c 100%);
        color: white;
      }
    }

    .rank-crown {
      width: 32px;
      height: 32px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      font-weight: 700;
      margin-bottom: 8px;
      box-shadow: 0 4px 8px rgba(0, 0, 0, 0.15);
    }

    .top-avatar {
      border: 3px solid white;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
      margin-bottom: 12px;
    }

    .top-name {
      font-weight: 600;
      font-size: 14px;
      color: #1f2937;
      margin-bottom: 4px;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .top-stats {
      .top-value {
        font-size: 20px;
        font-weight: 700;
        color: #f59e0b;
      }

      .top-label {
        font-size: 12px;
        color: #4b5563;
        margin-left: 4px;
        font-weight: 500;
      }
    }
  }
}

// 其他排名
.other-ranks {
  .rank-item {
    display: flex;
    align-items: center;
    padding: 12px 16px;
    border-radius: 8px;
    transition: background-color 0.2s;

    &:hover {
      background-color: #f9fafb;
    }

    &:not(:last-child) {
      margin-bottom: 4px;
    }

    .rank-number {
      width: 32px;
      font-size: 14px;
      font-weight: 600;
      color: #6b7280;
      text-align: center;
    }

    .el-avatar {
      margin: 0 12px;
    }

    .rank-info {
      flex: 1;
      min-width: 0;

      .rank-name {
        font-weight: 500;
        font-size: 14px;
        color: #1f2937;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .rank-username {
        font-size: 12px;
        color: #6b7280;
      }
    }

    .rank-stats {
      display: flex;
      gap: 16px;

      .stat-box {
        text-align: center;

        .stat-num {
          display: block;
          font-size: 16px;
          font-weight: 600;
          color: #3b82f6;

          &.reward {
            color: #f97316;
          }
        }

        .stat-text {
          font-size: 11px;
          color: #9ca3af;
        }
      }
    }
  }

  // 分页控件
  .pagination-controls {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 16px;
    padding: 16px 0;
    margin-top: 8px;
    border-top: 1px solid #e5e7eb;

    .page-info {
      font-size: 14px;
      color: #6b7280;
      font-weight: 500;
    }
  }
}

// 邀请链接表格
.links-card {
  .search-input {
    width: 200px;
  }

  .user-cell {
    display: flex;
    align-items: center;
    gap: 10px;

    .user-info-cell {
      .name {
        font-weight: 500;
        font-size: 14px;
        color: #1f2937;
      }

      .username {
        font-size: 12px;
        color: #9ca3af;
      }
    }
  }

  .code-cell {
    display: flex;
    align-items: center;
    gap: 6px;

    .invite-code {
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 12px;
      color: #3b82f6;
      background: #eff6ff;
      padding: 4px 8px;
      border-radius: 4px;
      max-width: 100px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .copy-btn {
      padding: 4px;
    }
  }

  .stats-tags {
    display: flex;
    gap: 6px;
    flex-wrap: wrap;

    .stat-tag {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 4px 8px;
      border-radius: 6px;
      min-width: 44px;

      .tag-num {
        font-size: 14px;
        font-weight: 600;
      }

      .tag-label {
        font-size: 10px;
      }

      &.valid {
        background: #d1fae5;
        color: #059669;
      }

      &.pending {
        background: #fef3c7;
        color: #d97706;
      }

      &.total {
        background: #e0e7ff;
        color: #4f46e5;
      }
    }
  }

  .reward-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: #f97316;
    font-weight: 600;
    font-size: 14px;

    .el-icon {
      font-size: 14px;
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

  .form-actions {
    margin-top: 24px;
    margin-bottom: 0;
  }

  :deep(.el-divider__text) {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
  }

  // 消息编辑器样式调整
  .message-editor-form-item {
    :deep(.el-form-item__content) {
      display: block;
    }
  }

  // 左右布局消息编辑器
  .message-editor-section {
    margin-top: 16px;

    .editor-row {
      display: flex;
      gap: 20px;
      min-height: 500px;

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

          .editor-title {
            font-weight: 600;
            font-size: 14px;
            color: #374151;
          }

          .editor-tools {
            display: flex;
            gap: 8px;
          }
        }

        .input-section {
          margin-bottom: 12px;

          .input-label {
            font-size: 12px;
            color: #6b7280;
            margin-bottom: 4px;
            font-weight: 500;
          }
        }

        .message-textarea {
          :deep(.el-textarea__inner) {
            font-family: 'Consolas', 'Monaco', monospace;
            resize: none;
          }
        }

        .image-upload-section {
          margin-top: 12px;
          display: flex;
          align-items: center;
          gap: 12px;

          .image-preview {
            display: flex;
            align-items: center;
            gap: 8px;

            img {
              width: 60px;
              height: 60px;
              object-fit: cover;
              border-radius: 4px;
            }
          }
        }

        .buttons-section {
          margin-top: 16px;

          .section-title {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 8px;
            font-size: 13px;
            color: #374151;
            font-weight: 500;
          }

          .buttons-list {
            display: flex;
            flex-direction: column;
            gap: 8px;

            .button-item {
              display: flex;
              align-items: center;
              gap: 8px;
            }
          }
        }
      }

      .preview-col {
        display: flex;
        flex-direction: column;

        .preview-header {
          margin-bottom: 12px;

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

            .preview-image {
              margin-bottom: 8px;

              img {
                width: 100%;
                border-radius: 8px;
                max-height: 200px;
                object-fit: cover;
              }
            }

            .preview-header-text {
              font-size: 14px;
              color: #1f2937;
              margin-bottom: 8px;
              padding-bottom: 8px;
              border-bottom: 1px solid #e5e7eb;

              :deep(b), :deep(strong) {
                font-weight: bold;
              }
            }

            .preview-content {
              font-size: 14px;
              line-height: 1.6;
              color: #1f2937;
              white-space: pre-wrap;
              word-break: break-word;

              :deep(b), :deep(strong) {
                font-weight: bold;
              }

              :deep(i), :deep(em) {
                font-style: italic;
              }

              :deep(code) {
                background: #f3f4f6;
                padding: 2px 6px;
                border-radius: 4px;
                font-family: monospace;
                font-size: 13px;
              }
            }

            .preview-footer-text {
              font-size: 14px;
              color: #1f2937;
              margin-top: 8px;
              padding-top: 8px;
              border-top: 1px solid #e5e7eb;

              :deep(b), :deep(strong) {
                font-weight: bold;
              }
            }

            .preview-inline-buttons {
              margin-top: 12px;
              display: flex;
              flex-direction: column;
              gap: 8px;

              .preview-inline-btn {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 6px;
                padding: 8px 16px;
                font-size: 14px;
                color: #3b82f6;
                cursor: pointer;
                width: 100%;
                text-align: center;

                &:hover {
                  background: #f9fafb;
                }
              }
            }
          }
        }
      }
    }
  }
}

// 图片上传对话框
.image-uploader {
  :deep(.el-upload) {
    width: 100%;
    height: 200px;
    border: 2px dashed #d9d9d9;
    border-radius: 8px;
    cursor: pointer;
    position: relative;
    overflow: hidden;
    transition: border-color 0.3s;

    &:hover {
      border-color: #409eff;
    }
  }

  .upload-preview {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .upload-placeholder {
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: #8c939d;

    .el-icon {
      font-size: 28px;
      margin-bottom: 8px;
    }
  }
}

// 验证规则
.rules-card {
  .empty-rules {
    padding: 32px 0;

    .empty-hint {
      font-size: 12px;
      color: #9ca3af;
      margin-top: 4px;
    }
  }

  .rules-list {
    .rule-item {
      padding: 16px;
      border: 1px solid #e5e7eb;
      border-radius: 10px;
      margin-bottom: 12px;
      transition: all 0.2s;

      &:hover {
        border-color: #d1d5db;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
      }

      &.inactive {
        opacity: 0.6;
        background: #f9fafb;
      }

      .rule-header {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-bottom: 8px;

        .rule-icon {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          background: #f3f4f6;
          color: #6b7280;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
        }

        .rule-title {
          flex: 1;
          display: flex;
          justify-content: space-between;
          align-items: center;

          .rule-name {
            font-weight: 600;
            font-size: 14px;
            color: #1f2937;
          }
        }
      }

      .rule-desc {
        font-size: 13px;
        color: #6b7280;
        margin-bottom: 12px;
        line-height: 1.5;
      }

      .rule-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;

        .rule-type {
          font-size: 11px;
        }

        .rule-rewards {
          display: flex;
          gap: 8px;

          .reward-tag {
            display: inline-flex;
            align-items: center;
            gap: 3px;
            font-size: 12px;
            color: #059669;
            background: #d1fae5;
            padding: 2px 8px;
            border-radius: 4px;

            &.invited {
              color: #7c3aed;
              background: #ede9fe;
            }

            .el-icon {
              font-size: 12px;
            }
          }
        }
      }
    }
  }
}

// 发布预览
.publish-preview {
  h4 {
    font-size: 14px;
    font-weight: 600;
    color: #374151;
    margin: 0 0 12px 0;
  }

  .message-preview-box {
    background: #f9fafb;
    border: 1px solid #e5e7eb;
    border-radius: 12px;
    padding: 16px;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;

    .preview-header {
      font-weight: 600;
      font-size: 15px;
      color: #1f2937;
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid #e5e7eb;
    }

    .preview-content {
      margin-bottom: 12px;

      .preview-item {
        display: flex;
        align-items: center;
        padding: 6px 0;
        font-size: 14px;

        .preview-rank {
          width: 28px;
          font-size: 16px;
        }

        .preview-name {
          flex: 1;
          color: #374151;
        }

        .preview-count {
          color: #6b7280;
          font-size: 13px;
        }
      }
    }

    .preview-footer {
      color: #6b7280;
      font-size: 13px;
      padding-top: 12px;
      border-top: 1px solid #e5e7eb;
    }
  }
}

// 空状态
.empty-state {
  padding: 48px 0;

  .empty-hint {
    font-size: 13px;
    color: #9ca3af;
    margin-top: 8px;
  }
}

// 规则表单
.rule-form {
  :deep(.el-divider__text) {
    font-size: 12px;
    color: #9ca3af;
    font-weight: 500;
  }
}

// 响应式调整
@media (max-width: 768px) {
  .invite-stats-page {
    padding: 16px;
  }

  .stats-overview {
    .el-col {
      margin-bottom: 12px;
    }

    .stat-card {
      padding: 16px;

      .stat-icon {
        width: 40px;
        height: 40px;
        font-size: 20px;
        margin-right: 12px;
      }

      .stat-content {
        .stat-value {
          font-size: 22px;
        }

        .stat-label {
          font-size: 12px;
        }
      }
    }
  }

  .top-three-section {
    gap: 16px;
    padding: 16px 0 24px;

    .top-item {
      &.rank-1 {
        transform: scale(1);
      }

      .top-avatar {
        width: 48px !important;
        height: 48px !important;
      }
    }
  }

  .links-card {
    .search-input {
      width: 150px;
    }
  }
}
</style>
