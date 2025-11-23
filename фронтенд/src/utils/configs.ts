import type { Ad } from '../types/api';

// Конфигурация статуса объявления
export const getStatusConfig = (status: Ad['status'] | string) => {
  let normalizedStatus: Ad['status'] = 'pending';
  if (status === 'approved' || status === 'rejected' || status === 'pending') {
    normalizedStatus = status as Ad['status'];
  }
  const configMap: Record<Ad['status'], { color: string; text: string }> = {
    pending: { color: 'warning', text: 'На модерации' },
    approved: { color: 'success', text: 'Одобрено' },
    rejected: { color: 'error', text: 'Отклонено' }
  };
  return configMap[normalizedStatus];
};

// Конфигурация приоритета объявления
export const getPriorityConfig = (priority: Ad['priority']) => {
  return priority === 'urgent' 
    ? { color: 'red', text: 'Срочно' }
    : { color: 'default', text: 'Обычный' };
};

// Конфигурация действия модератора
export const getActionConfig = (action: string) => {
  const configMap: Record<string, { color: string; text: string; icon: string }> = {
    approved: { color: 'success', text: 'Одобрено', icon: '✓' },
    rejected: { color: 'error', text: 'Отклонено', icon: '✗' },
    requestChanges: { color: 'warning', text: 'Запрошены изменения', icon: '↻' }
  };
  return configMap[action] || { color: 'default', text: action, icon: '' };
};

export const getApprovedTagStyle = () => ({
  backgroundColor: '#f6ffed',
  borderColor: '#b7eb8f',
  color: '#52c41a'
});


