import { useState, useEffect, useRef, memo, useLayoutEffect } from 'react';
import { Card, Checkbox, Select, InputNumber, Input, Button, Space, Row, Col, Radio, theme } from 'antd';
import type { InputRef } from 'antd';
import { ReloadOutlined, SearchOutlined, SaveOutlined } from '@ant-design/icons';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { CATEGORIES, STATUS_OPTIONS } from '../utils/constants';
import type { FiltersProps } from '../types/components';

const { Option } = Select;

function Filters({ 
  filters = {}, 
  onFilterChange, 
  onReset, 
  sorting = { createdAt: null, price: null, priority: null }, 
  onSortingChange, 
  searchInputRef: externalSearchInputRef, 
  onSaveFilter 
}: FiltersProps) {
  const { token } = theme.useToken();
  const { isDark } = useCustomTheme();
  const [statuses, setStatuses] = useState<string[]>(filters.status || []);
  const [categoryId, setCategoryId] = useState<number | undefined>(filters.categoryId);
  const [minPrice, setMinPrice] = useState<number | undefined>(filters.minPrice);
  const [maxPrice, setMaxPrice] = useState<number | undefined>(filters.maxPrice);
  const [search, setSearch] = useState<string>(filters.search || '');
  const [searchValue, setSearchValue] = useState<string>(filters.search || ''); // Локальное значение для отображения
  const internalSearchInputRef = useRef<InputRef>(null);
  const searchInputRef = externalSearchInputRef || internalSearchInputRef;
  const wasFocusedRef = useRef<boolean>(false);

  // Синхронизируется локальное состояние с пропсами только при явном сбросе(когда все фильтры пустые)
  // Не синхронизируется search
  useEffect(() => {
    const isEmpty = !filters.status?.length && 
                    filters.categoryId === undefined && 
                    filters.minPrice === undefined && 
                    filters.maxPrice === undefined && 
                    filters.search === undefined;
    
    if (isEmpty && (statuses.length > 0 || categoryId !== undefined || minPrice !== undefined || maxPrice !== undefined)) {
      // Сбрасывается только если локальное состояние не пустое
      setStatuses([]);
      setCategoryId(undefined);
      setMinPrice(undefined);
      setMaxPrice(undefined);
    }
  }, [filters.status, filters.categoryId, filters.minPrice, filters.maxPrice, statuses.length, categoryId, minPrice, maxPrice]);

  // Фокус на поле поиска после перерендера
  useLayoutEffect(() => {
    if (wasFocusedRef.current && searchInputRef.current) {
      const input = (searchInputRef.current as InputRef).input || searchInputRef.current;
      if (input && document.activeElement !== input) {
        requestAnimationFrame(() => {
          if (searchInputRef.current && wasFocusedRef.current) {
            const inputEl = ((searchInputRef.current as InputRef).input || searchInputRef.current) as HTMLInputElement;
            if (inputEl && inputEl.focus) {
              inputEl.focus();
              if (inputEl.setSelectionRange && searchValue) {
                const length = searchValue.length;
                inputEl.setSelectionRange(length, length);
              }
            }
          }
        });
      }
    }
  });

  const handleStatusChange = (checkedValues: string[]) => {
    setStatuses(checkedValues);
    onFilterChange({
      status: checkedValues,
      categoryId,
      minPrice,
      maxPrice,
      search
    });
  };

  const handleCategoryChange = (value: number | undefined) => {
    setCategoryId(value);
    onFilterChange({
      status: statuses,
      categoryId: value,
      minPrice,
      maxPrice,
      search
    });
  };

  const handlePriceChange = (field: 'min' | 'max', value: number | null) => {
    const priceValue = value === null || value === undefined ? undefined : value;
    
    if (field === 'min') {
      setMinPrice(priceValue);
      onFilterChange({
        status: statuses,
        categoryId,
        minPrice: priceValue,
        maxPrice,
        search
      });
    } else {
      setMaxPrice(priceValue);
      onFilterChange({
        status: statuses,
        categoryId,
        minPrice,
        maxPrice: priceValue,
        search
      });
    }
  };

  const handleSearchChange = (value: string) => {
    const newValue = value || '';
    setSearchValue(newValue);
    setSearch(newValue);
    onFilterChange({
      status: statuses,
      categoryId,
      minPrice,
      maxPrice,
      search: newValue
    });
  };

  const handleReset = () => {
    setStatuses([]);
    setCategoryId(undefined);
    setMinPrice(undefined);
    setMaxPrice(undefined);
    setSearch('');
    setSearchValue('');
    onReset();
  };

  const hasActiveFilters = statuses.length > 0 || categoryId !== undefined || 
                          minPrice !== undefined || maxPrice !== undefined || search !== '';

  return (
    <>
    <Card 
      title="Фильтры:" 
      style={{ 
        marginBottom: 24, 
        backgroundColor: isDark ? token.colorBgElevated : '#fffbe6' 
      }}
      extra={
        <Space>
          {onSaveFilter && (
            <Button
              icon={<SaveOutlined />}
              onClick={onSaveFilter}
              size="small"
            >
              Сохранить текущие фильтры
            </Button>
          )}
          {hasActiveFilters && (
            <Button 
              type="link" 
              icon={<ReloadOutlined />} 
              onClick={handleReset}
            >
              Сбросить
            </Button>
          )}
        </Space>
      }
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        {/* Статус */}
        <div>
          <div style={{ marginBottom: 8, fontWeight: 500 }}>
            Статус:
          </div>
          <Space direction="vertical" size="small">
            {STATUS_OPTIONS.map(option => (
              <Checkbox
                key={option.value}
                value={option.value}
                checked={statuses.includes(option.value)}
                onChange={(e) => {
                  if (e.target.checked) {
                    handleStatusChange([...statuses, option.value]);
                  } else {
                    handleStatusChange(statuses.filter(s => s !== option.value));
                  }
                }}
              >
                {option.label}
              </Checkbox>
            ))}
          </Space>
        </div>

        {/* Категория, Цена, Поиск */}
        <Row gutter={16}>
          <Col span={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Категория:</div>
            <Select
              placeholder="Выберите категорию"
              style={{ width: '100%' }}
              allowClear
              value={categoryId}
              onChange={handleCategoryChange}
            >
              {CATEGORIES.map(cat => (
                <Option key={cat.id} value={cat.id}>
                  {cat.name}
                </Option>
              ))}
            </Select>
          </Col>

          <Col span={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Цена:</div>
            <Space>
              <InputNumber
                placeholder="От"
                style={{ width: '100%' }}
                min={0}
                value={minPrice}
                onChange={(value) => handlePriceChange('min', value)}
                formatter={(value) => value ? `${value} ₽` : ''}
                parser={(value): number | undefined => {
                  if (!value) return undefined;
                  const num = parseFloat(value.replace(' ₽', ''));
                  return !isNaN(num) ? num : undefined;
                }}
              />
              <span>-</span>
              <InputNumber
                placeholder="До"
                style={{ width: '100%' }}
                min={0}
                value={maxPrice}
                onChange={(value) => handlePriceChange('max', value)}
                formatter={(value) => value ? `${value} ₽` : ''}
                parser={(value): number | undefined => {
                  if (!value) return undefined;
                  const num = parseFloat(value.replace(' ₽', ''));
                  return !isNaN(num) ? num : undefined;
                }}
              />
            </Space>
          </Col>

          <Col span={8}>
            <div style={{ marginBottom: 8, fontWeight: 500 }}>Поиск по названию:</div>
            <Input
              ref={searchInputRef}
              placeholder="Поиск по названию"
              allowClear
              prefix={<SearchOutlined />}
              value={searchValue}
              onChange={(e) => handleSearchChange(e.target.value)}
              onFocus={() => {
                wasFocusedRef.current = true;
              }}
              onBlur={(e) => {
                setTimeout(() => {
                  if (document.activeElement !== e.target && 
                      document.activeElement !== (searchInputRef.current as InputRef)?.input) {
                    wasFocusedRef.current = false;
                  }
                }, 0);
              }}
            />
          </Col>
        </Row>
      </Space>
    </Card>

    <Card 
      title="Сортировка:" 
      style={{ 
        marginBottom: 24, 
        backgroundColor: isDark ? token.colorBgElevated : '#fffbe6' 
      }}
    >
      <Row gutter={[16, 16]}>
        {/* Сортировка по дате создания */}
        <Col xs={24} sm={8}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>По дате создания:</div>
          <Radio.Group
            value={sorting.createdAt || null}
            onChange={(e) => {
              const newValue = e.target.value === sorting.createdAt ? null : e.target.value;
              onSortingChange({
                createdAt: newValue || null,
                price: null,
                priority: null
              });
            }}
            size="small"
          >
            <Radio.Button value="desc">Новые</Radio.Button>
            <Radio.Button value="asc">Старые</Radio.Button>
          </Radio.Group>
        </Col>

        {/* Сортировка по цене */}
        <Col xs={24} sm={8}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>По цене:</div>
          <Radio.Group
            value={sorting.price || null}
            onChange={(e) => {
              const newValue = e.target.value === sorting.price ? null : e.target.value;
              onSortingChange({
                createdAt: null,
                price: newValue || null,
                priority: null
              });
            }}
            size="small"
          >
            <Radio.Button value="asc">Возрастание</Radio.Button>
            <Radio.Button value="desc">Убывание</Radio.Button>
          </Radio.Group>
        </Col>

        {/* Сортировка по приоритету */}
        <Col xs={24} sm={8}>
          <div style={{ marginBottom: 8, fontWeight: 500, fontSize: 14 }}>По приоритету:</div>
          <Radio.Group
            value={sorting.priority || null}
            onChange={(e) => {
              const newValue = e.target.value === sorting.priority ? null : e.target.value;
              onSortingChange({
                createdAt: null,
                price: null,
                priority: newValue || null
              });
            }}
            size="small"
          >
            <Radio.Button value="asc">Обычные</Radio.Button>
            <Radio.Button value="desc">Срочные</Radio.Button>
          </Radio.Group>
        </Col>
      </Row>
    </Card>
    </>
  );
}

export default memo(Filters);


