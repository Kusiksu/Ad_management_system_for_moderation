import axios, { AxiosInstance } from 'axios';
import type {
  Ad,
  AdsResponse,
  Summary,
  ActivityChartItem,
  DecisionsChart,
  CategoriesChart,
} from '../types/api';

const API_BASE_URL = '/api/v1';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: false,
});

// Обработка ошибок API
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.code === 'ERR_CANCELED' || error.message === 'canceled') {
      return Promise.reject(error);
    }

    if (error.response) {
      const status = error.response.status;
      const data = error.response.data;
      
      if (status === 500) {
        console.error('API Error 500: Внутренняя ошибка сервера. Проверьте консоль бэкенда.');
      } else {
        console.error(`API Error [${status}]:`, data);
      }
    } else if (error.request) {
      console.error('Network Error: Не удалось подключиться к серверу.');
      console.error('Убедитесь, что бэкенд запущен на http://localhost:3001');
    } else {
      console.error('Request error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Типы для параметров запросов
export interface GetAdsParams {
  page?: number;
  limit?: number;
  status?: string[];
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
  sortBy?: 'createdAt' | 'price' | 'priority';
  sortOrder?: 'asc' | 'desc';
}

export interface GetStatsParams {
  period?: 'today' | 'week' | 'month';
}

export const adsAPI = {
  // Получить список объявлений с фильтрацией
  getAds: (params: GetAdsParams = {}, signal?: AbortSignal | null): Promise<{ data: AdsResponse }> => {
    return api.get<AdsResponse>('/ads', { params, signal });
  },

  // Получить объявление по ID
  getAdById: (id: number, signal?: AbortSignal | null): Promise<{ data: Ad }> => {
    return api.get<Ad>(`/ads/${id}`, { signal });
  },

  // Одобрить объявление
  approveAd: (id: number, signal?: AbortSignal | null): Promise<{ data: Ad }> => {
    return api.post<Ad>(`/ads/${id}/approve`, {}, { signal });
  },

  // Отклонить объявление
  rejectAd: (
    id: number,
    reason: string,
    comment: string = '',
    signal?: AbortSignal | null
  ): Promise<{ data: Ad }> => {
    return api.post<Ad>(`/ads/${id}/reject`, { reason, comment }, { signal });
  },

  // Запросить изменения
  requestChanges: (
    id: number,
    reason: string,
    comment: string = '',
    signal?: AbortSignal | null
  ): Promise<{ data: Ad }> => {
    return api.post<Ad>(`/ads/${id}/request-changes`, { reason, comment }, { signal });
  },
};

// API для статистики
export const statsAPI = {
  getSummary: (params: GetStatsParams = {}, signal?: AbortSignal | null): Promise<{ data: Summary }> => {
    return api.get<Summary>('/stats/summary', { params, signal });
  },

  // Получить график активности
  getActivityChart: (
    params: GetStatsParams = {},
    signal?: AbortSignal | null
  ): Promise<{ data: ActivityChartItem[] }> => {
    return api.get<ActivityChartItem[]>('/stats/chart/activity', { params, signal });
  },

  // Получить график решений
  getDecisionsChart: (
    params: GetStatsParams = {},
    signal?: AbortSignal | null
  ): Promise<{ data: DecisionsChart }> => {
    return api.get<DecisionsChart>('/stats/chart/decisions', { params, signal });
  },

  // Получить график по категориям
  getCategoriesChart: (
    params: GetStatsParams = {},
    signal?: AbortSignal | null
  ): Promise<{ data: CategoriesChart }> => {
    return api.get<CategoriesChart>('/stats/chart/categories', { params, signal });
  },
};
