// @ts-nocheck
import { supabase } from '../lib/database';
import { cacheManager } from '../lib/cache';
import { AutoReplyRule } from '../types/database';
import { sendMessage } from '../lib/api';

export const autoReplyService = {
  async findReply(text: string, groupId: string): Promise<AutoReplyRule | null> {
    const { data: rules } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .eq('group_id', groupId)
      .eq('is_enabled', true)
      .order('weight', { ascending: false })
      .order('used_count', { ascending: true });

    if (!rules || rules.length === 0) {
      return null;
    }

    const matchingRules = rules.filter((rule: AutoReplyRule) => this.matchesKeyword(text, rule));

    if (matchingRules.length === 0) {
      return null;
    }

    if (matchingRules.length === 1) {
      return matchingRules[0];
    }

    const totalWeight = matchingRules.reduce((sum: number, rule: AutoReplyRule) => sum + rule.weight, 0);
    let random = Math.random() * totalWeight;

    for (const rule of matchingRules) {
      random -= rule.weight;
      if (random <= 0) {
        return rule;
      }
    }

    return matchingRules[0];
  },

  matchesKeyword(text: string, rule: AutoReplyRule): boolean {
    const lowerText = text.toLowerCase();

    if (rule.is_regex) {
      try {
        const regex = new RegExp(rule.keyword, 'i');
        return regex.test(text);
      } catch {
        return false;
      }
    }

    switch (rule.match_mode) {
      case 'exact':
        return lowerText === rule.keyword.toLowerCase();
      case 'contains':
        return lowerText.includes(rule.keyword.toLowerCase());
      case 'starts_with':
        return lowerText.startsWith(rule.keyword.toLowerCase());
      case 'ends_with':
        return lowerText.endsWith(rule.keyword.toLowerCase());
      default:
        return lowerText.includes(rule.keyword.toLowerCase());
    }
  },

  async sendReply(chatId: number, rule: AutoReplyRule): Promise<void> {
    const content = rule.response_content;

    switch (rule.response_type) {
      case 'text':
        if (content.text) {
          await sendMessage(chatId, content.text);
        }
        break;

      case 'image':
        if (content.image_url) {
          await sendMessage(chatId, content.text || '', {
            replyMarkup: {
              inline_keyboard: content.buttons?.map(btn => [{
                text: btn.text || '',
                url: btn.url,
                callback_data: btn.callback_data
              }]) || []
            }
          });
        }
        break;

      case 'link':
        if (content.link_url) {
          await sendMessage(chatId, content.text || content.link_url);
        }
        break;

      case 'button':
      case 'rich':
        await sendMessage(chatId, content.text || '', {
          replyMarkup: {
            inline_keyboard: content.buttons?.map(btn => [{
              text: btn.text || '',
              url: btn.url,
              callback_data: btn.callback_data
            }]) || []
          }
        });
        break;
    }

    await this.updateUsageCount(rule.id);
  },

  async updateUsageCount(ruleId: string): Promise<void> {
    await supabase
      .from('auto_reply_rules')
      .increment({ used_count: 1 })
      .eq('id', ruleId);
  },

  async createRule(params: {
    groupId: string;
    keyword: string;
    isRegex?: boolean;
    matchMode?: string;
    weight?: number;
    responseType: string;
    responseContent: Record<string, unknown>;
    requireUsername?: boolean;
    deleteTrigger?: boolean;
    deleteDelay?: number;
    cooldown?: number;
    createdBy?: string;
  }): Promise<AutoReplyRule> {
    const { data, error } = await supabase
      .from('auto_reply_rules')
      .insert({
        group_id: params.groupId,
        keyword: params.keyword,
        is_regex: params.isRegex || false,
        match_mode: params.matchMode || 'contains',
        weight: params.weight || 1,
        response_type: params.responseType,
        response_content: params.responseContent,
        require_username: params.requireUsername || false,
        delete_trigger: params.deleteTrigger || false,
        delete_delay: params.deleteDelay || 0,
        cooldown: params.cooldown || 0,
        created_by: params.createdBy
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateRule(ruleId: string, updates: Partial<AutoReplyRule>): Promise<void> {
    await supabase
      .from('auto_reply_rules')
      .update(updates)
      .eq('id', ruleId);
  },

  async deleteRule(ruleId: string): Promise<void> {
    await supabase
      .from('auto_reply_rules')
      .delete()
      .eq('id', ruleId);
  },

  async getRules(groupId: string): Promise<AutoReplyRule[]> {
    const { data } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .eq('group_id', groupId)
      .order('weight', { ascending: false })
      .order('created_at', { ascending: true });

    return data || [];
  },

  async toggleRule(ruleId: string, enabled: boolean): Promise<void> {
    await supabase
      .from('auto_reply_rules')
      .update({ is_enabled: enabled })
      .eq('id', ruleId);
  },

  async duplicateRule(ruleId: string): Promise<AutoReplyRule> {
    const { data: original } = await supabase
      .from('auto_reply_rules')
      .select('*')
      .eq('id', ruleId)
      .single();

    if (!original) {
      throw new Error('规则不存在');
    }

    const { data, error } = await supabase
      .from('auto_reply_rules')
      .insert({
        group_id: original.group_id,
        keyword: `${original.keyword}_复制`,
        is_regex: original.is_regex,
        match_mode: original.match_mode,
        weight: original.weight,
        response_type: original.response_type,
        response_content: original.response_content,
        require_username: original.require_username,
        delete_trigger: original.delete_trigger,
        delete_delay: original.delete_delay,
        cooldown: original.cooldown,
        is_enabled: false
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
};
