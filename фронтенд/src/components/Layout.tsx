import { Link, useLocation } from 'react-router-dom';
import { Layout as AntLayout, Button, Space, Switch, theme } from 'antd';
import { AppstoreOutlined, BarChartOutlined } from '@ant-design/icons';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';

const { Header, Content } = AntLayout;

interface LayoutProps {
  children: React.ReactNode;
}

function Layout({ children }: LayoutProps) {
  const { token } = theme.useToken();
  const { isDark, toggleTheme } = useCustomTheme();
  const location = useLocation();

  return (
    <AntLayout style={{ minHeight: '100vh' }}>
      <Header
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: isDark ? token.colorBgContainer : '#fff',
          borderBottom: `1px solid ${token.colorBorder}`,
          padding: '0 24px',
        }}
      >
        <Space size="large" wrap>
          <Link to="/list">
            <Button
              type={location.pathname === '/list' ? 'primary' : 'default'}
              icon={<AppstoreOutlined />}
            >
              Список объявлений
            </Button>
          </Link>
          <Link to="/stats">
            <Button
              type={location.pathname === '/stats' ? 'primary' : 'default'}
              icon={<BarChartOutlined />}
            >
              Статистика
            </Button>
          </Link>
        </Space>
        <Space>
          <span style={{ color: token.colorText }}>Темная тема</span>
          <Switch checked={isDark} onChange={toggleTheme} />
        </Space>
      </Header>
      <Content style={{ padding: '24px', backgroundColor: isDark ? token.colorBgBase : '#f0f2f5' }}>
        {children}
      </Content>
    </AntLayout>
  );
}

export default Layout;


