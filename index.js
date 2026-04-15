// ============================================
// ./index.js
// ============================================

import { RulesAPI } from './api.js';
import Sanitizer from './sec.js';

export const API = {
  rules: RulesAPI
};

export { Sanitizer };

window.SmartIndicatorsAPI = API;