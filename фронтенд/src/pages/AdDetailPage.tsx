import type { Ad } from '../types/api';
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { 
  Typography, 
  Spin, 
  Alert, 
  Card, 
  Row, 
  Col, 
  Table, 
  Tag, 
  Space,
  Button,
  Descriptions,
  Modal,
  Radio,
  Input,
  theme
} from 'antd';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { formatDate, formatDateTime, formatDateShort, formatPrice } from '../utils/formatters';
import { getStatusConfig, getActionConfig, getApprovedTagStyle } from '../utils/configs';
import { REJECT_REASONS } from '../utils/constants';
import { 
  ArrowLeftOutlined, 
  UserOutlined, 
  StarOutlined,
  CalendarOutlined,
  FileTextOutlined,
  PictureOutlined,
  CheckOutlined,
  CloseOutlined,
  ReloadOutlined,
  AppstoreOutlined,
  LeftOutlined,
  RightOutlined
} from '@ant-design/icons';
import { adsAPI } from '../api/api';

const { Title, Text, Paragraph } = Typography;

function AdDetailPage() {
  const { token } = theme.useToken();
  const { isDark } = useCustomTheme();
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const [ad, setAd] = useState<Ad | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [rejectModalVisible, setRejectModalVisible] = useState(false);
  const [rejectReason, setRejectReason] = useState<string | null>(null);
  const [rejectOtherText, setRejectOtherText] = useState('');
  const [allAdsIds, setAllAdsIds] = useState<number[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    loadAd();
    loadAdsIds();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
    // loadAd и loadAdsIds зависят от id и location.state, которые уже в зависимостях
  }, [id, location.state]);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || rejectModalVisible) {
        return;
      }

      const key = event.key.toLowerCase();
      const code = event.code;

      if (code === 'KeyA' || key === 'а' || key === 'ф') {
        // A (англ) / Ф (рус) - одобрить объявление
        event.preventDefault();
        if (!loading && ad) {
          handleApprove();
        }
      } else if (code === 'KeyD' || key === 'в' || key === 'd') {
        // D (англ) / В (рус) - отклонить объявление
        event.preventDefault();
        if (!loading && ad) {
          handleRejectClick();
        }
      } else if (code === 'ArrowRight' || key === 'arrowright') {
        // → - следующее объявление
        event.preventDefault();
        if (currentIndex >= 0 && currentIndex < allAdsIds.length - 1) {
          handleNext();
        }
      } else if (code === 'ArrowLeft' || key === 'arrowleft') {
        // ← - предыдущее объявление
        event.preventDefault();
        if (currentIndex > 0) {
          handlePrevious();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad, loading, currentIndex, allAdsIds.length, rejectModalVisible]);

  const loadAdsIds = () => {
    if (!id) return;
    
    const adsIdsFromState = (location.state as { adsIds?: number[] })?.adsIds;
    
    if (adsIdsFromState && Array.isArray(adsIdsFromState)) {
      setAllAdsIds(adsIdsFromState);
      const adId = parseInt(id, 10);
      if (!isNaN(adId)) {
        const index = adsIdsFromState.indexOf(adId);
        setCurrentIndex(index);
      }
    } else {
      loadAllAdsIdsFallback();
    }
  };

  const loadAllAdsIdsFallback = async () => {
    if (!id) return;
    
    try {
      // fallback для загрузки всех объявлений
      const response = await adsAPI.getAds({ limit: 1000 }, abortControllerRef.current?.signal);
      const ids = response.data.ads.map(ad => ad.id);
      setAllAdsIds(ids);
      const adId = parseInt(id, 10);
      if (!isNaN(adId)) {
        const index = ids.indexOf(adId);
        setCurrentIndex(index);
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      console.error('Ошибка при загрузке списка объявлений:', err);
    }
  };

  const loadAd = async () => {
    if (!id) return;
    
    const adId = parseInt(id, 10);
    if (isNaN(adId)) {
      setError('Неверный ID объявления');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const response = await adsAPI.getAdById(adId, abortControllerRef.current?.signal);
      setAd(response.data);
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      if (err && typeof err === 'object' && 'response' in err && 
          typeof err.response === 'object' && err.response !== null &&
          'status' in err.response && err.response.status === 404) {
        setError('Объявление не найдено');
      } else {
        setError('Ошибка при загрузке объявления');
      }
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async () => {
    if (!id) return;
    
    const adId = parseInt(id, 10);
    if (isNaN(adId)) {
      setError('Неверный ID объявления');
      return;
    }
    
    try {
      setLoading(true);
      await adsAPI.approveAd(adId, abortControllerRef.current?.signal);
      // Обновляю историю модерации
      await loadAd();
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      setError('Ошибка при одобрении объявления');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectClick = () => {
    setRejectModalVisible(true);
    setRejectReason(null);
    setRejectOtherText('');
  };

  const handleRejectSubmit = async () => {
    if (!rejectReason) {
      return;
    }

    let reasonText = rejectReason;
    if (rejectReason === 'Другое') {
      if (!rejectOtherText.trim()) {
        return;
      }
      reasonText = rejectOtherText.trim();
    }

    if (!id) return;
    
    const adId = parseInt(id, 10);
    if (isNaN(adId)) {
      setError('Неверный ID объявления');
      return;
    }
    
    try {
      setLoading(true);
      setRejectModalVisible(false);
      await adsAPI.rejectAd(adId, reasonText, 'Объявление отклонено модератором', abortControllerRef.current?.signal);
      await loadAd();
      setRejectReason(null);
      setRejectOtherText('');
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      setError('Ошибка при отклонении объявления');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectCancel = () => {
    setRejectModalVisible(false);
    setRejectReason(null);
    setRejectOtherText('');
  };

  const handleRequestChanges = async () => {
    if (!id) return;
    
    const adId = parseInt(id, 10);
    if (isNaN(adId)) {
      setError('Неверный ID объявления');
      return;
    }
    
    try {
      setLoading(true);
      await adsAPI.requestChanges(adId, 'Требуются изменения', 'Необходимо внести изменения в объявление', abortControllerRef.current?.signal);
      await loadAd();
    } catch (err: unknown) {
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      setError('Ошибка при запросе изменений');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Загрузка объявления...</div>
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
        action={
          <Button onClick={() => navigate('/list')}>
            Вернуться к списку
          </Button>
        }
      />
    );
  }

  if (!ad) {
    return null;
  }

  const statusConfig = getStatusConfig(ad.status);
  const images = ad.images || [];
  const characteristics = ad.characteristics || {};
  const seller = ad.seller;
  const moderationHistory = ad.moderationHistory || [];

  // Подготовка данных для таблицы
  const characteristicsData = Object.entries(characteristics).map(([key, value]) => ({
    key,
    name: key,
    value: value
  }));

  const characteristicsColumns = [
    {
      title: 'Характеристика',
      dataIndex: 'name',
      key: 'name',
      width: '50%',
    },
    {
      title: 'Значение',
      dataIndex: 'value',
      key: 'value',
    },
  ];

  const handlePrevious = () => {
    if (currentIndex > 0) {
      const prevId = allAdsIds[currentIndex - 1];
      navigate(`/item/${prevId}`, { state: { adsIds: allAdsIds } });
    }
  };

  const handleNext = () => {
    if (currentIndex >= 0 && currentIndex < allAdsIds.length - 1) {
      const nextId = allAdsIds[currentIndex + 1];
      navigate(`/item/${nextId}`, { state: { adsIds: allAdsIds } });
    }
  };

  return (
    <div>

      <Title level={2} style={{ marginBottom: 24 }}>
        {ad.title}
      </Title>

      <Row gutter={[24, 24]}>
        {/* Галерея изображений */}
        <Col xs={24} md={12}>
          <Card 
            title={
              <Space>
                <PictureOutlined />
                <span>Галерея ({images.length} изображения)</span>
              </Space>
            }
            style={{ height: '100%' }}
          >
            {images.length > 0 ? (
              <div>
                <div style={{ marginBottom: 16, textAlign: 'center' }}>
                  <div
                    style={{
                      width: '100%',
                      height: '400px',
                      border: '1px solid #d9d9d9',
                      borderRadius: 4,
                      overflow: 'hidden',
                      backgroundColor: '#f5f5f5',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#999'
                    }}
                  >
                    <PictureOutlined style={{ fontSize: 64, marginBottom: 16 }} />
                    <div style={{ fontSize: 16, textAlign: 'center', padding: '0 16px' }}>
                      Изображение {ad.id}-{selectedImageIndex + 1}
                    </div>
                  </div>
                </div>
                {images.length > 1 && (
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {images.map((img, index) => (
                      <div
                        key={index}
                        onClick={() => setSelectedImageIndex(index)}
                        style={{
                          width: 80,
                          height: 80,
                          border: selectedImageIndex === index ? '2px solid #1890ff' : '1px solid #d9d9d9',
                          borderRadius: 4,
                          overflow: 'hidden',
                          cursor: 'pointer',
                          backgroundColor: '#f5f5f5',
                          display: 'flex',
                          flexDirection: 'column',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#999',
                          fontSize: 12
                        }}
                      >
                        <PictureOutlined style={{ fontSize: 24, marginBottom: 4 }} />
                        <div>{index + 1}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                <PictureOutlined style={{ fontSize: 48, marginBottom: 16 }} />
                <div>Изображения отсутствуют</div>
              </div>
            )}
          </Card>
        </Col>

        {/* История модерации */}
        <Col xs={24} md={12}>
          <Card 
            title={
              <Space>
                <FileTextOutlined />
                <span>История модерации</span>
              </Space>
            }
            style={{ 
              height: '100%', 
              backgroundColor: isDark ? token.colorBgElevated : '#fffbe6' 
            }}
          >
            {moderationHistory.length > 0 ? (
              <div>
                <Title level={5} style={{ marginBottom: 16 }}>
                  Список всех действий с объявлением
                </Title>
                {moderationHistory.map((item, index) => {
                  const actionConfig = getActionConfig(item.action);
                  return (
                    <div 
                      key={item.id || index} 
                      style={{ 
                        marginBottom: index < moderationHistory.length - 1 ? 20 : 0
                      }}
                    >
                      <Space direction="vertical" size={8} style={{ width: '100%' }}>
                        {/* Кто проверял */}
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Модератор:</Text>
                          <div>
                            <Text strong>{item.moderatorName || 'Неизвестно'}</Text>
                          </div>
                        </div>
                        
                        {/* Когда */}
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Дата и время:</Text>
                          <div>
                            <Text>{formatDateTime(item.timestamp)}</Text>
                          </div>
                        </div>
                        
                        {/* Какое решение принял */}
                        <div>
                          <Text type="secondary" style={{ fontSize: 12 }}>Решение:</Text>
                          <div>
                            <Tag 
                              color={actionConfig.color} 
                              style={{
                                fontSize: 13,
                                ...(actionConfig.text === 'Одобрено' ? getApprovedTagStyle() : {})
                              }}
                            >
                              {actionConfig.icon} {actionConfig.text}
                            </Tag>
                          </div>
                        </div>
                        
                        {/* Причина */}
                        {item.action === 'rejected' && item.reason && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>Причина:</Text>
                            <div>
                              <Text>{item.reason}</Text>
                            </div>
                          </div>
                        )}
                        
                        {/* Комментарий */}
                        {item.comment && (
                          <div>
                            <Text type="secondary" style={{ fontSize: 12 }}>Комментарий:</Text>
                            <div>
                              <Text>{item.comment}</Text>
                            </div>
                          </div>
                        )}
                      </Space>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '20px', color: '#999' }}>
                <Text type="secondary">История модерации отсутствует</Text>
              </div>
            )}
          </Card>
        </Col>

        {/* Полное описание */}
        <Col xs={24}>
          <Card 
            title={
              <Space>
                <FileTextOutlined />
                <span>Полное описание</span>
              </Space>
            }
          >
            <Space direction="vertical" size={16} style={{ width: '100%' }}>
              <div>
                <Title level={4}>Описание</Title>
                <Paragraph>{ad.description || 'Описание отсутствует'}</Paragraph>
              </div>

              <div>
                <Title level={4}>Характеристики</Title>
                {characteristicsData.length > 0 ? (
                  <Table
                    dataSource={characteristicsData}
                    columns={characteristicsColumns}
                    pagination={false}
                    size="small"
                    style={{ marginTop: 16 }}
                  />
                ) : (
                  <Text type="secondary">Характеристики отсутствуют</Text>
                )}
              </div>

              <div>
                <Title level={4}>Информация о продавце</Title>
                <Descriptions bordered size="small" column={1}>
                  <Descriptions.Item 
                    label={
                      <Space>
                        <UserOutlined />
                        <span>Имя</span>
                      </Space>
                    }
                  >
                    {seller?.name || 'Не указано'}
                  </Descriptions.Item>
                  <Descriptions.Item 
                    label={
                      <Space>
                        <StarOutlined />
                        <span>Рейтинг</span>
                      </Space>
                    }
                  >
                    {seller?.rating ? `${seller.rating} / 5.0` : 'Не указано'}
                  </Descriptions.Item>
                  <Descriptions.Item 
                    label={
                      <Space>
                        <AppstoreOutlined />
                        <span>Количество объявлений</span>
                      </Space>
                    }
                  >
                    {seller?.totalAds || 0}
                  </Descriptions.Item>
                  <Descriptions.Item 
                    label={
                      <Space>
                        <CalendarOutlined />
                        <span>Дата регистрации</span>
                      </Space>
                    }
                  >
                    {seller?.registeredAt 
                      ? `${formatDate(seller.registeredAt)} (На сайте: ${formatDateShort(seller.registeredAt)})`
                      : 'Не указано'
                    }
                  </Descriptions.Item>
                </Descriptions>
              </div>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* Панель действий модератора */}
      <div style={{ marginTop: 32, textAlign: 'center' }}>
        <Space size="middle">
          <Button
            type="primary"
            size="large"
            icon={<CheckOutlined />}
            onClick={handleApprove}
            loading={loading}
            style={{ 
              backgroundColor: '#4caf50', 
              borderColor: '#4caf50',
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            Одобрить
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<CloseOutlined />}
            onClick={handleRejectClick}
            loading={loading}
            danger
            style={{ 
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            Отклонить
          </Button>
          <Button
            type="primary"
            size="large"
            icon={<ReloadOutlined />}
            onClick={handleRequestChanges}
            loading={loading}
            style={{ 
              backgroundColor: '#faad14', 
              borderColor: '#faad14',
              height: 48,
              fontSize: 16,
              fontWeight: 500,
              paddingLeft: 24,
              paddingRight: 24
            }}
          >
            Вернуть на доработку
          </Button>
        </Space>
      </div>

      {/* Навигация */}
      <div style={{ marginTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Button 
          icon={<ArrowLeftOutlined />} 
          onClick={() => navigate('/list')}
        >
          Назад к списку
        </Button>
        <Space>
          <Button
            icon={<LeftOutlined />}
            onClick={handlePrevious}
            disabled={currentIndex <= 0}
          >
            Предыдущее
          </Button>
          <span>|</span>
          <Button
            icon={<RightOutlined />}
            onClick={handleNext}
            disabled={currentIndex < 0 || currentIndex >= allAdsIds.length - 1}
          >
            Следующее
          </Button>
        </Space>
      </div>

      {/* Модальное окно для отклонения */}
      <Modal
        title="Отклонение"
        open={rejectModalVisible}
        onOk={handleRejectSubmit}
        onCancel={handleRejectCancel}
        okText="Отправить"
        cancelButtonProps={{ style: { display: 'none' } }}
        okButtonProps={{ 
          danger: true,
          disabled: !rejectReason || (rejectReason === 'Другое' && !rejectOtherText.trim()),
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
          <Text strong style={{ fontSize: 16 }}>Причина:</Text>
        </div>
        <Radio.Group 
          value={rejectReason} 
          onChange={(e) => setRejectReason(e.target.value)}
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
        {rejectReason === 'Другое' && (
          <Input
            placeholder="Укажите причину отклонения"
            value={rejectOtherText}
            onChange={(e) => setRejectOtherText(e.target.value)}
            style={{ marginTop: 12 }}
          />
        )}
      </Modal>
    </div>
  );
}

export default AdDetailPage;