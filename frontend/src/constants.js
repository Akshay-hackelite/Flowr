/* ── Node type definitions and constants ── */

export const NODE_TYPES = {
  START: 'start',
  SEND_MESSAGE: 'send_message',
  ASK_QUESTION: 'ask_question',
  CONDITION: 'condition',
};

export const NODE_COLORS = {
  start: {
    bg: 'var(--accent-purple-soft)',
    border: 'var(--accent-purple)',
    gradient: 'var(--gradient-purple)',
    icon: '⚡',
    label: 'Start Trigger',
  },
  send_message: {
    bg: 'var(--accent-green-soft)',
    border: 'var(--accent-green)',
    gradient: 'var(--gradient-green)',
    icon: '💬',
    label: 'Send Message',
  },
  ask_question: {
    bg: 'var(--accent-blue-soft)',
    border: 'var(--accent-blue)',
    gradient: 'var(--gradient-blue)',
    icon: '❓',
    label: 'Ask Question',
  },
  condition: {
    bg: 'var(--accent-amber-soft)',
    border: 'var(--accent-amber)',
    gradient: 'var(--gradient-amber)',
    icon: '🔀',
    label: 'Condition',
  },
};

export const DEFAULT_CONFIGS = {
  send_message: {
    message: '',
  },
  ask_question: {
    question: '',
    input_type: 'buttons',
    variable_name: '',
    options: [
      { id: 'opt_1', label: 'Option 1', next_node_id: '' },
      { id: 'opt_2', label: 'Option 2', next_node_id: '' },
    ],
  },
  condition: {
    conditions: [
      { variable: '', operator: 'equals', value: '', next_node_id: '' },
    ],
    default_next_node_id: '',
  },
};

// Default client/user for development
export const DEV_DEFAULTS = {
  clientId: 'client:amazon',
  userId: 'user:rahul',
  whatsappAccountId: 'wa:amazon_support',
};
