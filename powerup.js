// ============================================
// ./powerup.js
// ============================================

/* global TrelloPowerUp */

const POWERUP_NAME = 'your-free-smart-indicators';
const POWERUP_ID = 'your-free-smart-indicators-powerup';

const PowerUpSanitizer = {
  sanitizeHtml: function(text) {
    if (typeof text !== 'string') return String(text || '');
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#x27;')
      .replace(/\//g, '&#x2F;')
      .replace(/`/g, '&#x60;')
      .replace(/=/g, '&#x3D;');
  },
  
  sanitizeAttribute: function(text) {
    if (typeof text !== 'string') return String(text || '');
    return text.replace(/[<>"'&`=]/g, (match) => {
      const escapeMap = { '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#x27;', '&': '&amp;', '`': '&#x60;', '=': '&#x3D;' };
      return escapeMap[match];
    });
  }
};

const badgeCache = new Map();
const CACHE_DURATION = 5000;
const openCards = new Set();
const cardTrackingInterval = 5000;
let trackingIntervalId = null;

if (typeof TrelloPowerUp === 'undefined') {
  console.error('TrelloPowerUp is not available. Make sure the Trello Power-Up script is loaded.');
  if (typeof window !== 'undefined' && !window.TrelloPowerUp) {
    setTimeout(() => { window.location.reload(); }, 1000);
  }
}

try {
  TrelloPowerUp.initialize({
    'card-badges': async function(t) {
      try {
        const card = await t.card('id', 'name', 'labels', 'members', 'due', 'dueComplete', 'customFieldItems');
        badgeCache.delete(card.id);
        const badges = await getBadgesForCard(t, card);
        return badges.map(badge => ({ ...badge, refresh: 5 }));
      } catch (error) {
        return [];
      }
    },
    
    'card-detail-badges': async function(t) {
      try {
        const card = await t.card('id', 'name', 'labels', 'members', 'due', 'dueComplete', 'customFieldItems', 'checklists');
        trackCardOpen(card.id);
        badgeCache.delete(card.id);
        const badges = await getBadgesForCard(t, card);
        return badges.map(badge => ({ ...badge, refresh: 5 }));
      } catch (error) {
        return [];
      }
    },
    
    'board-buttons': function(t, options) {
      return [{
        icon: {
          dark: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij48cmVjdCB4PSIyIiB5PSIzIiB3aWR0aD0iMjAiIGhlaWdodD0iMTgiIHJ4PSIyIiBmaWxsPSIjZmZmZmZmIiBzdHJva2U9IiNjY2NjY2MiIHN0cm9rZS13aWR0aD0iMC41Ii8+PHJlY3QgeD0iNCIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEuNSIgcng9IjAuNSIgZmlsbD0iIzY2NjY2NiIgb3BhY2l0eT0iMC42Ii8+PHJlY3QgeD0iNCIgeT0iOC41IiB3aWR0aD0iOCIgaGVpZ2h0PSIxIiByeD0iMC41IiBmaWxsPSIjNjY2NjY2IiBvcGFjaXR5PSIwLjQiLz48Y2lyY2xlIGN4PSIxOCIgY3k9IjciIHI9IjIuNSIgZmlsbD0iI0ZGNDQ0NCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjAuNSIvPjx0ZXh0IHg9IjE4IiB5PSI3LjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2IiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPiE8L3RleHQ+PHJlY3QgeD0iMTUiIHk9IjExIiB3aWR0aD0iNSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzRDQUY1MCIgc3Ryb2tlPSIjZmZmZmZmIiBzdHJva2Utd2lkdGg9IjAuMyIvPjxjaXJjbGUgY3g9IjE2LjIiIGN5PSIxMiIgcj0iMC40IiBmaWxsPSJ3aGl0ZSIvPjxyZWN0IHg9IjE1IiB5PSIxNSIgd2lkdGg9IjYiIGhlaWdodD0iMi41IiByeD0iMS4yIiBmaWxsPSIjMjE5NkYzIiBzdHJva2U9IiNmZmZmZmYiIHN0cm9rZS13aWR0aD0iMC4zIi8+PGNpcmNsZSBjeD0iMTYuNSIgY3k9IjE2LjIiIHI9IjAuMyIgZmlsbD0id2hpdGUiLz48Y2lyY2xlIGN4PSIxNy44IiBjeT0iMTYuMiIgcj0iMC4zIiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjE5LjEiIGN5PSIxNi4yIiByPSIwLjMiIGZpbGw9IndoaXRlIi8+PC9zdmc+',
          light: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCIgd2lkdGg9IjE2IiBoZWlnaHQ9IjE2Ij48ZGVmcz48bGluZWFyR3JhZGllbnQgaWQ9ImNhcmRHcmFkaWVudCIgeDE9IjAlIiB5MT0iMCUiIHgyPSIxMDAlIiB5Mj0iMTAwJSI+PHN0b3Agb2Zmc2V0PSIwJSIgc3R5bGU9InN0b3AtY29sb3I6IzAwNzlCRjtzdG9wLW9wYWNpdHk6MSIgLz48c3RvcCBvZmZzZXQ9IjEwMCUiIHN0eWxlPSJzdG9wLWNvbG9yOiMwMDVBOEI7c3RvcC1vcGFjaXR5OjEiIC8+PC9saW5lYXJHcmFkaWVudD48L2RlZnM+PHJlY3QgeD0iMiIgeT0iMyIgd2lkdGg9IjIwIiBoZWlnaHQ9IjE4IiByeD0iMiIgZmlsbD0idXJsKCNjYXJkR3JhZGllbnQpIiBzdHJva2U9IiMwMDNENUMiIHN0cm9rZS13aWR0aD0iMC41Ii8+PHJlY3QgeD0iNCIgeT0iNiIgd2lkdGg9IjEyIiBoZWlnaHQ9IjEuNSIgcng9IjAuNSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuOCIvPjxyZWN0IHg9IjQiIHk9IjguNSIgd2lkdGg9IjgiIGhlaWdodD0iMSIgcng9IjAuNSIgZmlsbD0id2hpdGUiIG9wYWNpdHk9IjAuNiIvPjxjaXJjbGUgY3g9IjE4IiBjeT0iNyIgcj0iMi41IiBmaWxsPSIjRkY0NDQ0IiBzdHJva2U9IndoaXRlIiBzdHJva2Utd2lkdGg9IjAuNSIvPjx0ZXh0IHg9IjE4IiB5PSI3LjUiIGZvbnQtZmFtaWx5PSJBcmlhbCwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSI2IiBmb250LXdlaWdodD0iYm9sZCIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiPiE8L3RleHQ+PHJlY3QgeD0iMTUiIHk9IjExIiB3aWR0aD0iNSIgaGVpZ2h0PSIyIiByeD0iMSIgZmlsbD0iIzRDQUY1MCIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjMiLz48Y2lyY2xlIGN4PSIxNi4yIiBjeT0iMTIiIHI9IjAuNCIgZmlsbD0id2hpdGUiLz48cmVjdCB4PSIxNSIgeT0iMTUiIHdpZHRoPSI2IiBoZWlnaHQ9IjIuNSIgcng9IjEuMiIgZmlsbD0iIzIxOTZGMyIgc3Ryb2tlPSJ3aGl0ZSIgc3Ryb2tlLXdpZHRoPSIwLjMiLz48Y2lyY2xlIGN4PSIxNi41IiBjeT0iMTYuMiIgcj0iMC4zIiBmaWxsPSJ3aGl0ZSIvPjxjaXJjbGUgY3g9IjE3LjgiIGN5PSIxNi4yIiByPSIwLjMiIGZpbGw9IndoaXRlIi8+PGNpcmNsZSBjeD0iMTkuMSIgY3k9IjE2LjIiIHI9IjAuMyIgZmlsbD0id2hpdGUiLz48L3N2Zz4='
        },
        text: 'Your Free Smart Indicators',
        callback: function(t) {
          return t.modal({
            title: 'Your Free Smart Indicators Settings',
            url: './settings.html',
            fullscreen: false,
            height: 700
          });
        }
      }];
    },
    'on-enable': function(t) {
      return Promise.resolve();
    }
  });
} catch (error) {
  setTimeout(() => { window.location.reload(); }, 2000);
}

async function getBadgesForCard(t, card) {
  try {
    const board = await t.board('id');
    const rules = await getRulesForBoard(t, board.id);
    if (!rules || rules.length === 0) return [];
    
    const cached = getCachedBadges(card.id);
    const cacheAge = cached ? (Date.now() - badgeCache.get(card.id).timestamp) : Infinity;
    
    if (cached && cacheAge < 2000) {
      return cached;
    } else if (cached) {
      badgeCache.delete(card.id);
    }
    
    let cardData;
    try {
      cardData = await t.card('all');
    } catch (error) {
      cardData = card;
    }

    if (!cardData.list) {
      try {
        const listInfo = await t.list('id', 'name');
        cardData.list = listInfo;
      } catch (error) {}
    }
    
    if (!cardData.board || !cardData.board.name) {
      try {
        const boardInfo = await t.board('id', 'name');
        if (!cardData.board) cardData.board = boardInfo;
        else cardData.board.name = boardInfo.name;
        cardData.boardName = boardInfo.name;
      } catch (error) {}
    }
    
    const badges = [];
    for (const rule of rules) {
      if (!rule.is_active) continue;
      if (evaluateRule(rule, cardData)) {
        badges.push(createBadge(rule.badge_config, card.id, rule.rule_name));
      }
    }
    
    setCachedBadges(card.id, badges);
    return badges;
  } catch (error) {
    return [];
  }
}

function evaluateRule(rule, card) {
  try {
    if (!rule.conditions) return false;
    if (rule.conditions.type === 'individual_logic') {
      return evaluateIndividualLogicConditions(rule.conditions, card);
    }
    return evaluateLegacyConditions(rule.conditions, card);
  } catch (error) {
    return false;
  }
}

function evaluateIndividualLogicConditions(conditionsObj, card) {
  const { conditions } = conditionsObj;
  if (!conditions || conditions.length === 0) return false;
  
  let result = null;
  for (let i = 0; i < conditions.length; i++) {
    const conditionResult = evaluateSingleCondition(conditions[i], card);
    if (i === 0) result = conditionResult;
    else result = result && conditionResult;
  }
  return result;
}

function evaluateSingleCondition(condition, card) {
  const { field, operator, value } = condition;
  if (!field || !operator) return false;
  
  if (field === 'name') return evaluateTextCondition(card.name || '', operator, value);
  if (field === 'description') return evaluateTextCondition(card.desc || card.description || '', operator, value);
  if (field === 'labels') return evaluateLabelsCondition(card.labels || [], operator, value);
  if (field === 'members') return evaluateMembersCondition(card.members || [], operator, value);
  if (field === 'due') return evaluateDueDateConditionNew(card.due, card.dueComplete, operator, value);
  if (field === 'dueComplete') return evaluateBooleanCondition(card.dueComplete, operator, value);
  if (field === 'list') return evaluateListCondition(card.list, operator, value);
  if (field === 'attachments') return evaluateNumberCondition(card.attachments ? card.attachments.length : 0, operator, value);
  if (field === 'checklists') return evaluateNumberCondition(card.checklists ? card.checklists.length : 0, operator, value);
  if (field === 'comments') return evaluateNumberCondition(card.badges?.comments || 0, operator, value);
  if (field === 'dateLastActivity') return evaluateDateCondition(card.dateLastActivity, operator, value);
  if (field === 'board') return evaluateTextCondition(card.board?.name || card.boardName || (typeof card.board === 'string' ? card.board : ''), operator, value);
  if (field.startsWith('custom_')) return evaluateCustomFieldConditionNew(field, card.customFieldItems || [], operator, value);
  
  return false;
}

function evaluateTextCondition(fieldValue, operator, value) {
  const text = (fieldValue || '').toLowerCase();
  const searchValue = (value || '').toLowerCase();
  switch (operator) {
    case 'equals': return text === searchValue;
    case 'not_equals': return text !== searchValue;
    case 'contains': return text.includes(searchValue);
    case 'not_contains': return !text.includes(searchValue);
    case 'starts_with': return text.startsWith(searchValue);
    case 'ends_with': return text.endsWith(searchValue);
    case 'is_empty': return text === '';
    case 'is_not_empty': return text !== '';
    default: return false;
  }
}

function evaluateLabelsCondition(labels, operator, value) {
  switch (operator) {
    case 'contains': case 'has': case 'has_label':
      return labels.some(label => label.name === value || label.id === value || label.color === value);
    case 'not_contains': case 'not_has': case 'does_not_have': case 'does_not_have_label':
      return !labels.some(label => label.name === value || label.id === value || label.color === value);
    case 'is_empty': case 'has_no_labels': return labels.length === 0;
    case 'is_not_empty': case 'has_any_label': return labels.length > 0;
    default: return false;
  }
}

function evaluateMembersCondition(members, operator, value) {
  const memberArray = Array.isArray(members) ? members : [];
  switch (operator) {
    case 'contains': case 'has': case 'has_member':
      return memberArray.some(m => m && (m.id === value || m.username === value || m.fullName === value || m.initials === value));
    case 'not_contains': case 'not_has': case 'does_not_have': case 'does_not_have_member':
      return !memberArray.some(m => m && (m.id === value || m.username === value || m.fullName === value || m.initials === value));
    case 'is_empty': case 'has_no_members': return memberArray.length === 0;
    case 'is_not_empty': case 'has_any_member': return memberArray.length > 0;
    default: return false;
  }
}

function evaluateBooleanCondition(fieldValue, operator, value) {
  const boolValue = fieldValue === true || fieldValue === 'true';
  switch (operator) {
    case 'is_true': return (value === false || value === 'false' || value === 'No') ? boolValue === false : boolValue === true;
    case 'is_false': return boolValue === false;
    case 'equals': return boolValue === (value === true || value === 'true' || value === '1');
    case 'not_equals': return boolValue !== (value === true || value === 'true' || value === '1');
    default: return false;
  }
}

function evaluateListCondition(list, operator, value) {
  const listId = list ? list.id : null;
  const listName = list ? list.name : null;
  switch (operator) {
    case 'equals': return listId === value || listName === value;
    case 'not_equals': return listId !== value && listName !== value;
    default: return false;
  }
}

function evaluateDateCondition(dateValue, operator, value) {
  if (!dateValue && operator !== 'is_empty') return false;
  
  switch (operator) {
    case 'is_empty': return !dateValue;
    case 'is_not_empty': return !!dateValue;
    case 'equals':
      if (!dateValue) return false;
      let compareDate1 = new Date(typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/) ? 
        new Date(value.split('-')[0], value.split('-')[1] - 1, value.split('-')[2]) : value);
      return new Date(dateValue).toDateString() === compareDate1.toDateString();
    case 'is_before': case 'before':
      if (!dateValue) return false;
      const cardDateOnly1 = new Date(new Date(dateValue).setHours(0,0,0,0));
      const compDate1 = new Date(typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/) ? 
        new Date(value.split('-')[0], value.split('-')[1] - 1, value.split('-')[2]).setHours(0,0,0,0) : new Date(value).setHours(0,0,0,0));
      return cardDateOnly1 < compDate1;
    case 'is_after': case 'after':
      if (!dateValue) return false;
      const cardDateOnly2 = new Date(new Date(dateValue).setHours(0,0,0,0));
      const compDate2 = new Date(typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}$/) ? 
        new Date(value.split('-')[0], value.split('-')[1] - 1, value.split('-')[2]).setHours(0,0,0,0) : new Date(value).setHours(0,0,0,0));
      return cardDateOnly2 > compDate2;
    case 'is_between':
      if (!dateValue || !value || typeof value !== 'object') return false;
      const d = new Date(dateValue);
      let s = typeof value.start === 'string' && value.start.match(/^\d{4}-\d{2}-\d{2}$/) ? 
        new Date(value.start.split('-')[0], value.start.split('-')[1] - 1, value.start.split('-')[2]) : new Date(value.start);
      let e = typeof value.end === 'string' && value.end.match(/^\d{4}-\d{2}-\d{2}$/) ? 
        new Date(value.end.split('-')[0], value.end.split('-')[1] - 1, value.end.split('-')[2]) : new Date(value.end);
      e.setHours(23, 59, 59, 999);
      return d >= s && d <= e;
    case 'is_today':
      return dateValue ? new Date().toDateString() === new Date(dateValue).toDateString() : false;
    default: return false;
  }
}

function evaluateDueDateConditionNew(dueDate, dueComplete, operator, value) {
  if (!dueDate && operator !== 'is_empty') return false;
  if (operator === 'is_due_soon') {
    if (!dueDate || dueComplete) return false;
    return Math.floor((new Date(dueDate) - new Date()) / 86400000) <= parseInt(value || 1);
  }
  return evaluateDateCondition(dueDate, operator, value);
}

function evaluateCustomFieldConditionNew(fieldId, customFieldItems, operator, value) {
  let actualFieldItem;
  try {
    const fieldItems = Array.isArray(customFieldItems) ? customFieldItems : [];
    actualFieldItem = fieldItems.find(item => item && item.idCustomField === fieldId);
    if (!actualFieldItem && fieldId.startsWith('custom_')) {
      actualFieldItem = fieldItems.find(item => item && item.idCustomField === fieldId.replace('custom_', ''));
    }
    if (!actualFieldItem) return operator === 'is_empty';
  } catch (error) { return false; }

  let fieldValue = actualFieldItem.value;
  if (fieldValue === undefined && actualFieldItem.idValue) fieldValue = actualFieldItem.idValue;
  
  if (fieldValue && typeof fieldValue === 'object') {
    if (fieldValue.option) { if (operator === 'equals') return fieldValue.option === value; }
    else if (fieldValue.text !== undefined) {
      if (operator === 'equals') return fieldValue.text === value;
      if (operator === 'contains') return fieldValue.text.toLowerCase().includes(value.toLowerCase());
    }
    else if (fieldValue.number !== undefined) {
      const fieldNum = parseFloat(fieldValue.number), compareNum = parseFloat(value);
      if (operator === 'equals') return fieldNum === compareNum;
      if (operator === 'greater_than') return fieldNum > compareNum;
      if (operator === 'less_than') return fieldNum < compareNum;
    }
    else if (fieldValue.checked !== undefined) {
      if (operator === 'equals') return fieldValue.checked === value;
      if (operator === 'is_true') return fieldValue.checked === 'true';
      if (operator === 'is_false') return fieldValue.checked === 'false';
    }
    else if (fieldValue.date !== undefined) return evaluateDateCondition(fieldValue.date, operator, value);
  } else if (typeof fieldValue === 'string') {
    if (fieldValue.match(/^\d{4}-\d{2}-\d{2}/) || fieldValue.match(/^\d{2}\/\d{2}\/\d{4}/)) {
      return evaluateDateCondition(fieldValue, operator, value);
    }
    if (operator === 'equals') return fieldValue === value;
    if (operator === 'contains') return fieldValue.toLowerCase().includes(value.toLowerCase());
  }
  
  if (['is_after', 'after', 'is_before', 'before', 'equals'].includes(operator)) {
    if (fieldValue && (typeof fieldValue === 'string' || fieldValue instanceof Date)) {
      return evaluateDateCondition(fieldValue, operator, value);
    }
  }
  
  if (operator === 'equals') return fieldValue === value;
  if (operator === 'contains') return fieldValue && fieldValue.toString().toLowerCase().includes(value.toLowerCase());
  return false;
}

function evaluateNumberCondition(fieldValue, operator, value) {
  const numValue = parseFloat(fieldValue), compareValue = parseFloat(value);
  if (isNaN(numValue) || isNaN(compareValue)) return operator === 'is_empty';
  
  switch (operator) {
    case 'equals': return numValue === compareValue;
    case 'not_equals': return numValue !== compareValue;
    case 'greater_than': return numValue > compareValue;
    case 'less_than': return numValue < compareValue;
    case 'greater_than_or_equal': return numValue >= compareValue;
    case 'less_than_or_equal': return numValue <= compareValue;
    case 'between': return typeof value === 'object' && !isNaN(parseFloat(value.min)) && !isNaN(parseFloat(value.max)) && numValue >= parseFloat(value.min) && numValue <= parseFloat(value.max);
    case 'is_empty': return isNaN(numValue);
    case 'is_not_empty': return !isNaN(numValue);
    default: return false;
  }
}

function evaluateLabelCondition(conditions, labels) {
  switch (conditions.operator) {
    case 'equals': return labels.some(l => l.name === conditions.value);
    case 'contains': return labels.some(l => l.name.toLowerCase().includes(conditions.value.toLowerCase()));
    case 'exists': return labels.length > 0;
    default: return false;
  }
}

function evaluateMemberCondition(conditions, members) {
  switch (conditions.operator) {
    case 'equals': return members.includes(conditions.value);
    case 'exists': return members.length > 0;
    default: return false;
  }
}

function evaluateCustomFieldCondition(conditions, customFields) {
  const fieldItem = customFields.find(item => item.idCustomField === conditions.field);
  if (!fieldItem) return false;
  switch (conditions.operator) {
    case 'equals': return fieldItem.value === conditions.value;
    case 'contains': return fieldItem.value && fieldItem.value.toLowerCase().includes(conditions.value.toLowerCase());
    case 'exists': return fieldItem.value !== null && fieldItem.value !== undefined;
    default: return false;
  }
}

function evaluateDueDateCondition(conditions, dueDate, dueComplete) {
  if (!dueDate || dueComplete) return false;
  const daysUntilDue = Math.floor((new Date(dueDate) - new Date()) / 86400000);
  switch (conditions.operator) {
    case 'less_than': return daysUntilDue < parseInt(conditions.value);
    case 'greater_than': return daysUntilDue > parseInt(conditions.value);
    case 'exists': return true;
    default: return false;
  }
}

function evaluateChecklistCondition(conditions, checklists) {
  if (!checklists || checklists.length === 0) return false;
  let totalItems = 0, completedItems = 0;
  checklists.forEach(c => { if (c.checkItems) { totalItems += c.checkItems.length; completedItems += c.checkItems.filter(i => i.state === 'complete').length; } });
  if (totalItems === 0) return false;
  const p = (completedItems / totalItems) * 100;
  switch (conditions.operator) {
    case 'greater_than': return p > parseInt(conditions.value);
    case 'less_than': return p < parseInt(conditions.value);
    case 'equals': return Math.round(p) === parseInt(conditions.value);
    default: return false;
  }
}

function createBadge(badgeConfig, cardId, ruleId) {
  const { type, content, color } = badgeConfig;
  const colorMap = {
    '#0079bf': 'blue', '#0079BF': 'blue', '#61bd4f': 'green', '#61BD4F': 'green', 
    '#f2d600': 'yellow', '#F2D600': 'yellow', '#eb5a46': 'red', '#EB5A46': 'red', 
    '#c377e0': 'purple', '#C377E0': 'purple', '#ff9f1a': 'orange', '#FF9F1A': 'orange', 
    '#ff78cb': 'pink', '#FF78CB': 'pink', '#344563': 'black', '#ff0000': 'red', 
    '#00cc00': 'green', '#3498db': 'blue'
  };
  
  let trelloColor = colorMap[color?.toLowerCase()] || color || 'blue';
  
  const badge = {
    text: type === 'text' ? PowerUpSanitizer.sanitizeHtml(content) : (type === 'emoji' ? PowerUpSanitizer.sanitizeHtml(content) : ''),
    color: trelloColor,
    callback: function(t) {
      return t.popup({ items: [{ text: `Rule: ${PowerUpSanitizer.sanitizeHtml(ruleId)}`, callback: t => t.closePopup() }] });
    }
  };
  
  if (type === 'icon') {
    const knownSvgIcons = ['check', 'priority-high', 'star'];
    const sanitizedContent = content.replace(/[^a-zA-Z0-9_-]/g, '');
    const isSvgFile = knownSvgIcons.includes(sanitizedContent) || (typeof sanitizedContent === 'string' && sanitizedContent.match(/^[a-zA-Z0-9_-]+$/));
    if (isSvgFile && !content.match(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u)) {
      badge.icon = `./${PowerUpSanitizer.sanitizeAttribute(sanitizedContent)}.svg`;
      badge.text = null;
    } else {
      badge.text = PowerUpSanitizer.sanitizeHtml(content);
    }
  }
  return badge;
}

function getCachedBadges(cardId) {
  const cached = badgeCache.get(cardId);
  if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) return cached.badges;
  return null;
}

function setCachedBadges(cardId, badges) { badgeCache.set(cardId, { badges, timestamp: Date.now() }); }
function clearBadgeCache() { badgeCache.clear(); }
window.clearBadgeCache = clearBadgeCache;

function evaluateLegacyConditions(conditions, card) {
  if (!conditions.type) return false;
  switch (conditions.type) {
    case 'label': return evaluateLabelCondition(conditions, card.labels || []);
    case 'member': return evaluateMemberCondition(conditions, card.members || []);
    case 'custom_field': return evaluateCustomFieldCondition(conditions, card.customFieldItems || []);
    case 'due_date': return evaluateDueDateCondition(conditions, card.due, card.dueComplete);
    case 'checklist': return evaluateChecklistCondition(conditions, card.checklists || []);
    default: return false;
  }
}

async function getRulesForBoard(t, boardId) {
  try { return await t.get('board', 'shared', 'your_free_smart_indicator_rules') || []; } 
  catch (e) { return []; }
}

async function handleInitialLoad(t) {
  try { clearBadgeCache(); await refreshAllBadges(t); } catch (e) {}
}

async function handleCardOpen(t) {
  try { const card = await t.card('id'); badgeCache.delete(card.id); await refreshCardBadges(t, card.id); } catch (e) {}
}

async function triggerPowerUpAPIRefresh(t, cardId) {
  try {
    badgeCache.delete(cardId);
    clearBadgeCache();
    return true;
  } catch (e) { return false; }
}

function triggerGeneralBoardRefresh() {
  try { return true; } catch (e) { return false; }
}

async function handleCardClose(t, cardId) {
  try {
    if (cardId) badgeCache.delete(cardId);
    clearBadgeCache();
  } catch (e) {}
}

async function refreshAllBadges(t) {
  try {
    clearBadgeCache();
    const lists = await t.lists('all');
    for (const list of lists) {
      if (list.cards) for (const card of list.cards) { badgeCache.delete(card.id); await refreshCardBadges(t, card.id); }
    }
  } catch (e) { clearBadgeCache(); }
}

async function refreshCardBadges(t, cardId) {
  try { badgeCache.delete(cardId); return await getBadgesForCard(t, await t.card('all')); } 
  catch (e) { return []; }
}

async function forceBadgeRefresh(t) {
  try { clearBadgeCache(); await refreshAllBadges(t); return true; } 
  catch (e) { return false; }
}

function trackCardOpen(cardId) { openCards.add(cardId); badgeCache.delete(cardId); setTimeout(() => forceListUIUpdate(cardId), 100); if (!trackingIntervalId) startCardTracking(); }
function trackCardClose(cardId) { openCards.delete(cardId); badgeCache.delete(cardId); setTimeout(() => clearBadgeCache(), 100); if (openCards.size === 0 && trackingIntervalId) stopCardTracking(); }
function startCardTracking() { trackingIntervalId = setInterval(checkForClosedCards, cardTrackingInterval); }
function stopCardTracking() { if (trackingIntervalId) { clearInterval(trackingIntervalId); trackingIntervalId = null; } }
function checkForClosedCards() {
  if (openCards.size === 0) return;
  const cardsToRemove = [];
  openCards.forEach(cardId => { if (!document.querySelector('.card-detail-window')) cardsToRemove.push(cardId); });
  cardsToRemove.forEach(cardId => trackCardClose(cardId));
}

function initializeCardTracking() {
  if (typeof MutationObserver !== 'undefined') {
    new MutationObserver(mutations => {
      mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
          const detail = document.querySelector('.card-detail-window');
          if (detail && !mutation.target.closest('.card-detail-window')) {
            const id = detail.getAttribute('data-card-id') || (window.location.href.match(/\/c\/([a-zA-Z0-9]+)/) || [])[1];
            if (id && !openCards.has(id)) trackCardOpen(id);
          } else if (!detail && openCards.size > 0) {
            Array.from(openCards).forEach(id => trackCardClose(id));
          }
        }
      });
    }).observe(document.body, { childList: true, subtree: true });
  }
}

function forceListUIUpdate(cardId) {}
function forceAllCardsUIUpdate() {}
function forceBadgeRefreshWithUI(cardId = null) {}

let listRefreshInterval = null;
function startPeriodicListRefresh() {
  if (listRefreshInterval) return;
  listRefreshInterval = setInterval(() => {
    let stale = false;
    badgeCache.forEach((cache, id) => { if (Date.now() - cache.timestamp > 30000) { stale = true; badgeCache.delete(id); } });
  }, 15000);
}
function stopPeriodicListRefresh() { if (listRefreshInterval) clearInterval(listRefreshInterval); }

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => { initializeCardTracking(); startPeriodicListRefresh(); });
} else {
  initializeCardTracking(); startPeriodicListRefresh();
}

window.refreshAllBadges = refreshAllBadges;
window.refreshCardBadges = refreshCardBadges;
window.forceBadgeRefresh = forceBadgeRefresh;
window.forceBadgeRefreshWithUI = forceBadgeRefreshWithUI;
window.forceListUIUpdate = forceListUIUpdate;
window.forceAllCardsUIUpdate = forceAllCardsUIUpdate;
window.handleCardClose = handleCardClose;
window.trackCardOpen = trackCardOpen;
window.trackCardClose = trackCardClose;
window.initializeCardTracking = initializeCardTracking;
window.startPeriodicListRefresh = startPeriodicListRefresh;
window.stopPeriodicListRefresh = stopPeriodicListRefresh;
window.triggerGeneralBoardRefresh = triggerGeneralBoardRefresh;
window.triggerPowerUpAPIRefresh = triggerPowerUpAPIRefresh;