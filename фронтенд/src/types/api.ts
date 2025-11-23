// Типы для API ответов

export interface Ad {
  id: number;
  title: string;
  description: string;
  price: number;
  category: string;
  categoryId: number;
  status: 'pending' | 'approved' | 'rejected';
  priority: 'normal' | 'urgent';
  createdAt: string;
  updatedAt: string;
  images: string[];
  seller: {
    id: number;
    name: string;
    rating: number;
    totalAds: number;
    registeredAt: string;
  };
  characteristics: Record<string, string | number | boolean>;
  moderationHistory: ModerationHistoryItem[];
}

export interface ModerationHistoryItem {
  id: number;
  moderatorId: number;
  moderatorName: string;
  action: 'approved' | 'rejected' | 'requestChanges';
  reason: string | null;
  comment: string | null;
  timestamp: string;
}

export interface Pagination {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface AdsResponse {
  ads: Ad[];
  pagination: Pagination;
}

export interface Summary {
  totalReviewed: number;
  totalReviewedToday: number;
  totalReviewedThisWeek: number;
  totalReviewedThisMonth: number;
  approvedPercentage: number;
  rejectedPercentage: number;
  requestChangesPercentage: number;
  averageReviewTime: number;
}

export interface ActivityChartItem {
  date: string;
  approved: number;
  rejected: number;
  requestChanges: number;
}

export interface DecisionsChart {
  approved: number;
  rejected: number;
  requestChanges: number;
}

export interface CategoriesChart {
  [categoryName: string]: number;
}

export interface APIError {
  message: string;
  status?: number;
}


