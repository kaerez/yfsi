// ============================================
// ./settings.js
// ============================================

/* global TrelloPowerUp */

import { API, Sanitizer } from './index.js';
import { getAvailableFields, getOperatorsForField, operatorRequiresValue, getValueInputType, getSelectOptions } from './mgmt.js';

let t;
let currentRules = [];
let currentBoard = null;
let editingRuleId = null;
let availableFields = {};
let conditionRowCounter = 0;

document.addEventListener('DOMContentLoaded', async () => {
  try {
    t = window.TrelloPowerUp.iframe();
    currentBoard = await t.board('id', 'name');
    availableFields = await getAvailableFields(t);
    await loadRules();
    setupEventListeners();
  } catch (error) {
    showError('Failed to initialize settings');
  }
});

async function loadRules() {
  try {
    showLoading();
    currentRules = await API.rules.getRules(t);
    displayRules();
    hideLoading();
  } catch (error) {
    showError('Failed to load rules');
    hideLoading();
  }
}

function displayRules() {
  const rulesList = document.getElementById('rules-list');
  rulesList.innerHTML = '';
  
  if (currentRules.length === 0) {
    rulesList.innerHTML = `<div class="empty-state"><p>No badge rules yet. Click "Add Rule" to create your first rule.</p></div>`;
    return;
  }
  
  currentRules.forEach(rule => rulesList.appendChild(createRuleElement(rule)));
}

function createRuleElement(rule) {
  const div = document.createElement('div');
  div.className = 'rule-item';
  div.dataset.ruleId = Sanitizer.sanitizeAttribute(rule.id);
  
  const badgePreviewContainer = document.createElement('div');
  badgePreviewContainer.className = 'rule-badge-preview';
  badgePreviewContainer.innerHTML = createBadgePreview(rule.badge_config);
  
  const ruleHeader = document.createElement('div');
  ruleHeader.className = 'rule-header';
  
  const ruleInfo = document.createElement('div');
  ruleInfo.className = 'rule-info';
  
  const ruleName = document.createElement('h3');
  Sanitizer.setSafeTextContent(ruleName, rule.rule_name);
  ruleInfo.appendChild(ruleName);
  
  ruleHeader.appendChild(ruleInfo);
  ruleHeader.appendChild(badgePreviewContainer);
  div.appendChild(ruleHeader);
  
  const ruleActions = document.createElement('div');
  ruleActions.className = 'rule-actions';
  
  const activeControl = document.createElement('div');
  activeControl.className = 'rule-active-control';
  
  const activeLabel = document.createElement('label');
  activeLabel.className = 'active-label';
  activeLabel.textContent = 'Active';
  
  const toggleLabel = document.createElement('label');
  toggleLabel.className = 'toggle';
  
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = rule.is_active;
  checkbox.setAttribute('data-rule-id', Sanitizer.sanitizeAttribute(rule.id));
  
  const toggleSlider = document.createElement('span');
  toggleSlider.className = 'toggle-slider';
  
  toggleLabel.appendChild(checkbox);
  toggleLabel.appendChild(toggleSlider);
  activeControl.appendChild(activeLabel);
  activeControl.appendChild(toggleLabel);
  
  const editButton = document.createElement('button');
  editButton.className = 'btn btn-sm';
  editButton.textContent = 'Edit';
  editButton.addEventListener('click', () => showRuleModal(rule.id));
  
  const deleteButton = document.createElement('button');
  deleteButton.className = 'btn btn-sm btn-danger';
  deleteButton.textContent = 'Delete';
  deleteButton.addEventListener('click', () => deleteRule(rule.id));
  
  ruleActions.appendChild(activeControl);
  ruleActions.appendChild(editButton);
  ruleActions.appendChild(deleteButton);
  
  div.appendChild(ruleActions);
  checkbox.addEventListener('change', async (e) => await toggleRule(rule.id, e.target.checked));
  
  return div;
}

function createBadgePreview(badgeConfig) {
  const { type, content, color } = badgeConfig;
  const safeColor = Sanitizer.sanitizeAttribute(color);
  
  if (type === 'text' || type === 'emoji') {
    const span = document.createElement('span');
    span.className = 'badge-preview';
    span.style.backgroundColor = safeColor;
    Sanitizer.setSafeTextContent(span, content);
    return span.outerHTML;
  } else if (type === 'icon') {
    const knownSvgIcons = ['check', 'priority-high', 'star'];
    const sanitizedContent = content.replace(/[^a-zA-Z0-9_-]/g, '');
    const isSvgFile = knownSvgIcons.includes(sanitizedContent) || (typeof sanitizedContent === 'string' && sanitizedContent.match(/^[a-zA-Z0-9_-]+$/));
    
    const span = document.createElement('span');
    span.className = 'badge-preview';
    span.style.backgroundColor = safeColor;
    
    if (isSvgFile && !content.match(/[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u)) {
      const img = document.createElement('img');
      img.src = `./${Sanitizer.sanitizeAttribute(sanitizedContent)}.svg`;
      img.alt = Sanitizer.sanitizeAttribute(sanitizedContent);
      img.onerror = function() { this.style.display = 'none'; Sanitizer.setSafeTextContent(this.parentNode, sanitizedContent); };
      span.appendChild(img);
    } else {
      Sanitizer.setSafeTextContent(span, content);
    }
    return span.outerHTML;
  }
  return '';
}

function setupEventListeners() {
  const addRuleBtn = document.getElementById('add-rule-btn');
  if (addRuleBtn) addRuleBtn.addEventListener('click', () => showRuleModal());
  
  const closeModalBtn = document.getElementById('close-modal');
  if (closeModalBtn) closeModalBtn.addEventListener('click', hideRuleModal);
  
  const cancelBtn = document.getElementById('cancel-button');
  if (cancelBtn) cancelBtn.addEventListener('click', hideRuleModal);
  
  const ruleForm = document.getElementById('rule-form');
  if (ruleForm) {
    ruleForm.addEventListener('submit', (e) => {
      const textInput = document.getElementById('badge-content');
      const emojiSelector = document.getElementById('emoji-selector');
      const iconSelector = document.getElementById('icon-selector');
      if (textInput && textInput.style.display === 'none') textInput.required = false;
      if (emojiSelector && emojiSelector.style.display === 'none') emojiSelector.required = false;
      if (iconSelector && iconSelector.style.display === 'none') iconSelector.required = false;
    });
    ruleForm.addEventListener('submit', handleRuleSubmit);
  }
  
  const addConditionBtn = document.getElementById('add-condition-btn');
  if (addConditionBtn) addConditionBtn.addEventListener('click', addConditionRow);
  
  const colorPresets = document.querySelectorAll('.color-preset');
  colorPresets.forEach(button => {
    button.addEventListener('click', (e) => {
      const color = e.target.dataset.color;
      const badgeColorSelect = document.getElementById('badge-color');
      if (badgeColorSelect) badgeColorSelect.value = color;
    });
  });
  
  document.querySelectorAll('input[name="badge-type"]').forEach(radio => radio.addEventListener('change', handleBadgeTypeChange));
}

function showRuleModal(ruleId = null) {
  editingRuleId = ruleId;
  const modal = document.getElementById('rule-modal');
  const modalTitle = document.getElementById('modal-title');
  const form = document.getElementById('rule-form');
  const conditionsContainer = document.getElementById('conditions-container');
  
  if (ruleId) {
    modalTitle.textContent = 'Edit Badge Rule';
    const rule = currentRules.find(r => r.id === ruleId);
    if (rule) populateRuleForm(rule);
  } else {
    modalTitle.textContent = 'Create Badge Rule';
    form.reset();
    conditionsContainer.innerHTML = `<div class="conditions-placeholder"><p>Click "+ Add Condition" to create your badge rule conditions</p></div>`;
    const textRadio = document.querySelector('input[name="badge-type"][value="text"]');
    if (textRadio) { textRadio.checked = true; handleBadgeTypeChange({ target: { value: 'text' } }); }
  }
  modal.style.display = 'flex';
}

function hideRuleModal() {
  document.getElementById('rule-modal').style.display = 'none';
  editingRuleId = null;
  const saveButton = document.querySelector('#rule-form button[type="submit"]');
  if (saveButton) { saveButton.disabled = false; saveButton.textContent = 'Save Rule'; saveButton.classList.remove('loading'); }
}

async function populateRuleForm(rule) {
  document.getElementById('rule-name').value = rule.rule_name;
  const conditionsContainer = document.getElementById('conditions-container');
  conditionsContainer.innerHTML = '';
  
  let conditions = [];
  if (rule.conditions) {
    if (rule.conditions.type === 'individual_logic' && rule.conditions.conditions) conditions = rule.conditions.conditions;
    else if (rule.conditions.logic && rule.conditions.conditions) conditions = rule.conditions.conditions;
    else if (Array.isArray(rule.conditions)) conditions = rule.conditions;
    else conditions = [rule.conditions];
  }
  
  for (let i = 0; i < conditions.length; i++) {
    const condition = conditions[i];
    const conditionRow = createConditionRow();
    conditionsContainer.appendChild(conditionRow);
    const fieldSelect = conditionRow.querySelector('.condition-type');
    const operatorSelect = conditionRow.querySelector('.condition-operator');
    
    fieldSelect.value = condition.field || condition.type;
    await updateOperatorOptionsNew(fieldSelect, operatorSelect, conditionRow);
    await new Promise(resolve => setTimeout(resolve, 100));
    operatorSelect.value = condition.operator;
    await updateValueInputNew(fieldSelect, operatorSelect, conditionRow);
    await new Promise(resolve => setTimeout(resolve, 100));
    
    const inputs = conditionRow.querySelector('.value-input-container').querySelectorAll('input, select');
    if (inputs.length === 1) inputs[0].value = condition.value || '';
    else if (inputs.length === 2 && typeof condition.value === 'object') { inputs[0].value = condition.value.start || ''; inputs[1].value = condition.value.end || ''; }
  }
  
  updateConditionRemoveButtons();
  
  const badgeType = rule.badge_config.type;
  document.querySelector(`input[name="badge-type"][value="${badgeType}"]`).checked = true;
  handleBadgeTypeChange({ target: { value: badgeType } });
  
  if (badgeType === 'text') document.getElementById('badge-content').value = rule.badge_config.content;
  else if (badgeType === 'emoji') document.getElementById('emoji-selector').value = rule.badge_config.content;
  else if (badgeType === 'icon') document.getElementById('icon-selector').value = rule.badge_config.content;
  
  document.getElementById('badge-color').value = rule.badge_config.color;
}

function createConditionRow() {
  const div = document.createElement('div');
  div.className = 'condition-row';
  conditionRowCounter++;
  const rowId = 'condition-row-' + conditionRowCounter;
  div.setAttribute('data-row-id', rowId);
  
  let fieldOptions = '<option value="">Select field...</option>';
  if (availableFields && Object.keys(availableFields).length > 0) {
    Object.entries(availableFields).forEach(([key, field]) => { fieldOptions += `<option value="${Sanitizer.sanitizeAttribute(key)}">${Sanitizer.sanitizeHtml(field.label)}${field.isCustom ? ' (Custom)' : ''}</option>`; });
  }
  
  div.innerHTML = `
    <select name="conditionType" class="condition-type field-selector" data-row-id="${rowId}">${fieldOptions}</select>
    <select name="conditionOperator" class="condition-operator operator-selector" data-row-id="${rowId}" style="display: block;" disabled><option value="">Select operator...</option></select>
    <div class="value-input-container" style="display: block;"><input type="text" name="conditionValue" class="condition-value value-input" placeholder="Select field first" disabled></div>
    <div class="logic-connector" style="display: none;"><span class="condition-logic-label">AND</span></div>
    <button type="button" class="remove-condition" onclick="removeCondition(this)" style="display: none;">×</button>
  `;
  
  div.querySelector('.condition-type').addEventListener('change', () => { setTimeout(() => { const currentRow = document.querySelector(`[data-row-id="${rowId}"]`); updateOperatorOptionsNew(currentRow.querySelector('.condition-type'), currentRow.querySelector('.condition-operator'), currentRow); }, 100); });
  div.querySelector('.condition-operator').addEventListener('change', () => { setTimeout(() => { const currentRow = document.querySelector(`[data-row-id="${rowId}"]`); updateValueInputNew(currentRow.querySelector('.condition-type'), currentRow.querySelector('.condition-operator'), currentRow); }, 100); });
  return div;
}

function addConditionRow() {
  const container = document.getElementById('conditions-container');
  const placeholder = container.querySelector('.conditions-placeholder');
  if (placeholder) placeholder.remove();
  container.appendChild(createConditionRow());
  updateConditionRemoveButtons();
}

function updateConditionRemoveButtons() {
  const rows = document.querySelectorAll('.condition-row');
  rows.forEach((row, index) => {
    const removeBtn = row.querySelector('.remove-condition');
    const logicConnector = row.querySelector('.logic-connector');
    if (removeBtn) removeBtn.style.display = rows.length > 1 ? 'flex' : 'none';
    if (logicConnector) logicConnector.style.display = index < rows.length - 1 ? 'block' : 'none';
  });
}

window.removeCondition = function(button) {
  const row = button.closest('.condition-row');
  const container = document.getElementById('conditions-container');
  if (row) {
    row.remove();
    if (container.children.length === 0) container.innerHTML = `<div class="conditions-placeholder"><p>Click "+ Add Condition" to create your badge rule conditions</p></div>`;
    updateConditionRemoveButtons();
  }
};

async function updateOperatorOptionsNew(fieldSelect, operatorSelect, conditionRow) {
  const fieldKey = fieldSelect.value;
  const valueContainer = conditionRow.querySelector('.value-input-container');
  
  if (!fieldKey) {
    operatorSelect.innerHTML = '<option value="">Select operator...</option>';
    operatorSelect.disabled = true;
    valueContainer.innerHTML = '<input type="text" name="conditionValue" class="condition-value value-input" placeholder="Select field first" disabled>';
    return;
  }
  
  if (!availableFields || Object.keys(availableFields).length === 0) availableFields = await getAvailableFields(t);
  const operators = getOperatorsForField(fieldKey, availableFields);
  
  if (operators.length === 0) {
    operatorSelect.innerHTML = '<option value="">No operators available</option>';
    operatorSelect.disabled = true;
    return;
  }
  
  const currentValue = operatorSelect.value;
  let operatorOptions = '<option value="">Select operator...</option>';
  operators.forEach(op => { operatorOptions += `<option value="${Sanitizer.sanitizeAttribute(op.value)}"${op.value === currentValue ? ' selected' : ''}>${Sanitizer.sanitizeHtml(op.label)}</option>`; });
  
  operatorSelect.innerHTML = operatorOptions;
  operatorSelect.disabled = false;
  
  if (!currentValue || !operators.find(op => op.value === currentValue)) {
    valueContainer.innerHTML = '<input type="text" name="conditionValue" class="condition-value value-input" placeholder="Select operator first" disabled>';
  } else { setTimeout(() => updateValueInputNew(fieldSelect, operatorSelect, conditionRow), 50); }
}

async function updateValueInputNew(fieldSelect, operatorSelect, conditionRow) {
  const fieldKey = fieldSelect.value, operator = operatorSelect.value;
  const valueContainer = conditionRow.querySelector('.value-input-container');
  
  if (!fieldKey || !operator) { valueContainer.innerHTML = '<input type="text" name="conditionValue" class="condition-value value-input" placeholder="Select operator first" disabled>'; return; }
  
  const currentInputs = valueContainer.querySelectorAll('input, select');
  const currentValue = currentInputs.length === 1 ? currentInputs[0].value : null;
  const inputType = getValueInputType(fieldKey, operator, availableFields);
  
  if (inputType === 'none') { valueContainer.innerHTML = '<span class="no-value-needed">No value needed</span>'; return; }
  
  let inputHTML = '';
  switch (inputType) {
    case 'text': inputHTML = '<input type="text" name="conditionValue" class="condition-value value-input" placeholder="Enter value" required>'; break;
    case 'number': inputHTML = '<input type="number" name="conditionValue" class="condition-value value-input" placeholder="Enter number" required>'; break;
    case 'date': inputHTML = '<input type="date" name="conditionValue" class="condition-value value-input" required>'; break;
    case 'date-range': inputHTML = `<input type="date" name="conditionValueStart" class="condition-value value-input" placeholder="Start date" required style="width: 48%; margin-right: 4%;"><input type="date" name="conditionValueEnd" class="condition-value value-input" placeholder="End date" required style="width: 48%;">`; break;
    case 'number-range': inputHTML = `<input type="number" name="conditionValueMin" class="condition-value value-input" placeholder="Min" required style="width: 48%; margin-right: 4%;"><input type="number" name="conditionValueMax" class="condition-value value-input" placeholder="Max" required style="width: 48%;">`; break;
    case 'label-select': case 'member-select': case 'list-select': case 'custom-list-select': case 'boolean-select':
      const options = await getSelectOptions(fieldKey, availableFields, t);
      let selectHTML = '<select name="conditionValue" class="condition-value value-input" required><option value="">Select...</option>';
      options.forEach(opt => selectHTML += `<option value="${Sanitizer.sanitizeAttribute(opt.value)}"${opt.value === currentValue ? ' selected' : ''}>${Sanitizer.sanitizeHtml(opt.label)}</option>`);
      inputHTML = selectHTML + '</select>';
      break;
    default: inputHTML = `<input type="text" name="conditionValue" class="condition-value value-input" placeholder="Enter value" required value="${currentValue || ''}">`;
  }
  
  valueContainer.innerHTML = inputHTML;
  if (currentValue && ['text', 'number', 'date'].includes(inputType)) {
    const newInput = valueContainer.querySelector('input');
    if (newInput && !newInput.value) newInput.value = currentValue;
  }
}

function handleBadgeTypeChange(e) {
  const badgeType = e.target.value;
  const textInput = document.getElementById('badge-content');
  const emojiSelector = document.getElementById('emoji-selector');
  const iconSelector = document.getElementById('icon-selector');
  
  textInput.style.display = 'none'; textInput.required = false;
  emojiSelector.style.display = 'none'; emojiSelector.required = false;
  iconSelector.style.display = 'none'; iconSelector.required = false;
  
  if (badgeType === 'text') { textInput.style.display = 'block'; textInput.required = true; }
  else if (badgeType === 'emoji') { emojiSelector.style.display = 'block'; emojiSelector.required = true; }
  else if (badgeType === 'icon') { iconSelector.style.display = 'block'; iconSelector.required = true; }
}

async function handleRuleSubmit(e) {
  e.preventDefault();
  try {
    const ruleNameInput = document.getElementById('rule-name').value.trim();
    const ruleNameValidation = Sanitizer.validateRuleName(ruleNameInput);
    if (!ruleNameValidation.isValid) return showError(ruleNameValidation.error);
    
    const selectedBadgeType = document.querySelector('input[name="badge-type"]:checked')?.value;
    let badgeContentValue = '';
    if (selectedBadgeType === 'text') badgeContentValue = document.getElementById('badge-content').value.trim();
    else if (selectedBadgeType === 'emoji') badgeContentValue = document.getElementById('emoji-selector').value;
    else if (selectedBadgeType === 'icon') badgeContentValue = document.getElementById('icon-selector').value;
    
    const badgeContentValidation = Sanitizer.validateBadgeContent(badgeContentValue, selectedBadgeType);
    if (!badgeContentValidation.isValid) return showError(badgeContentValidation.error);
    
    const conditionRows = document.querySelectorAll('.condition-row');
    if (conditionRows.length === 0) return showError('At least one condition is required');
    
    showLoading();
    
    const conditions = [];
    for (let i = 0; i < conditionRows.length; i++) {
      const row = conditionRows[i];
      const fieldKey = row.querySelector('.condition-type').value;
      const operator = row.querySelector('.condition-operator').value;
      if (!fieldKey || !operator) continue;
      
      let value = '';
      const inputs = row.querySelector('.value-input-container').querySelectorAll('input, select');
      if (inputs.length === 1) value = inputs[0].value;
      else if (inputs.length === 2) value = { start: inputs[0].value, end: inputs[1].value };
      
      if (operatorRequiresValue(operator) && (!value || (typeof value === 'object' && (!value.start || !value.end)))) {
        hideLoading();
        return showError(`Please fill in the value for condition ${i + 1}.`);
      }
      conditions.push({ field: fieldKey, operator, value, type: fieldKey });
    }
    
    for (let i = 0; i < conditions.length - 1; i++) conditions[i].logic = 'AND';
    
    const ruleData = {
      rule_name: ruleNameValidation.sanitized,
      conditions: { type: 'individual_logic', conditions },
      badge_config: { type: selectedBadgeType, content: badgeContentValidation.sanitized, color: Sanitizer.sanitizeAttribute(document.getElementById('badge-color').value) },
      is_active: true
    };
    
    if (editingRuleId) await API.rules.updateRule(t, editingRuleId, ruleData);
    else await API.rules.createRule(t, ruleData);
    
    await loadRules();
    if (window.clearBadgeCache) window.clearBadgeCache();
    hideRuleModal();
    hideLoading();
    showSuccess(editingRuleId ? 'Rule updated successfully' : 'Rule created successfully');
  } catch (error) {
    showError('Failed to save rule. Please try again.');
    hideLoading();
  }
}

async function toggleRule(ruleId, isActive) {
  try {
    await API.rules.toggleRule(t, ruleId, isActive);
    const rule = currentRules.find(r => r.id === ruleId);
    if (rule) rule.is_active = isActive;
    if (isActive) showSuccess('Rule activated successfully');
  } catch (error) { showError('Failed to update rule'); }
}

async function deleteRule(ruleId) {
  if (!confirm('Are you sure you want to delete this rule?')) return;
  try { showLoading(); await API.rules.deleteRule(t, ruleId); await loadRules(); hideLoading(); showSuccess('Rule deleted successfully'); }
  catch (error) { showError('Failed to delete rule'); hideLoading(); }
}

let loadingCount = 0;
function showLoading() { loadingCount++; if (loadingCount === 1) { const overlay = document.createElement('div'); overlay.id = 'loading-overlay'; overlay.className = 'loading-overlay'; overlay.innerHTML = '<div class="spinner"></div>'; document.body.appendChild(overlay); } }
function hideLoading() { loadingCount--; if (loadingCount <= 0) { loadingCount = 0; const overlay = document.getElementById('loading-overlay'); if (overlay) overlay.remove(); } }
function showError(message) { document.querySelectorAll('.error-message').forEach(error => error.remove()); const toast = document.createElement('div'); toast.className = 'error-message'; toast.textContent = message; toast.style.position = 'fixed'; toast.style.top = '20px'; toast.style.right = '20px'; toast.style.zIndex = '9999'; document.body.appendChild(toast); setTimeout(() => toast.remove(), 5000); }
function showSuccess(message) { const ex = document.querySelector('.success-message'); if (ex) ex.remove(); const toast = document.createElement('div'); toast.className = 'success-message'; toast.textContent = message; toast.style.position = 'fixed'; toast.style.top = '20px'; toast.style.right = '20px'; toast.style.zIndex = '9999'; document.body.appendChild(toast); setTimeout(() => toast.remove(), 3000); }

window.addEventListener('click', (e) => {
  const modal = document.getElementById('rule-modal');
  if (e.target === modal) hideRuleModal();
});