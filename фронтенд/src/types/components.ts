/**
 * Типы для компонентов
 */
import type { InputRef } from 'antd';

export interface FiltersProps {
  filters?: {
    status?: string[];
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  };
  onFilterChange: (filters: {
    status?: string[];
    categoryId?: number;
    minPrice?: number;
    maxPrice?: number;
    search?: string;
  }) => void;
  onReset: () => void;
  sorting?: {
    createdAt: 'asc' | 'desc' | null;
    price: 'asc' | 'desc' | null;
    priority: 'asc' | 'desc' | null;
  };
  onSortingChange: (sorting: {
    createdAt: 'asc' | 'desc' | null;
    price: 'asc' | 'desc' | null;
    priority: 'asc' | 'desc' | null;
  }) => void;
  searchInputRef?: React.RefObject<InputRef>;
  onSaveFilter?: () => void;
}

export interface SortingState {
  createdAt: 'asc' | 'desc' | null;
  price: 'asc' | 'desc' | null;
  priority: 'asc' | 'desc' | null;
}

export interface FiltersState {
  status?: string[];
  categoryId?: number;
  minPrice?: number;
  maxPrice?: number;
  search?: string;
}

export interface PaginationState {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  itemsPerPage: number;
}

export interface SavedFilter {
  id: string;
  name: string;
  filters: FiltersState;
  sorting: SortingState;
  createdAt: string;
}

