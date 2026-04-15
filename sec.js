// ============================================
// ./sec.js
// ============================================

// HTML XSS Sanitization and Protection Utilities

/**
 * HTML entity encoding to prevent XSS attacks
 * @param {string} text - Text to escape
 * @returns {string} - HTML-escaped text
 */
export function escapeHtml(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/**
 * More comprehensive HTML escaping for attributes and content
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for HTML
 */
export function sanitizeHtml(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;')
    .replace(/`/g, '&#x60;')
    .replace(/=/g, '&#x3D;');
}

/**
 * Sanitize text for use in HTML attributes
 * @param {string} text - Text to sanitize
 * @returns {string} - Attribute-safe text
 */
export function sanitizeAttribute(text) {
  if (typeof text !== 'string') {
    return String(text || '');
  }
  
  return text
    .replace(/[<>"'&`=]/g, (match) => {
      const escapeMap = {
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#x27;',
        '&': '&amp;',
        '`': '&#x60;',
        '=': '&#x3D;'
      };
      return escapeMap[match];
    });
}

/**
 * Sanitize user input for rule names, badge content, etc.
 * @param {string} input - User input to sanitize
 * @param {Object} options - Sanitization options
 * @returns {string} - Sanitized input
 */
export function sanitizeUserInput(input, options = {}) {
  if (typeof input !== 'string') {
    return String(input || '');
  }
  
  let sanitized = input.trim();
  
  // Remove potentially dangerous characters
  if (options.strict) {
    sanitized = sanitized.replace(/[<>\"'&`=]/g, '');
  }
  
  // Limit length if specified
  if (options.maxLength) {
    sanitized = sanitized.substring(0, options.maxLength);
  }
  
  // Remove script-like patterns
  sanitized = sanitized.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
  sanitized = sanitized.replace(/javascript:/gi, '');
  sanitized = sanitized.replace(/on\w+\s*=/gi, '');
  
  return sanitized;
}

/**
 * Create a safe text node instead of using innerHTML
 * @param {HTMLElement} element - Target element
 * @param {string} text - Text content to set
 */
export function setSafeTextContent(element, text) {
  if (!element || typeof element.textContent === 'undefined') {
    return;
  }
  
  element.textContent = String(text || '');
}

/**
 * Create safe HTML content using DOM manipulation instead of innerHTML
 * @param {HTMLElement} container - Container element
 * @param {Object} config - Configuration for safe HTML creation
 */
export function createSafeHtml(container, config) {
  if (!container) return;
  
  // Clear container safely
  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }
  
  if (config.tag) {
    const element = document.createElement(config.tag);
    
    // Set safe text content
    if (config.text) {
      setSafeTextContent(element, config.text);
    }
    
    // Set safe attributes
    if (config.attributes) {
      Object.entries(config.attributes).forEach(([key, value]) => {
        if (key && value !== null && value !== undefined) {
          element.setAttribute(key, sanitizeAttribute(String(value)));
        }
      });
    }
    
    // Set safe CSS classes
    if (config.className) {
      element.className = sanitizeAttribute(config.className);
    }
    
    // Add children recursively
    if (config.children && Array.isArray(config.children)) {
      config.children.forEach(childConfig => {
        createSafeHtml(element, childConfig);
      });
    }
    
    container.appendChild(element);
  }
}

/**
 * Validate and sanitize rule names
 * @param {string} ruleName - Rule name to validate
 * @returns {Object} - Validation result
 */
export function validateRuleName(ruleName) {
  if (!ruleName || typeof ruleName !== 'string') {
    return { isValid: false, error: 'Rule name is required', sanitized: '' };
  }
  
  const sanitized = sanitizeUserInput(ruleName, { maxLength: 100 });
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Rule name cannot be empty after sanitization', sanitized };
  }
  
  if (sanitized.length < 2) {
    return { isValid: false, error: 'Rule name must be at least 2 characters long', sanitized };
  }
  
  return { isValid: true, error: null, sanitized };
}

/**
 * Validate and sanitize badge content
 * @param {string} content - Badge content to validate
 * @param {string} type - Badge type (text, emoji, icon)
 * @returns {Object} - Validation result
 */
export function validateBadgeContent(content, type = 'text') {
  if (!content || typeof content !== 'string') {
    return { isValid: false, error: 'Badge content is required', sanitized: '' };
  }
  
  let sanitized = content.trim();
  
  if (type === 'text') {
    sanitized = sanitizeUserInput(sanitized, { maxLength: 50 });
  } else if (type === 'emoji') {
    // Allow emoji characters but sanitize everything else
    sanitized = sanitizeUserInput(sanitized, { maxLength: 10 });
  } else if (type === 'icon') {
    // For icons, check if it's an emoji or SVG file name
    const isEmoji = /[\u{1F000}-\u{1FFFF}]|[\u{2600}-\u{27BF}]/u.test(sanitized);
    const knownSvgIcons = ['check', 'priority-high', 'star'];
    const isKnownSvg = knownSvgIcons.includes(sanitized);
    
    if (isEmoji) {
      // Keep emoji as-is for icon badges
      sanitized = sanitized;
    } else if (isKnownSvg || /^[a-zA-Z0-9_-]+$/.test(sanitized)) {
      // For SVG file names, only allow alphanumeric and safe characters
      sanitized = sanitized.replace(/[^a-zA-Z0-9_-]/g, '');
    } else {
      // For other content, treat as text and sanitize
      sanitized = sanitizeUserInput(sanitized, { maxLength: 10 });
    }
  }
  
  if (sanitized.length === 0) {
    return { isValid: false, error: 'Badge content cannot be empty after sanitization', sanitized };
  }
  
  return { isValid: true, error: null, sanitized };
}

/**
 * Validate and sanitize condition values
 * @param {string} value - Condition value to validate
 * @param {string} fieldType - Type of field (text, number, date, etc.)
 * @returns {Object} - Validation result
 */
export function validateConditionValue(value, fieldType = 'text') {
  if (value === null || value === undefined) {
    return { isValid: false, error: 'Condition value is required', sanitized: '' };
  }
  
  const stringValue = String(value).trim();
  let sanitized = stringValue;
  
  switch (fieldType) {
    case 'text':
      sanitized = sanitizeUserInput(stringValue, { maxLength: 200 });
      break;
    case 'number':
      sanitized = stringValue.replace(/[^0-9.-]/g, '');
      if (!/^-?\d*\.?\d*$/.test(sanitized)) {
        return { isValid: false, error: 'Invalid number format', sanitized };
      }
      break;
    case 'date':
      // Basic date validation
      if (!/^\d{4}-\d{2}-\d{2}$/.test(stringValue)) {
        return { isValid: false, error: 'Invalid date format (YYYY-MM-DD)', sanitized: stringValue };
      }
      sanitized = stringValue;
      break;
    default:
      sanitized = sanitizeUserInput(stringValue, { maxLength: 200 });
  }
  
  return { isValid: true, error: null, sanitized };
}

export default {
  escapeHtml,
  sanitizeHtml,
  sanitizeAttribute,
  sanitizeUserInput,
  setSafeTextContent,
  createSafeHtml,
  validateRuleName,
  validateBadgeContent,
  validateConditionValue
};