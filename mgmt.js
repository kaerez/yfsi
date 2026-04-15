// ============================================
// ./mgmt.js
// ============================================

// Management

// Standard Trello fields with their types
export const STANDARD_FIELDS = {
  'name': { label: 'Card Name', type: 'text' },
  'description': { label: 'Description', type: 'text' },
  'labels': { label: 'Labels', type: 'labels' },
  'members': { label: 'Members', type: 'members' },
  'due': { label: 'Due Date', type: 'date' },
  'dueComplete': { label: 'Complete', type: 'boolean' },
  'attachments': { label: 'Attachments', type: 'number' },
  'checklists': { label: 'Checklists', type: 'number' },
  'comments': { label: 'Comments', type: 'number' },
  'list': { label: 'List', type: 'list' },
  'board': { label: 'Board', type: 'text' },
  'dateLastActivity': { label: 'Last Activity', type: 'date' }
};

// Operators for each field type
export const FIELD_OPERATORS = {
  text: [
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' },
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'starts_with', label: 'Starts with' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  date: [
    { value: 'is_after', label: 'Is after' },
    { value: 'is_before', label: 'Is before' },
    { value: 'is_between', label: 'Is between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' },
    { value: 'is_today', label: 'Is today' }
  ],
  boolean: [
    { value: 'is_true', label: 'Is' },
    { value: 'is_false', label: 'Is not' }
  ],
  labels: [
    { value: 'has', label: 'Has label' },
    { value: 'not_has', label: 'Does not have label' },
    { value: 'has_no_labels', label: 'Has no labels' },
    { value: 'has_any_label', label: 'Has any label' }
  ],
  members: [
    { value: 'has', label: 'Has member' },
    { value: 'not_has', label: 'Does not have member' },
    { value: 'has_no_members', label: 'Has no members' },
    { value: 'has_any_member', label: 'Has any member' }
  ],
  number: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' },
    { value: 'greater_than', label: 'Greater than' },
    { value: 'less_than', label: 'Less than' },
    { value: 'between', label: 'Between' },
    { value: 'is_empty', label: 'Is empty' },
    { value: 'is_not_empty', label: 'Is not empty' }
  ],
  list: [
    { value: 'equals', label: 'Is in list' },
    { value: 'not_equals', label: 'Is not in list' }
  ],
  custom_list: [
    { value: 'equals', label: 'Equals' },
    { value: 'not_equals', label: 'Does not equal' }
  ]
};

// Get available fields (standard + custom fields from board)
export async function getAvailableFields(t) {
  const fields = { ...STANDARD_FIELDS };
  
  try {
    // Get custom fields from the board
    const board = await t.board('customFields');
    
    if (board.customFields && board.customFields.length > 0) {
      board.customFields.forEach(field => {
        let fieldType = 'text';
        
        // Map Trello custom field types to our types
        switch (field.type) {
          case 'text':
            fieldType = 'text';
            break;
          case 'number':
            fieldType = 'number';
            break;
          case 'date':
            fieldType = 'date';
            break;
          case 'checkbox':
            fieldType = 'boolean';
            break;
          case 'list':
            fieldType = 'custom_list';
            break;
          default:
            fieldType = 'text';
        }
        
        fields[`custom_${field.id}`] = {
          label: field.name || 'Unnamed Custom Field',
          type: fieldType,
          isCustom: true,
          customField: field
        };
      });
    }
  } catch (error) {

  }
  
  return fields;
}

// Get operators for a specific field
export function getOperatorsForField(fieldKey, fields) {
  const field = fields[fieldKey];
  
  if (!field) {

    return [];
  }
  
  const operators = FIELD_OPERATORS[field.type] || FIELD_OPERATORS.text;
  
  return operators;
}

// Check if operator requires a value input
export function operatorRequiresValue(operator) {
  const noValueOperators = [
    'is_empty', 'is_not_empty', 'has_no_labels', 'has_any_label',
    'has_no_members', 'has_any_member', 'is_today'
  ];
  
  return !noValueOperators.includes(operator);
}

// Get value input type for field and operator
export function getValueInputType(fieldKey, operator, fields) {
  const field = fields[fieldKey];
  if (!field) return 'text';
  
  if (!operatorRequiresValue(operator)) {
    return 'none';
  }
  
  switch (field.type) {
    case 'date':
      if (operator === 'is_between') {
        return 'date-range';
      }
      return 'date';
    case 'number':
      if (operator === 'between') {
        return 'number-range';
      }
      return 'number';
    case 'boolean':
      return 'boolean-select';
    case 'labels':
      return 'label-select';
    case 'members':
      return 'member-select';
    case 'list':
      return 'list-select';
    case 'custom_list':
      return 'custom-list-select';
    default:
      return 'text';
  }
}

// Get available options for select-type inputs
export async function getSelectOptions(fieldKey, fields, t) {
  const field = fields[fieldKey];
  if (!field) return [];
  
  try {
    switch (field.type) {
      case 'boolean':
        return [
          { value: 'true', label: 'Yes' },
          { value: 'false', label: 'No' }
        ];
        
      case 'labels':
        const board = await t.board('labels');
        return board.labels.map(label => ({
          value: label.id,
          label: label.name || `${label.color} label`,
          color: label.color
        }));
        
      case 'members':
        try {
          const boardMembers = await t.board('members');
          // Handle different possible structures
          const members = boardMembers.members || boardMembers || [];
          return members.map(member => ({
            value: member.id,
            label: member.fullName || member.username || member.initials || 'Unknown Member'
          }));
        } catch (error) {
          console.error('Error getting board members:', error);
          return [];
        }
        
      case 'list':
        try {
          // Try multiple methods to get lists
          
          // Method 1: Try t.lists() directly
          try {
            const lists = await t.lists('id', 'name');
            if (lists && lists.length > 0) {
              return lists.map(list => ({
                value: list.id,
                label: list.name
              }));
            }
          } catch (listError) {

          }
          
          // Method 2: Try board data
          try {
            const boardData = await t.board('lists');
            if (boardData && boardData.lists && boardData.lists.length > 0) {
              return boardData.lists.map(list => ({
                value: list.id,
                label: list.name
              }));
            }
          } catch (boardError) {

          }
          
          // Method 3: Try getting board info and then lists
          try {
            const board = await t.board('id');
            // This might not work in Power-Up context, but worth trying
            const allLists = await t.lists('all');
            if (allLists && allLists.length > 0) {
              return allLists.map(list => ({
                value: list.id,
                label: list.name
              }));
            }
          } catch (allListsError) {

          }
          

          return [];
        } catch (error) {
  
          return [];
        }
        
      case 'custom_list':
        if (field.customField && field.customField.options) {
          const options = field.customField.options.map(option => ({
            value: option.id,
            label: option.value.text || option.text || 'Unnamed Option'
          }));
          return options;
        }
        return [];
        
      default:
        return [];
    }
  } catch (error) {

    return [];
  }
}