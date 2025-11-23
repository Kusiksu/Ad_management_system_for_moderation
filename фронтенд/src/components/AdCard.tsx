import { useState, memo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Tag, Button, Space, Typography, Checkbox, theme } from 'antd';
import { TagOutlined, PictureOutlined } from '@ant-design/icons';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import type { Ad } from '../types/api';
import { formatDate, formatPrice } from '../utils/formatters';
import { getStatusConfig, getPriorityConfig, getApprovedTagStyle } from '../utils/configs';

const { Title, Text } = Typography;

interface AdCardProps {
  ad: Ad;
  adsIds: number[];
  selected: boolean;
  onSelect: (id: number, checked: boolean) => void;
}

function AdCard({ ad, adsIds, selected, onSelect }: AdCardProps) {
  const navigate = useNavigate();
  const [isHovered, setIsHovered] = useState(false);
  const { token } = theme.useToken();
  const { isDark } = useCustomTheme();

  const statusConfig = getStatusConfig(ad.status);
  const priorityConfig = getPriorityConfig(ad.priority);

  return (
    <Card
      style={{ marginBottom: 16 }}
      styles={{ body: { padding: 16 } }}
      className="ad-card-enter"
    >
      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
        {/* Чекбокс для выбора */}
        <Checkbox
          checked={selected}
          onChange={(e) => onSelect(ad.id, e.target.checked)}
          onClick={(e) => e.stopPropagation()}
        />
        
        {/* Placeholder изображения */}
        <div style={{ position: 'relative' }}>
          <div
            style={{
              width: 120,
              height: 120,
              border: `1px solid ${isDark ? token.colorBorder : '#000'}`,
              borderRadius: 4,
              backgroundColor: isDark ? token.colorBgContainer : '#f5f5f5',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              color: isDark ? token.colorTextSecondary : '#999',
              fontSize: 12
            }}
          >
            <PictureOutlined style={{ fontSize: 32, marginBottom: 4 }} />
            <div style={{ textAlign: 'center', padding: '0 8px' }}>
              Изображение {ad.id}
            </div>
          </div>
          <Tag
            color={priorityConfig.color}
            style={{
              position: 'absolute',
              top: 4,
              right: 4,
              margin: 0
            }}
          >
            {priorityConfig.text}
          </Tag>
        </div>

        {/* Контент */}
        <div style={{ flex: 1 }}>
          <Title level={5} style={{ margin: '0 0 8px 0' }}>
            {ad.title}
          </Title>
          <div style={{ marginBottom: 8 }}>
            <Space>
              <TagOutlined style={{ color: '#666' }} />
              <Text strong style={{ fontSize: 16 }}>
                {formatPrice(ad.price)}
              </Text>
            </Space>
          </div>
          <Text type="secondary" style={{ fontSize: 14, display: 'block', marginBottom: 8 }}>
            {ad.category} • {formatDate(ad.createdAt)}
          </Text>
          <Tag 
            color={statusConfig.color}
            style={statusConfig.text === 'Одобрено' ? getApprovedTagStyle() : {}}
          >
            {statusConfig.text}
          </Tag>
        </div>

        {/* Кнопка */}
        <Button
          type="primary"
          style={{ 
            backgroundColor: isHovered ? '#45a049' : '#4caf50', 
            borderColor: isHovered ? '#45a049' : '#4caf50'
          }}
          onMouseEnter={() => setIsHovered(true)}
          onMouseLeave={() => setIsHovered(false)}
          onClick={() => navigate(`/item/${ad.id}`, { state: { adsIds } })}
        >
          Открыть →
        </Button>
      </div>
    </Card>
  );
}

export default memo(AdCard);