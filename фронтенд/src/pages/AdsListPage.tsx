import { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Typography, Spin, Alert, Empty, Pagination, Checkbox, Button, Space, Modal, Radio, Input, Card, message, theme, Badge, Switch, Tooltip, Progress } from 'antd';
import type { InputRef } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, SaveOutlined, BookOutlined, CopyOutlined, ReloadOutlined, BellOutlined } from '@ant-design/icons';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { adsAPI } from '../api/api';
import AdCard from '../components/AdCard';
import Filters from '../components/Filters';
import type { Ad, Pagination as PaginationType } from '../types/api';
import type { FiltersState, SortingState, SavedFilter } from '../types/components';
import { REJECT_REASONS } from '../utils/constants';

const { Title } = Typography;

function AdsListPage() {
  const { token } = theme.useToken();
  const { isDark } = useCustomTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FiltersState>({});
  const [debouncedFilters, setDebouncedFilters] = useState<FiltersState>({});
  const [sorting, setSorting] = useState<SortingState>({
    createdAt: null,
    price: null,
    priority: null
  });
  const [pagination, setPagination] = useState<PaginationType>({
    currentPage: 1,
    totalPages: 1,
    totalItems: 0,
    itemsPerPage: 10
  });
  const [savedFilters, setSavedFilters] = useState<SavedFilter[]>(() => {
    try {
      const saved = localStorage.getItem('savedFilters');
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [saveFilterModalVisible, setSaveFilterModalVisible] = useState(false);
  const [saveFilterName, setSaveFilterName] = useState('');
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const minPriceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxPriceTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const searchInputRef = useRef<InputRef>(null);
  const [selectedAds, setSelectedAds] = useState<Set<number>>(new Set());
  const [allAdsIds, setAllAdsIds] = useState<number[]>([]);
  const [bulkRejectModalVisible, setBulkRejectModalVisible] = useState(false);
  const [bulkRejectReason, setBulkRejectReason] = useState<string | null>(null);
  const [bulkRejectOtherText, setBulkRejectOtherText] = useState('');
  const [bulkLoading, setBulkLoading] = useState(false);
  const isInitialLoad = useRef(true);
  const [newAdsCount, setNewAdsCount] = useState(0);
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [secondsSinceUpdate, setSecondsSinceUpdate] = useState(0);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const countdownIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const knownAdsIdsRef = useRef<Set<number>>(new Set());
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    const urlFilters: FiltersState = {};
    const urlSorting: SortingState = { createdAt: null, price: null, priority: null };
    const status = searchParams.get('status');
    if (status) {
      urlFilters.status = status.split(',').filter(Boolean);
    }
    
    const categoryId = searchParams.get('categoryId');
    if (categoryId) {
      urlFilters.categoryId = parseInt(categoryId);
    }
    
    const minPrice = searchParams.get('minPrice');
    if (minPrice) {
      urlFilters.minPrice = parseInt(minPrice);
    }
    
    const maxPrice = searchParams.get('maxPrice');
    if (maxPrice) {
      urlFilters.maxPrice = parseInt(maxPrice);
    }
    
    const search = searchParams.get('search');
    if (search) {
      urlFilters.search = search;
    }
    
    const sortBy = searchParams.get('sortBy');
    const sortOrder = searchParams.get('sortOrder');
    if (sortBy && sortOrder && (sortBy === 'createdAt' || sortBy === 'price' || sortBy === 'priority')) {
      urlSorting[sortBy] = sortOrder as 'asc' | 'desc';
    }
    const page = searchParams.get('page');
    if (page) {
      setPagination(prev => ({ ...prev, currentPage: parseInt(page) }));
    }
    
    if (Object.keys(urlFilters).length > 0 || sortBy) {
      setFilters(urlFilters);
      setSorting(urlSorting);
      isInitialLoad.current = false;
    }
  }, []);

  useEffect(() => {
    if (isInitialLoad.current) {
      isInitialLoad.current = false;
      return;
    }

    const params = new URLSearchParams();
    if (debouncedFilters.status && debouncedFilters.status.length > 0) {
      params.set('status', debouncedFilters.status.join(','));
    }
    
    if (debouncedFilters.categoryId !== undefined && debouncedFilters.categoryId !== null) {
      params.set('categoryId', debouncedFilters.categoryId.toString());
    }
    
    if (debouncedFilters.minPrice !== undefined && debouncedFilters.minPrice !== null) {
      params.set('minPrice', debouncedFilters.minPrice.toString());
    }
    
    if (debouncedFilters.maxPrice !== undefined && debouncedFilters.maxPrice !== null) {
      params.set('maxPrice', debouncedFilters.maxPrice.toString());
    }
    
    if (debouncedFilters.search && debouncedFilters.search.trim()) {
      params.set('search', debouncedFilters.search);
    }
    
    let activeSortBy: 'createdAt' | 'price' | 'priority' | null = null;
    let activeSortOrder: 'asc' | 'desc' | null = null;
    if (sorting.priority) {
      activeSortBy = 'priority';
      activeSortOrder = sorting.priority;
    } else if (sorting.price) {
      activeSortBy = 'price';
      activeSortOrder = sorting.price;
    } else if (sorting.createdAt) {
      activeSortBy = 'createdAt';
      activeSortOrder = sorting.createdAt;
    }
    
    if (activeSortBy && activeSortOrder) {
      params.set('sortBy', activeSortBy);
      params.set('sortOrder', activeSortOrder);
    }
    
    if (pagination.currentPage > 1) {
      params.set('page', pagination.currentPage.toString());
    }
    
    setSearchParams(params, { replace: true });
  }, [debouncedFilters, sorting, pagination.currentPage, setSearchParams]);

  useEffect(() => {
    setDebouncedFilters(prev => ({
      ...prev,
      status: filters.status,
      categoryId: filters.categoryId
    }));
  }, [filters.status, filters.categoryId]);

  useEffect(() => {
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      setDebouncedFilters(prev => ({ ...prev, search: filters.search }));
    }, 1500);
    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [filters.search]);

  useEffect(() => {
    if (minPriceTimeoutRef.current) {
      clearTimeout(minPriceTimeoutRef.current);
    }
    minPriceTimeoutRef.current = setTimeout(() => {
      setDebouncedFilters(prev => ({ ...prev, minPrice: filters.minPrice }));
    }, 1500);
    return () => {
      if (minPriceTimeoutRef.current) {
        clearTimeout(minPriceTimeoutRef.current);
      }
    };
  }, [filters.minPrice]);

  useEffect(() => {
    if (maxPriceTimeoutRef.current) {
      clearTimeout(maxPriceTimeoutRef.current);
    }
    maxPriceTimeoutRef.current = setTimeout(() => {
      setDebouncedFilters(prev => ({ ...prev, maxPrice: filters.maxPrice }));
    }, 1500);
    return () => {
      if (maxPriceTimeoutRef.current) {
        clearTimeout(maxPriceTimeoutRef.current);
      }
    };
  }, [filters.maxPrice]);

  useEffect(() => {
    loadAds();
    return () => {
      knownAdsIdsRef.current.clear();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [pagination.currentPage, debouncedFilters, sorting]);

  // Автообновление списка объявлений каждые 30 секунд
  useEffect(() => {
    if (!autoRefreshEnabled) {
      setSecondsSinceUpdate(0);
      return;
    }

    pollingIntervalRef.current = setInterval(() => {
      loadAds(true); //
      setSecondsSinceUpdate(0);
    }, 30000);

    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled, debouncedFilters, sorting, pagination.currentPage]);

  // Счетчик секунд
  useEffect(() => {
    if (!autoRefreshEnabled) {
      setSecondsSinceUpdate(0);
      return;
    }

    countdownIntervalRef.current = setInterval(() => {
      setSecondsSinceUpdate(prev => {
        if (prev >= 30) {
          return 0;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [autoRefreshEnabled, lastUpdateTime]);

  // Горячие клавиши
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        return;
      }

      // / (англ) или . (рус) - фокус на поиск
      const key = event.key;
      const code = event.code;
      if (code === 'Slash' || key === '/' || key === '.' || key === '?') {
        event.preventDefault();
        if (searchInputRef.current) {
          const inputElement = searchInputRef.current.input;
          if (inputElement && inputElement.focus) {
            inputElement.focus();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  const loadAds = async (isAutoRefresh: boolean = false) => {
    try {
      if (!isAutoRefresh) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
        }
        abortControllerRef.current = new AbortController();
        setLoading(true);
        setLoadingProgress(0);
        // Симуляция прогресса загрузки
        const progressInterval = setInterval(() => {
          setLoadingProgress(prev => {
            if (prev >= 90) {
              clearInterval(progressInterval);
              return prev;
            }
            return prev + 10;
          });
        }, 100);
      }
      setError(null);
      
      const params: {
        page: number;
        limit: number;
        sortBy?: 'createdAt' | 'price' | 'priority';
        sortOrder?: 'asc' | 'desc';
        status?: string[];
        categoryId?: number;
        minPrice?: number;
        maxPrice?: number;
        search?: string;
      } = {
        page: pagination.currentPage,
        limit: 10
      };
      if (sorting.priority) {
        params.sortBy = 'priority';
        params.sortOrder = sorting.priority;
      } else if (sorting.price) {
        params.sortBy = 'price';
        params.sortOrder = sorting.price;
      } else if (sorting.createdAt) {
        params.sortBy = 'createdAt';
        params.sortOrder = sorting.createdAt;
      }

      if (debouncedFilters.status?.length) {
        params.status = debouncedFilters.status;
      }
      if (debouncedFilters.categoryId != null) {
        params.categoryId = debouncedFilters.categoryId;
      }
      if (debouncedFilters.minPrice != null) {
        params.minPrice = debouncedFilters.minPrice;
      }
      if (debouncedFilters.maxPrice != null) {
        params.maxPrice = debouncedFilters.maxPrice;
      }
      if (debouncedFilters.search?.trim()) {
        params.search = debouncedFilters.search;
      }

      const response = await adsAPI.getAds(params, abortControllerRef.current?.signal);
      const newAds = response.data.ads;
      
      if (isAutoRefresh) {
        setAds(prevAds => {
          const updatedAds = prevAds.map(prevAd => {
            const newAd = newAds.find(ad => ad.id === prevAd.id);
            return newAd || prevAd;
          });
          
          const currentIds = new Set(prevAds.map(ad => ad.id));
          const newAdsIds = newAds.filter(ad => !currentIds.has(ad.id));
          const trulyNewAds = newAdsIds.filter(ad => !knownAdsIdsRef.current.has(ad.id));
          
          if (trulyNewAds.length > 0) {
            setNewAdsCount(prev => prev + trulyNewAds.length);
            trulyNewAds.forEach(ad => knownAdsIdsRef.current.add(ad.id));
          }
          
          return updatedAds;
        });
      } else {
        setAds(newAds);
        newAds.forEach(ad => knownAdsIdsRef.current.add(ad.id));
      }
      
      setPagination(response.data.pagination);
      setLastUpdateTime(new Date());
      if (!isAutoRefresh) {
        setSecondsSinceUpdate(0);
      }
      
      const allAdsParams = { ...params, limit: 1000, page: 1 };
      const allAdsResponse = await adsAPI.getAds(allAdsParams, abortControllerRef.current?.signal);
      const allIds = allAdsResponse.data.ads.map(ad => ad.id);
      setAllAdsIds(allIds);
          } catch (err: unknown) {
            // Игнорирование ошибок отмены запроса
            if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
              return;
            }
            if (!isAutoRefresh) {
              if (err && typeof err === 'object' && 'response' in err) {
                const axiosError = err as { response?: { status?: number } };
                if (axiosError.response?.status === 500) {
                  setError('Ошибка сервера. Убедитесь, что бэкенд запущен на порту 3001 (npm start в папке tech-int3-server)');
                } else if (axiosError.response?.status === 404) {
                  setError('Эндпоинт не найден');
                } else {
                  setError('Ошибка при загрузке объявлений');
                }
              } else if (err && typeof err === 'object' && 'request' in err) {
                setError('Не удалось подключиться к серверу. Убедитесь, что бэкенд запущен на http://localhost:3001');
              } else {
                setError('Ошибка при загрузке объявлений');
              }
            }
            console.error(err);
          } finally {
      if (!isAutoRefresh) {
        setLoadingProgress(100);
        setTimeout(() => {
          setLoading(false);
          setLoadingProgress(0);
        }, 200);
      }
    }
  };

  const handleFilterChange = useCallback((newFilters: FiltersState) => {
    setFilters(newFilters);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  const handleResetFilters = useCallback(() => {
    // Очищаю таймеры debounce
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    if (minPriceTimeoutRef.current) {
      clearTimeout(minPriceTimeoutRef.current);
    }
    if (maxPriceTimeoutRef.current) {
      clearTimeout(maxPriceTimeoutRef.current);
    }
    
    setFilters({});
    setDebouncedFilters({});
    setSorting({ createdAt: null, price: null, priority: null });
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    setSelectedAds(new Set());
  }, []);

  const handlePageChange = (page: number) => {
    setPagination(prev => ({ ...prev, currentPage: page }));
  };

  // Обработка выбора объявления
  const handleSelectAd = useCallback((adId: number, checked: boolean) => {
    setSelectedAds(prev => {
      const newSet = new Set(prev);
      if (checked) {
        newSet.add(adId);
      } else {
        newSet.delete(adId);
      }
      return newSet;
    });
  }, []);

  // Выбрать все или снять выбор со всех (все n-е кол-во объявлений)
  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      const allIds = new Set(allAdsIds);
      setSelectedAds(allIds);
    } else {
      setSelectedAds(new Set());
    }
  }, [allAdsIds]);

  // Одобрение всех объявлений
  const handleBulkApprove = async () => {
    if (selectedAds.size === 0) return;

    try {
      setBulkLoading(true);
      const promises = Array.from(selectedAds).map(adId => adsAPI.approveAd(adId));
      await Promise.all(promises);
      setSelectedAds(new Set());
      await loadAds();
    } catch (err: unknown) {
      setError('Ошибка при массовом одобрении объявлений');
      console.error(err);
    } finally {
      setBulkLoading(false);
    }
  };

  // Отклонение всех объявлений по той же логике
  const handleBulkRejectClick = () => {
    if (selectedAds.size === 0) return;
    setBulkRejectModalVisible(true);
    setBulkRejectReason(null);
    setBulkRejectOtherText('');
  };

  const handleBulkRejectSubmit = async () => {
    if (!bulkRejectReason) return;

    let reasonText = bulkRejectReason;
    if (bulkRejectReason === 'Другое') {
      if (!bulkRejectOtherText.trim()) return;
      reasonText = bulkRejectOtherText.trim();
    }

    try {
      setBulkLoading(true);
      setBulkRejectModalVisible(false);
      const promises = Array.from(selectedAds).map(adId => 
        adsAPI.rejectAd(adId, reasonText, 'Объявление отклонено модератором')
      );
      await Promise.all(promises);
      setSelectedAds(new Set());
      await loadAds(false);
      setBulkRejectReason(null);
      setBulkRejectOtherText('');
    } catch (err: unknown) {
      setError('Ошибка при массовом отклонении объявлений');
      console.error(err);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkRejectCancel = () => {
    setBulkRejectModalVisible(false);
    setBulkRejectReason(null);
    setBulkRejectOtherText('');
  };

  // Сохранение набора фильтров
  const handleSaveFilter = () => {
    if (!saveFilterName.trim()) {
      message.warning('Введите название набора фильтров');
      return;
    }

    const filterSet: SavedFilter = {
      id: Date.now().toString(),
      name: saveFilterName.trim(),
      filters: { ...filters },
      sorting: { ...sorting },
      createdAt: new Date().toISOString()
    };

    const updated = [...savedFilters, filterSet];
    setSavedFilters(updated);
    localStorage.setItem('savedFilters', JSON.stringify(updated));
    setSaveFilterModalVisible(false);
    setSaveFilterName('');
    message.success('Набор фильтров сохранен');
  };

  // Применение сохраненного набора фильтров
  const handleLoadFilter = (filterSet: SavedFilter) => {
    setFilters(filterSet.filters);
    setSorting(filterSet.sorting);
    setPagination(prev => ({ ...prev, currentPage: 1 }));
    message.success(`Применен набор фильтров: ${filterSet.name}`);
  };

  // Удаление сохраненного набора фильтров
  const handleDeleteFilter = (filterId: string | number) => {
    const updated = savedFilters.filter(f => f.id !== filterId);
    setSavedFilters(updated);
    localStorage.setItem('savedFilters', JSON.stringify(updated));
    message.success('Набор фильтров удален');
  };

  const handleCopyFilterLink = async (filterSet: SavedFilter) => {
    const params = new URLSearchParams();
    if (filterSet.filters.status && filterSet.filters.status.length > 0) {
      params.set('status', filterSet.filters.status.join(','));
    }
    
    if (filterSet.filters.categoryId !== undefined && filterSet.filters.categoryId !== null) {
      params.set('categoryId', filterSet.filters.categoryId.toString());
    }
    
    if (filterSet.filters.minPrice !== undefined && filterSet.filters.minPrice !== null) {
      params.set('minPrice', filterSet.filters.minPrice.toString());
    }
    
    if (filterSet.filters.maxPrice !== undefined && filterSet.filters.maxPrice !== null) {
      params.set('maxPrice', filterSet.filters.maxPrice.toString());
    }
    
    if (filterSet.filters.search && filterSet.filters.search.trim()) {
      params.set('search', filterSet.filters.search);
    }
    
    let activeSortBy: 'createdAt' | 'price' | 'priority' | null = null;
    let activeSortOrder: 'asc' | 'desc' | null = null;
    if (filterSet.sorting.priority) {
      activeSortBy = 'priority';
      activeSortOrder = filterSet.sorting.priority;
    } else if (filterSet.sorting.price) {
      activeSortBy = 'price';
      activeSortOrder = filterSet.sorting.price;
    } else if (filterSet.sorting.createdAt) {
      activeSortBy = 'createdAt';
      activeSortOrder = filterSet.sorting.createdAt;
    }
    
    if (activeSortBy && activeSortOrder) {
      params.set('sortBy', activeSortBy);
      params.set('sortOrder', activeSortOrder);
    }
    
    const url = `${window.location.origin}${window.location.pathname}?${params.toString()}`;
    
    try {
      await navigator.clipboard.writeText(url);
      message.success('Ссылка скопирована в буфер обмена');
    } catch (err: unknown) {
      const textArea = document.createElement('textarea');
      textArea.value = url;
      textArea.style.position = 'fixed';
      textArea.style.opacity = '0';
      document.body.appendChild(textArea);
      textArea.select();
      try {
        // fallback для старых браузеров (в @ts-ignore)
        document.execCommand('copy');
        message.success('Ссылка скопирована в буфер обмена');
      } catch (e) {
        message.error('Не удалось скопировать ссылку');
      }
      document.body.removeChild(textArea);
    }
  };

  const allSelected = allAdsIds.length > 0 && selectedAds.size === allAdsIds.length && allAdsIds.every(id => selectedAds.has(id));
  const someSelected = selectedAds.size > 0 && selectedAds.size < allAdsIds.length;

  if (loading && ads.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16, marginBottom: 24 }}>Загрузка объявлений...</div>
        <Progress 
          percent={loadingProgress} 
          showInfo={false}
          strokeColor={{
            '0%': '#108ee9',
            '100%': '#87d068',
          }}
          style={{ maxWidth: 400, margin: '0 auto' }}
        />
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="Ошибка"
        description={error}
        type="error"
        showIcon
        style={{ marginBottom: 16 }}
      />
    );
  }

  const handleResetNewAdsCount = () => {
    setNewAdsCount(0);
    ads.forEach(ad => knownAdsIdsRef.current.add(ad.id));
  };

  const formatLastUpdateTime = () => {
    if (!autoRefreshEnabled || !lastUpdateTime) return '';
    return `${secondsSinceUpdate} сек`;
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <Title level={2} style={{ margin: 0, color: token.colorTextBase }}>
            Список объявлений
          </Title>
          {newAdsCount > 0 && (
            <Badge count={newAdsCount} size="default">
              <Button
                type="primary"
                icon={<BellOutlined />}
                onClick={handleResetNewAdsCount}
                style={{ backgroundColor: token.colorSuccess, borderColor: token.colorSuccess }}
              >
                Новые объявления
              </Button>
            </Badge>
          )}
        </div>
        <Space>
          <Tooltip title={autoRefreshEnabled ? 'Автообновление включено (каждые 30 сек)' : 'Автообновление выключено'}>
            <Switch
              checked={autoRefreshEnabled}
              onChange={setAutoRefreshEnabled}
              checkedChildren={<ReloadOutlined />}
              unCheckedChildren={<ReloadOutlined />}
            />
          </Tooltip>
          {lastUpdateTime && (
            <span style={{ color: token.colorTextSecondary, fontSize: 12 }}>
              Обновлено: {formatLastUpdateTime() } назад
            </span>
          )}
        </Space>
      </div>

      {/* Фильтры */}
      <Filters 
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        sorting={sorting}
        onSortingChange={(newSorting: SortingState) => {
          setSorting(newSorting);
          setPagination(prev => ({ ...prev, currentPage: 1 }));
        }}
        searchInputRef={searchInputRef}
        onSaveFilter={() => setSaveFilterModalVisible(true)}
      />

      {/* Сохраненные наборы фильтров */}
      {savedFilters.length > 0 && (
        <Card 
          title={
            <Space>
              <BookOutlined />
              <span>Сохраненные наборы фильтров</span>
            </Space>
          }
          style={{ 
            marginBottom: 24, 
            backgroundColor: isDark ? token.colorBgElevated : '#fffbe6' 
          }}
        >
          <Space wrap>
            {savedFilters.map(filterSet => (
              <Space key={filterSet.id}>
                <Button
                  onClick={() => handleLoadFilter(filterSet)}
                >
                  {filterSet.name}
                </Button>
                <Button
                  type="text"
                  icon={<CopyOutlined />}
                  size="small"
                  onClick={() => handleCopyFilterLink(filterSet)}
                  title="Копировать ссылку"
                />
                <Button
                  type="text"
                  danger
                  size="small"
                  onClick={() => handleDeleteFilter(filterSet.id)}
                  title="Удалить"
                >
                  ×
                </Button>
              </Space>
            ))}
          </Space>
        </Card>
      )}

      {/* Панель одобрения или отклонения всех операций (после сортировки) */}
      {selectedAds.size > 0 && (
        <div style={{ 
          marginBottom: 16, 
          padding: '12px 16px', 
          backgroundColor: isDark ? token.colorBgElevated : '#fffbe6', 
          borderRadius: 4,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <Space>
            <Typography.Text strong>
              Выбрано: {selectedAds.size}
            </Typography.Text>
            <Button
              type="primary"
              icon={<CheckCircleOutlined />}
              onClick={handleBulkApprove}
              loading={bulkLoading}
              style={{ 
                backgroundColor: '#4caf50', 
                borderColor: '#4caf50' 
              }}
            >
              Одобрить все
            </Button>
            <Button
              type="primary"
              danger
              icon={<CloseCircleOutlined />}
              onClick={handleBulkRejectClick}
              loading={bulkLoading}
            >
              Отклонить все
            </Button>
          </Space>
          <Button
            type="link"
            onClick={() => setSelectedAds(new Set())}
          >
            Снять выбор
          </Button>
        </div>
      )}

      {/* Чекбокс "Выбрать все" */}
      {ads.length > 0 && allAdsIds.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          <Checkbox
            indeterminate={someSelected}
            checked={allSelected}
            onChange={(e) => handleSelectAll(e.target.checked)}
          >
            Выбрать все ({allAdsIds.length} {allAdsIds.length === 1 ? 'объявление' : allAdsIds.length < 5 ? 'объявления' : 'объявлений'})
          </Checkbox>
        </div>
      )}

      {loading && ads.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '50px' }}>
          <Spin size="large" />
          <div style={{ marginTop: 16 }}>Загрузка объявлений...</div>
        </div>
      ) : error ? (
        <Alert
          message="Ошибка"
          description={error}
          type="error"
          showIcon
          style={{ marginBottom: 16 }}
        />
      ) : ads.length === 0 ? (
        <Empty description="Объявления не найдены" />
      ) : (
        <>
          <div>
            {ads.map((ad, index) => (
              <div key={ad.id} className="ad-card-enter" style={{ animationDelay: `${index * 0.05}s` }}>
                <AdCard 
                  ad={ad} 
                  adsIds={ads.map(a => a.id)}
                  selected={selectedAds.has(ad.id)}
                  onSelect={handleSelectAd}
                />
              </div>
            ))}
          </div>
          {pagination.totalPages > 1 && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <Pagination
                current={pagination.currentPage}
                total={pagination.totalItems}
                pageSize={pagination.itemsPerPage}
                onChange={handlePageChange}
                showSizeChanger={false}
                showTotal={(total) => `Всего ${total} объявлений`}
              />
            </div>
          )}
        </>
      )}

      {/* Модальное окно для отклонения всех объявлений */}
      <Modal
        title="Отклонение объявлений"
        open={bulkRejectModalVisible}
        onOk={handleBulkRejectSubmit}
        onCancel={handleBulkRejectCancel}
        okText="Отправить"
        cancelButtonProps={{ style: { display: 'none' } }}
        okButtonProps={{ 
          danger: true,
          disabled: !bulkRejectReason || (bulkRejectReason === 'Другое' && !bulkRejectOtherText.trim()),
          style: { width: '100%' }
        }}
        width={500}
        styles={{
          footer: {
            textAlign: 'center'
          }
        }}
      >
        <div style={{ marginBottom: 16, textAlign: 'center' }}>
          <Typography.Text strong style={{ fontSize: 16 }}>
            Причина отклонения ({selectedAds.size} объявлений):
          </Typography.Text>
        </div>
        <Radio.Group 
          value={bulkRejectReason} 
          onChange={(e) => setBulkRejectReason(e.target.value)}
          style={{ width: '100%' }}
        >
          <Space direction="vertical" style={{ width: '100%' }}>
            {REJECT_REASONS.map((reason) => (
              <Radio key={reason} value={reason}>
                {reason}{reason === 'Другое' ? ':' : ''}
              </Radio>
            ))}
          </Space>
        </Radio.Group>
        {bulkRejectReason === 'Другое' && (
          <Input.TextArea
            placeholder="Укажите причину отклонения"
            value={bulkRejectOtherText}
            onChange={(e) => setBulkRejectOtherText(e.target.value)}
            style={{ marginTop: 12 }}
            rows={3}
          />
        )}
      </Modal>

      {/* Модальное окно для сохранения набора фильтров */}
      <Modal
        title="Сохранить набор фильтров"
        open={saveFilterModalVisible}
        onOk={handleSaveFilter}
        onCancel={() => {
          setSaveFilterModalVisible(false);
          setSaveFilterName('');
        }}
        okText="Сохранить"
        cancelText="Отмена"
        okButtonProps={{ disabled: !saveFilterName.trim() }}
      >
        <div style={{ marginBottom: 16 }}>
          <Typography.Text strong>Название набора:</Typography.Text>
        </div>
        <Input
          placeholder="Например: Одобренные электроника"
          value={saveFilterName}
          onChange={(e) => setSaveFilterName(e.target.value)}
          onPressEnter={handleSaveFilter}
        />
      </Modal>
    </div>
  );
}

export default AdsListPage;

