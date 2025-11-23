import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { ConfigProvider, theme } from 'antd';
import ruRU from 'antd/locale/ru_RU';
import { ThemeProvider, useTheme } from './contexts/ThemeContext';
import Layout from './components/Layout';
import AdsListPage from './pages/AdsListPage';
import AdDetailPage from './pages/AdDetailPage';
import StatsPage from './pages/StatsPage';
import { useEffect } from 'react';

function AnimatedRoutes() {
  const location = useLocation();

  useEffect(() => {
    // Добавляю класс для анимации при смене страницы
    const content = document.querySelector('.page-content');
    if (content) {
      content.classList.add('page-enter');
      setTimeout(() => {
        content.classList.add('page-enter-active');
      }, 10);
    }
  }, [location]);

  return (
    <div className="page-content">
      <Routes location={location}>
        <Route path="/" element={<Navigate to="/list" replace />} />
        <Route path="/list" element={<AdsListPage />} />
        <Route path="/item/:id" element={<AdDetailPage />} />
        <Route path="/stats" element={<StatsPage />} />
      </Routes>
    </div>
  );
}

function AppContent() {
  const { isDark } = useTheme();

  return (
    <ConfigProvider 
      locale={ruRU}
      theme={{
        algorithm: isDark ? theme.darkAlgorithm : theme.defaultAlgorithm,
        token: isDark ? {
          // Тёмная тема
          colorBgBase: '#1a2332',
          colorBgContainer: '#243447',
          colorBgElevated: '#2d4054',
          colorText: '#e8e8e8',
          colorTextSecondary: '#b8b8b8',
          colorBorder: '#3d5568',
          colorPrimary: '#1677ff',
          colorSuccess: '#52c41a',
          colorWarning: '#faad14',
          colorError: '#ff4d4f',
        } : {},
      }}
    >
      <Router>
        <Layout>
          <AnimatedRoutes />
        </Layout>
      </Router>
    </ConfigProvider>
  );
}

function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

export default App;


