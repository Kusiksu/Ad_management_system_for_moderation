import { useState, useEffect, useRef } from 'react';
import { 
  Typography, 
  Card, 
  Row, 
  Col, 
  Spin, 
  Alert,
  Radio,
  Space,
  theme,
  Button
} from 'antd';
import { 
  CheckCircleOutlined, 
  CloseCircleOutlined, 
  ClockCircleOutlined,
  BarChartOutlined,
  PieChartOutlined,
  DownloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

// Расширяю типы jsPDF для поддержки autoTable
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => void;
    lastAutoTable: {
      finalY: number;
    };
  }
}
import { statsAPI } from '../api/api';
import { useTheme as useCustomTheme } from '../contexts/ThemeContext';
import { formatTime, formatTimeForPDF, transliterate } from '../utils/formatters';
import type { Summary, ActivityChartItem, DecisionsChart, CategoriesChart } from '../types/api';

const { Title, Text } = Typography;

function StatsPage() {
  const { token } = theme.useToken();
  const { isDark } = useCustomTheme();
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('today');
  const [summary, setSummary] = useState<Summary | null>(null);
  const [activityChart, setActivityChart] = useState<ActivityChartItem[]>([]);
  const [decisionsChart, setDecisionsChart] = useState<DecisionsChart | null>(null);
  const [categoriesChart, setCategoriesChart] = useState<CategoriesChart>({});
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    loadStats();
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [period]);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);

      const params: { period: 'today' | 'week' | 'month' } = { period };

      const [summaryRes, activityRes, decisionsRes, categoriesRes] = await Promise.all([
        statsAPI.getSummary(params, abortControllerRef.current?.signal),
        statsAPI.getActivityChart(params, abortControllerRef.current?.signal),
        statsAPI.getDecisionsChart(params, abortControllerRef.current?.signal),
        statsAPI.getCategoriesChart(params, abortControllerRef.current?.signal)
      ]);

      setSummary(summaryRes.data);
      
      // Фильтрую данные графика активности для периода "today"
      let filteredActivityChart = activityRes.data || [];
      if (period === 'today') {
        const today = new Date().toISOString().split('T')[0];
        filteredActivityChart = filteredActivityChart.filter(item => item.date === today);
      }
      
      setActivityChart(filteredActivityChart);
      setDecisionsChart(decisionsRes.data);
      setCategoriesChart(categoriesRes.data || {});
    } catch (err: unknown) {
      // Игнор ошибок
      if (err instanceof Error && (err.name === 'AbortError' || err.name === 'CanceledError')) {
        return;
      }
      setError('Ошибка при загрузке статистики');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };


  const getTotalReviewed = () => {
    if (!summary) return 0;
    if (period === 'today') return summary.totalReviewedToday || 0;
    if (period === 'week') return summary.totalReviewedThisWeek || 0;
    if (period === 'month') return summary.totalReviewedThisMonth || 0;
    return summary.totalReviewed || 0;
  };

  // Экспорт статистики в CSV
  const exportToCSV = async () => {
    if (!summary) return;

    const date = new Date().toLocaleDateString('ru-RU');
    let csvContent = '\uFEFF'; // корректное отображение кириллицы
    
    csvContent += 'ОТЧЁТ ПО СТАТИСТИКЕ МОДЕРАЦИИ\n';
    csvContent += `Дата экспорта: ${date}\n\n`;

    // Данные за все периоды
    const periods = [
      { key: 'today', label: 'Сегодня' },
      { key: 'week', label: '7 дней' },
      { key: 'month', label: '30 дней' }
    ];

    const allPeriodsData: Array<{
      period: string;
      summary: Summary;
      activity: ActivityChartItem[];
      categories: CategoriesChart;
      totalReviewed: number;
    }> = [];
    
    for (const periodItem of periods) {
      try {
        const params: { period: 'today' | 'week' | 'month' } = { period: periodItem.key as 'today' | 'week' | 'month' };
        const [summaryRes, activityRes, decisionsRes, categoriesRes] = await Promise.all([
          statsAPI.getSummary(params, abortControllerRef.current?.signal),
          statsAPI.getActivityChart(params, abortControllerRef.current?.signal),
          statsAPI.getDecisionsChart(params, abortControllerRef.current?.signal),
          statsAPI.getCategoriesChart(params, abortControllerRef.current?.signal)
        ]);

        const periodSummary = summaryRes.data;
        let periodActivity = activityRes.data || [];
        if (periodItem.key === 'today') {
          const today = new Date().toISOString().split('T')[0];
          periodActivity = periodActivity.filter(item => item.date === today);
        }

        const totalReviewed = periodItem.key === 'today' 
          ? periodSummary.totalReviewedToday || 0
          : periodItem.key === 'week'
          ? periodSummary.totalReviewedThisWeek || 0
          : periodSummary.totalReviewedThisMonth || 0;

        allPeriodsData.push({
          period: periodItem.label,
          summary: periodSummary,
          activity: periodActivity,
          categories: categoriesRes.data || {},
          totalReviewed
        });
      } catch (err: unknown) {
        console.error(`Ошибка загрузки данных за период ${periodItem.label}:`, err);
      }
    }

    // Метрики
    csvContent += '═══════════════════════════════════════════════════════════════\n';
    csvContent += 'ОСНОВНЫЕ МЕТРИКИ\n';
    csvContent += '═══════════════════════════════════════════════════════════════\n\n';
    
    // Заголовки таблицы
    csvContent += 'Период,Проверено объявлений,Одобрено (%),Отклонено (%),На доработку (%),Среднее время проверки\n';
    
    // Данные по каждому
    allPeriodsData.forEach(item => {
      const row = [
        (item.period + '                          ').substring(0, 30),
        item.totalReviewed.toString(),
        `${(item.summary.approvedPercentage || 0).toFixed(1)}%`,
        `${(item.summary.rejectedPercentage || 0).toFixed(1)}%`,
        `${(item.summary.requestChangesPercentage || 0).toFixed(1)}%`,
        formatTime(item.summary.averageReviewTime || 0)
      ];
      csvContent += row.join(',') + '\n';
    });

    csvContent += '\n';

    // График активности по дням
    allPeriodsData.forEach(item => {
      if (item.activity.length > 0) {
        csvContent += '═══════════════════════════════════════════════════════════════\n';
        csvContent += `ГРАФИК АКТИВНОСТИ ПО ДНЯМ (${item.period})\n`;
        csvContent += '═══════════════════════════════════════════════════════════════\n';
        csvContent += 'Дата,Одобрено (шт),Отклонено (шт),На доработку (шт),Всего (шт)\n';
        
        item.activity.forEach(activityItem => {
          const total = activityItem.approved + activityItem.rejected + activityItem.requestChanges;
          const formattedDate = activityItem.date.replace(/-/g, '.');
          csvContent += `${(formattedDate + '                    ').substring(0, 22)},${activityItem.approved},${activityItem.rejected},${activityItem.requestChanges},${total}\n`;
        });
        csvContent += '\n';
      }
    });

    // График по категориям
    allPeriodsData.forEach(item => {
      const categoriesData = Object.entries(item.categories)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      
      if (categoriesData.length > 0) {
        csvContent += '═══════════════════════════════════════════════════════════════\n';
        csvContent += `ГРАФИК ПО КАТЕГОРИЯМ (${item.period})\n`;
        csvContent += '═══════════════════════════════════════════════════════════════\n';
        csvContent += 'Категория                    ,Количество проверенных объявлений\n';
        
        categoriesData.forEach(cat => {
          csvContent += `${(cat.name + '                    ').substring(0, 25)},${cat.value}\n`;
        });
        csvContent += '\n';
      }
    });

    // Скачивание
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `статистика_все_периоды_${date.replace(/\//g, '-')}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Генерация PDF-отчёта
  const generatePDF = async () => {
    if (!summary) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const date = new Date().toLocaleDateString('ru-RU');
    
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;

    // Заголовок с латиницей (jsPDF не поддерживает кириллицу без специальных шрифтов)
    doc.setFontSize(20);
    doc.setFont(undefined, 'bold');
    doc.text('STATISTICS REPORT', pageWidth / 2, yPos, { align: 'center' });
    yPos += 10;

    // Дата экспорта
    doc.setFontSize(12);
    doc.setFont(undefined, 'normal');
    doc.text(`Export date: ${date}`, pageWidth / 2, yPos, { align: 'center' });
    yPos += 15;

    // Загрузка данных
    const periods = [
      { key: 'today', label: 'Сегодня' },
      { key: 'week', label: '7 дней' },
      { key: 'month', label: '30 дней' }
    ];

    const allPeriodsData: Array<{
      period: string;
      summary: Summary;
      activity: ActivityChartItem[];
      categories: CategoriesChart;
      totalReviewed: number;
    }> = [];
    
    for (const periodItem of periods) {
      try {
        const params: { period: 'today' | 'week' | 'month' } = { period: periodItem.key as 'today' | 'week' | 'month' };
        const [summaryRes, activityRes, decisionsRes, categoriesRes] = await Promise.all([
          statsAPI.getSummary(params, abortControllerRef.current?.signal),
          statsAPI.getActivityChart(params, abortControllerRef.current?.signal),
          statsAPI.getDecisionsChart(params, abortControllerRef.current?.signal),
          statsAPI.getCategoriesChart(params, abortControllerRef.current?.signal)
        ]);

        const periodSummary = summaryRes.data;
        let periodActivity = activityRes.data || [];
        if (periodItem.key === 'today') {
          const today = new Date().toISOString().split('T')[0];
          periodActivity = periodActivity.filter(item => item.date === today);
        }

        const totalReviewed = periodItem.key === 'today' 
          ? periodSummary.totalReviewedToday || 0
          : periodItem.key === 'week'
          ? periodSummary.totalReviewedThisWeek || 0
          : periodSummary.totalReviewedThisMonth || 0;

        allPeriodsData.push({
          period: periodItem.label,
          summary: periodSummary,
          activity: periodActivity,
          categories: categoriesRes.data || {},
          totalReviewed
        });
      } catch (err: unknown) {
        console.error(`Ошибка загрузки данных за период ${periodItem.label}:`, err);
      }
    }

    doc.setFontSize(16);
    doc.setFont(undefined, 'bold');
    doc.text('MAIN METRICS', margin, yPos);
    yPos += 10;

    const metricsData = allPeriodsData.map(item => {
      const periodLabel = item.period === 'Сегодня' ? 'Today' : 
                          item.period === '7 дней' ? '7 days' : '30 days';
      return [
        periodLabel,
        item.totalReviewed.toString(),
        `${(item.summary.approvedPercentage || 0).toFixed(1)}%`,
        `${(item.summary.rejectedPercentage || 0).toFixed(1)}%`,
        `${(item.summary.requestChangesPercentage || 0).toFixed(1)}%`,
        formatTimeForPDF(item.summary.averageReviewTime || 0)
      ];
    });

    doc.autoTable({
      head: [['Period', 'Reviewed', 'Approved', 'Rejected', 'For revision', 'Avg time']],
      body: metricsData,
      startY: yPos,
      styles: { fontSize: 10 },
      headStyles: { fillColor: [22, 119, 255], textColor: 255, fontStyle: 'bold' },
      margin: { left: margin, right: margin }
    });

    yPos = doc.lastAutoTable.finalY + 15;

    // График активности по дням
    allPeriodsData.forEach(item => {
      if (item.activity.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        const periodLabel = item.period === 'Сегодня' ? 'Today' : 
                           item.period === '7 дней' ? '7 days' : '30 days';
        doc.text(`ACTIVITY BY DAYS (${periodLabel})`, margin, yPos);
        yPos += 10;

        // Использую autoTable для таблицы активности
        const activityData = item.activity.map(activityItem => {
          const total = activityItem.approved + activityItem.rejected + activityItem.requestChanges;
          return [
            activityItem.date,
            activityItem.approved.toString(),
            activityItem.rejected.toString(),
            activityItem.requestChanges.toString(),
            total.toString()
          ];
        });

        doc.autoTable({
          head: [['Date', 'Approved', 'Rejected', 'For revision', 'Total']],
          body: activityData,
          startY: yPos,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [22, 119, 255], textColor: 255, fontStyle: 'bold' },
          margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;
      }
    });

    // График по категориям
    allPeriodsData.forEach(item => {
      const categoriesData = Object.entries(item.categories)
        .map(([name, value]) => ({ name, value }))
        .sort((a, b) => b.value - a.value);
      
      if (categoriesData.length > 0) {
        if (yPos > 250) {
          doc.addPage();
          yPos = 20;
        }

        doc.setFontSize(14);
        doc.setFont(undefined, 'bold');
        const periodLabel = item.period === 'Сегодня' ? 'Today' : 
                           item.period === '7 дней' ? '7 days' : '30 days';
        doc.text(`CATEGORIES (${periodLabel})`, margin, yPos);
        yPos += 10;

        // Используем autoTable для таблицы категорий и транслитерирую названия категорий для корректного отображения в PDF
        const categoriesTableData = categoriesData.map(cat => [
          transliterate(cat.name),
          cat.value.toString()
        ]);

        doc.autoTable({
          head: [['Category', 'Count']],
          body: categoriesTableData,
          startY: yPos,
          styles: { fontSize: 9 },
          headStyles: { fillColor: [22, 119, 255], textColor: 255, fontStyle: 'bold' },
          margin: { left: margin, right: margin }
        });

        yPos = doc.lastAutoTable.finalY + 15;
      }
    });

    // Сохранение PDF
    doc.save(`статистика_все_периоды_${date.replace(/\//g, '-')}.pdf`);
  };

  if (loading && !summary) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>Загрузка статистики...</div>
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
      />
    );
  }

  if (!summary) {
    return null;
  }

  // Подготовка данных для круговой диаграммы
  const decisionsData = decisionsChart || {
    approved: summary.approvedPercentage || 0,
    rejected: summary.rejectedPercentage || 0,
    requestChanges: summary.requestChangesPercentage || 0
  };

  const totalDecisions = decisionsData.approved + decisionsData.rejected + decisionsData.requestChanges;
  const approvedAngle = (decisionsData.approved / totalDecisions) * 360;
  const rejectedAngle = (decisionsData.rejected / totalDecisions) * 360;
  const requestChangesAngle = (decisionsData.requestChanges / totalDecisions) * 360;

  // Подготовка данных для графика по категориям
  const categoriesData = Object.entries(categoriesChart || {}).map(([name, value]) => ({
    name,
    value
  })).sort((a, b) => b.value - a.value);

  const maxCategoryValue = categoriesData.length > 0 ? Math.max(...categoriesData.map(c => c.value)) : 1;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <Title level={2} style={{ margin: 0 }}>
          Статистика
        </Title>
        <Space>
          <Button
            icon={<DownloadOutlined />}
            onClick={exportToCSV}
            disabled={!summary}
          >
            Экспорт в CSV
          </Button>
          <Button
            type="primary"
            icon={<FileTextOutlined />}
            onClick={generatePDF}
            disabled={!summary}
          >
            Скачать PDF
          </Button>
        </Space>
      </div>

      {/* Выбор периода */}
      <Card style={{ 
        marginBottom: 24, 
        backgroundColor: isDark ? token.colorBgElevated : '#fffbe6' 
      }}>
        <Space>
          <Text strong>Период:</Text>
          <Radio.Group 
            value={period} 
            onChange={(e) => setPeriod(e.target.value as 'today' | 'week' | 'month')}
            buttonStyle="solid"
          >
            <Radio.Button value="today">Сегодня</Radio.Button>
            <Radio.Button value="week">7д</Radio.Button>
            <Radio.Button value="month">30д</Radio.Button>
          </Radio.Group>
        </Space>
      </Card>

      {/* Карточки с метриками */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary">Проверено</Text>
              <Title level={3} style={{ margin: 0 }}>
                {getTotalReviewed()}
              </Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary" style={!isDark ? { color: '#4caf50' } : {}}>
                <CheckCircleOutlined style={{ color: isDark ? '#52c41a' : '#4caf50', marginRight: 4 }} />
                Одобрено
              </Text>
              <Title level={3} style={{ margin: 0, color: isDark ? '#52c41a' : '#4caf50' }}>
                {summary.approvedPercentage?.toFixed(1) || 0}%
              </Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary">
                <CloseCircleOutlined style={{ color: '#ff4d4f', marginRight: 4 }} />
                Отклонено
              </Text>
              <Title level={3} style={{ margin: 0, color: '#ff4d4f' }}>
                {summary.rejectedPercentage?.toFixed(1) || 0}%
              </Title>
            </Space>
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Space direction="vertical" size="small" style={{ width: '100%' }}>
              <Text type="secondary">
                <ClockCircleOutlined style={{ marginRight: 4 }} />
                Ср. время
              </Text>
              <Title level={3} style={{ margin: 0 }}>
                {formatTime(summary.averageReviewTime || 0)}
              </Title>
            </Space>
          </Card>
        </Col>
      </Row>

      {/* График активности */}
      <Card 
        title={
          <Space>
            <BarChartOutlined />
            <span>График активности ({period === 'today' ? 'сегодня' : period === 'week' ? '7 дней' : '30 дней'})</span>
          </Space>
        }
        style={{ marginBottom: 24 }}
      >
        {activityChart.length > 0 ? (
          <div style={{ 
            height: 300, 
            display: 'flex', 
            alignItems: 'flex-end', 
            justifyContent: 'space-around', 
            gap: 12,
            padding: '20px 0',
            position: 'relative'
          }}>
            {activityChart.map((item, index) => {
              const total = item.approved + item.rejected + item.requestChanges;
              const maxValue = Math.max(...activityChart.map(i => i.approved + i.rejected + i.requestChanges), 1);
              const heightPercent = maxValue > 0 ? (total / maxValue) * 100 : 0;
              const barHeight = (heightPercent / 100) * 240;
              
              const date = new Date(item.date);
              const dayLabel = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
              
              return (
                <div 
                  key={index} 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center',
                    justifyContent: 'flex-end',
                    height: '100%'
                  }}
                >
                  <div style={{ 
                    position: 'relative',
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    height: '100%',
                    justifyContent: 'flex-end'
                  }}>
                    {total > 0 && (
                      <Text 
                        style={{ 
                          fontSize: 14, 
                          fontWeight: 'bold',
                          color: isDark ? token.colorText : '#000',
                          marginBottom: 4,
                          position: 'absolute',
                          top: `${240 - barHeight - 20}px`
                        }}
                      >
                        {total}
                      </Text>
                    )}
                    <div style={{ 
                      width: '100%', 
                      height: `${barHeight}px`, 
                      backgroundColor: isDark ? '#1677ff' : '#4caf50',
                      borderRadius: '4px 4px 0 0',
                      minHeight: total > 0 ? '4px' : '0',
                      transition: 'height 0.3s'
                    }} />
                  </div>
                  <Text style={{ fontSize: 12, marginTop: 8, color: '#666' }}>{dayLabel}</Text>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
            Нет данных за выбранный период
          </div>
        )}
      </Card>

      <Row gutter={[16, 16]}>
        {/* Круговая диаграмма распределения решений */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <PieChartOutlined />
                <span>Распределение решений</span>
              </Space>
            }
            style={{ marginBottom: 24 }}
          >
            {totalDecisions > 0 ? (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 40 }}>
                <div style={{ position: 'relative', width: 200, height: 200 }}>
                  <svg width="200" height="200" viewBox="0 0 200 200" style={{ transform: 'rotate(-90deg)' }}>
                    <circle
                      cx="100"
                      cy="100"
                      r="80"
                      fill="none"
                      stroke="#f0f0f0"
                      strokeWidth="40"
                    />
                    {approvedAngle > 0 && (
                      <circle
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke="#52c41a"
                        strokeWidth="40"
                        strokeDasharray={`${approvedAngle * 2 * Math.PI * 80 / 360} ${2 * Math.PI * 80}`}
                        strokeDashoffset="0"
                      />
                    )}
                    {rejectedAngle > 0 && (
                      <circle
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke="#ff4d4f"
                        strokeWidth="40"
                        strokeDasharray={`${rejectedAngle * 2 * Math.PI * 80 / 360} ${2 * Math.PI * 80}`}
                        strokeDashoffset={`-${approvedAngle * 2 * Math.PI * 80 / 360}`}
                      />
                    )}
                    {requestChangesAngle > 0 && (
                      <circle
                        cx="100"
                        cy="100"
                        r="80"
                        fill="none"
                        stroke="#faad14"
                        strokeWidth="40"
                        strokeDasharray={`${requestChangesAngle * 2 * Math.PI * 80 / 360} ${2 * Math.PI * 80}`}
                        strokeDashoffset={`-${(approvedAngle + rejectedAngle) * 2 * Math.PI * 80 / 360}`}
                      />
                    )}
                  </svg>
                </div>
                <div>
                  <Space direction="vertical" size="middle">
                    <div>
                      <Space>
                        <div style={{ width: 16, height: 16, backgroundColor: isDark ? '#52c41a' : '#4caf50', borderRadius: 2 }} />
                        <Text style={!isDark ? { color: '#4caf50' } : {}}>Одобрено: {decisionsData.approved.toFixed(1)}%</Text>
                      </Space>
                    </div>
                    <div>
                      <Space>
                        <div style={{ width: 16, height: 16, backgroundColor: '#ff4d4f', borderRadius: 2 }} />
                        <Text>Отклонено: {decisionsData.rejected.toFixed(1)}%</Text>
                      </Space>
                    </div>
                    <div>
                      <Space>
                        <div style={{ width: 16, height: 16, backgroundColor: '#faad14', borderRadius: 2 }} />
                        <Text>На доработку: {decisionsData.requestChanges.toFixed(1)}%</Text>
                      </Space>
                    </div>
                  </Space>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Нет данных
              </div>
            )}
          </Card>
        </Col>

        {/* График по категориям */}
        <Col xs={24} lg={12}>
          <Card 
            title={
              <Space>
                <BarChartOutlined />
                <span>Распределение решений</span>
                <Text type="secondary" style={{ fontSize: 14 }}>Категории объявлений</Text>
              </Space>
            }
          >
            {categoriesData.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {categoriesData.map((item, index) => {
                  const width = maxCategoryValue > 0 ? (item.value / maxCategoryValue) * 100 : 0;
                  return (
                    <div key={index}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                        <Text>{item.name}</Text>
                        <Text strong>{item.value}</Text>
                      </div>
                      <div style={{ 
                        width: '100%', 
                        height: 24, 
                        backgroundColor: '#f0f0f0', 
                        borderRadius: 4,
                        overflow: 'hidden'
                      }}>
                        <div style={{ 
                          width: `${width}%`, 
                          height: '100%', 
                          backgroundColor: '#6287bd',
                          transition: 'width 0.3s'
                        }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '40px', color: '#999' }}>
                Нет данных
              </div>
            )}
          </Card>
        </Col>
      </Row>
    </div>
  );
}

export default StatsPage;

