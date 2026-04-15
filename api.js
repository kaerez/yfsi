// ============================================
// ./api.js
// ============================================

// API configuration using Trello native shared storage
export const RulesAPI = {
  async getRules(t) {
    try {
      return (await t.get('board', 'shared', 'your_free_smart_indicator_rules')) || [];
    } catch (error) {
      console.error('Error fetching rules from Trello:', error);
      return [];
    }
  },
  
  async saveRules(t, rules) {
    try {
      await t.set('board', 'shared', 'your_free_smart_indicator_rules', rules);
      return rules;
    } catch (error) {
      console.error('Error saving rules to Trello:', error);
      throw error;
    }
  },
  
  async createRule(t, ruleData) {
    const rules = await this.getRules(t);
    const newRule = {
      ...ruleData,
      id: 'rule_' + Date.now().toString() + '_' + Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    rules.push(newRule);
    await this.saveRules(t, rules);
    return newRule;
  },
  
  async updateRule(t, ruleId, updates) {
    const rules = await this.getRules(t);
    const index = rules.findIndex(r => r.id === ruleId);
    if (index !== -1) {
      rules[index] = { ...rules[index], ...updates, updated_at: new Date().toISOString() };
      await this.saveRules(t, rules);
      return rules[index];
    }
    throw new Error('Rule not found');
  },
  
  async deleteRule(t, ruleId) {
    const rules = await this.getRules(t);
    const filteredRules = rules.filter(r => r.id !== ruleId);
    await this.saveRules(t, filteredRules);
    return true;
  },
  
  async toggleRule(t, ruleId, isActive) {
    return await this.updateRule(t, ruleId, { is_active: isActive });
  }
};

export default {
  rules: RulesAPI
};