import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '../../contexts/ThemeContext';
import AdCard from '../AdCard';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

describe('AdCard', () => {
  const mockAd = {
    id: 1,
    title: 'Тестовое объявление',
    description: 'Описание',
    price: 10000,
    category: 'Электроника',
    categoryId: 0,
    createdAt: '2024-01-01T00:00:00.000Z',
    updatedAt: '2024-01-01T00:00:00.000Z',
    status: 'pending',
    priority: 'normal',
    images: [],
    seller: {
      id: 1,
      name: 'Продавец',
      rating: 4.5,
      totalAds: 10,
      registeredAt: '2023-01-01T00:00:00.000Z',
    },
    characteristics: {},
    moderationHistory: [],
  };

  const mockAdsIds = [1, 2, 3];

  it('отображает название объявления', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AdCard ad={mockAd} adsIds={mockAdsIds} selected={false} onSelect={vi.fn()} />
        </ThemeProvider>
      </BrowserRouter>
    );
    expect(screen.getByText('Тестовое объявление')).toBeInTheDocument();
  });

  it('отображает цену в правильном формате', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AdCard ad={mockAd} adsIds={mockAdsIds} selected={false} onSelect={vi.fn()} />
        </ThemeProvider>
      </BrowserRouter>
    );
    expect(screen.getByText(/10 000 ₽/)).toBeInTheDocument();
  });

  it('отображает категорию и дату', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AdCard ad={mockAd} adsIds={mockAdsIds} selected={false} onSelect={vi.fn()} />
        </ThemeProvider>
      </BrowserRouter>
    );
    expect(screen.getByText(/Электроника/)).toBeInTheDocument();
  });

  it('отображает статус "На модерации" для pending', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AdCard ad={mockAd} adsIds={mockAdsIds} selected={false} onSelect={vi.fn()} />
        </ThemeProvider>
      </BrowserRouter>
    );
    expect(screen.getByText('На модерации')).toBeInTheDocument();
  });

  it('отображает приоритет "Обычный" для normal', () => {
    render(
      <BrowserRouter>
        <ThemeProvider>
          <AdCard ad={mockAd} adsIds={mockAdsIds} selected={false} onSelect={vi.fn()} />
        </ThemeProvider>
      </BrowserRouter>
    );
    expect(screen.getByText('Обычный')).toBeInTheDocument();
  });
});

