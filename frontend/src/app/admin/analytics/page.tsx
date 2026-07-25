'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Card, Row, Col, Statistic, Select, DatePicker, Button, Table, Space,
  message, Tabs, Progress, Tag,
} from 'antd';
import {
  ArrowUpOutlined, ArrowDownOutlined, ExportOutlined, ReloadOutlined,
  DollarOutlined, ShoppingCartOutlined, BarChartOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { Option } = Select;

interface RevenueData {
  total_revenue: number;
  daily_data: { date: string; revenue: number }[];
}

interface OrderCountData {
  total_orders: number;
  daily_data: { date: string; count: number }[];
}

interface TopProduct {
  product_id: number;
  product_name: string;
  quantity: number;
  revenue: number;
}

interface FunnelData {
  homepage_views: number;
  product_views: number;
  add_to_cart_events: number;
  checkout_starts: number;
  orders_completed: number;
  conversion_rates: Record<string, number>;
}

interface PaymentDistribution {
  method: string;
  count: number;
  percentage: number;
}

interface StatusDistribution {
  status: string;
  count: number;
  percentage: number;
}

export default function AdminAnalyticsPage() {
  const [period, setPeriod] = useState('7d');
  const [revenue, setRevenue] = useState<RevenueData | null>(null);
  const [orderCount, setOrderCount] = useState<OrderCountData | null>(null);
  const [aov, setAov] = useState<number>(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [topByRevenue, setTopByRevenue] = useState<TopProduct[]>([]);
  const [funnel, setFunnel] = useState<FunnelData | null>(null);
  const [paymentDist, setPaymentDist] = useState<PaymentDistribution[]>([]);
  const [statusDist, setStatusDist] = useState<StatusDistribution[]>([]);
  const [loading, setLoading] = useState(false);

  const getPeriodParams = useCallback(() => {
    const now = new Date();
    let start: Date;
    switch (period) {
      case '1d':
        start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case '30d':
        start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default: // 7d
        start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
    return {
      start_date: start.toISOString().split('T')[0],
      end_date: now.toISOString().split('T')[0],
    };
  }, [period]);

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    const params = getPeriodParams();
    try {
      const [revenueRes, ordersRes, aovRes, topQtyRes, topRevRes, funnelRes, payDistRes, statusDistRes] =
        await Promise.allSettled([
          apiClient.get('/admin/analytics/revenue', { params }),
          apiClient.get('/admin/analytics/orders', { params }),
          apiClient.get('/admin/analytics/aov', { params }),
          apiClient.get('/admin/analytics/products/top-quantity', { params: { ...params, limit: 10 } }),
          apiClient.get('/admin/analytics/products/top-revenue', { params: { ...params, limit: 10 } }),
          apiClient.get('/admin/analytics/funnel', { params }),
          apiClient.get('/admin/analytics/payment-distribution', { params }),
          apiClient.get('/admin/analytics/status-distribution', { params }),
        ]);

      if (revenueRes.status === 'fulfilled') setRevenue(revenueRes.value.data.data);
      if (ordersRes.status === 'fulfilled') setOrderCount(ordersRes.value.data.data);
      if (aovRes.status === 'fulfilled') setAov(aovRes.value.data.data?.average_order_value || 0);
      if (topQtyRes.status === 'fulfilled') setTopProducts(topQtyRes.value.data.data || []);
      if (topRevRes.status === 'fulfilled') setTopByRevenue(topRevRes.value.data.data || []);
      if (funnelRes.status === 'fulfilled') setFunnel(funnelRes.value.data.data);
      if (payDistRes.status === 'fulfilled') setPaymentDist(payDistRes.value.data.data || []);
      if (statusDistRes.status === 'fulfilled') setStatusDist(statusDistRes.value.data.data || []);
    } catch {
      message.error('获取分析数据失败');
    } finally {
      setLoading(false);
    }
  }, [getPeriodParams]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = async () => {
    try {
      const params = getPeriodParams();
      const res = await apiClient.get('/admin/analytics/export', { params, responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `analytics_${period}_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const topProductColumns: ColumnsType<TopProduct> = [
    { title: '排名', key: 'rank', render: (_, __, index) => index + 1, width: 60 },
    { title: '商品名称', dataIndex: 'product_name', key: 'product_name' },
    { title: '销量', dataIndex: 'quantity', key: 'quantity' },
    { title: '收入', dataIndex: 'revenue', key: 'revenue', render: (v: number) => `¥${v?.toFixed(2)}` },
  ];

  const statusLabels: Record<string, string> = {
    pending_payment: '待支付',
    pending_transfer: '待确认转账',
    paid: '已支付',
    pending_shipment: '待发货',
    shipped: '已发货',
    completed: '已完成',
    cancelled: '已取消',
    payment_failed: '支付失败',
  };

  const tabItems = [
    {
      key: 'overview',
      label: '销售概览',
      children: (
        <div>
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="总收入"
                  value={revenue?.total_revenue || 0}
                  prefix={<DollarOutlined />}
                  precision={2}
                  suffix="元"
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="订单数"
                  value={orderCount?.total_orders || 0}
                  prefix={<ShoppingCartOutlined />}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card>
                <Statistic
                  title="平均订单价值"
                  value={aov}
                  prefix={<BarChartOutlined />}
                  precision={2}
                  suffix="元"
                />
              </Card>
            </Col>
          </Row>

          {/* Revenue daily data as simple table */}
          {revenue?.daily_data && revenue.daily_data.length > 0 && (
            <Card title="每日收入" className="mt-4">
              <Table
                size="small"
                pagination={false}
                dataSource={revenue.daily_data.slice(-14)}
                rowKey="date"
                columns={[
                  { title: '日期', dataIndex: 'date', key: 'date', render: (v: string) => v?.split('T')[0] },
                  { title: '收入', dataIndex: 'revenue', key: 'revenue', render: (v: number) => `¥${v?.toFixed(2)}` },
                ]}
              />
            </Card>
          )}
        </div>
      ),
    },
    {
      key: 'products',
      label: '热门产品',
      children: (
        <Row gutter={[16, 16]}>
          <Col xs={24} lg={12}>
            <Card title="销量 Top 10">
              <Table
                size="small"
                pagination={false}
                dataSource={topProducts}
                rowKey="product_id"
                columns={topProductColumns}
              />
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="收入 Top 10">
              <Table
                size="small"
                pagination={false}
                dataSource={topByRevenue}
                rowKey="product_id"
                columns={topProductColumns}
              />
            </Card>
          </Col>
        </Row>
      ),
    },
    {
      key: 'funnel',
      label: '转化漏斗',
      children: (
        <div>
          {funnel && (
            <Card title="转化漏斗">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span>首页访问</span>
                  <span className="font-semibold">{funnel.homepage_views}</span>
                </div>
                <Progress percent={100} showInfo={false} />

                <div className="flex items-center justify-between">
                  <span>商品浏览</span>
                  <span className="font-semibold">{funnel.product_views}</span>
                </div>
                <Progress
                  percent={funnel.homepage_views ? Math.round((funnel.product_views / funnel.homepage_views) * 100) : 0}
                  showInfo
                />

                <div className="flex items-center justify-between">
                  <span>加入购物车</span>
                  <span className="font-semibold">{funnel.add_to_cart_events}</span>
                </div>
                <Progress
                  percent={funnel.homepage_views ? Math.round((funnel.add_to_cart_events / funnel.homepage_views) * 100) : 0}
                  showInfo
                />

                <div className="flex items-center justify-between">
                  <span>开始结算</span>
                  <span className="font-semibold">{funnel.checkout_starts}</span>
                </div>
                <Progress
                  percent={funnel.homepage_views ? Math.round((funnel.checkout_starts / funnel.homepage_views) * 100) : 0}
                  showInfo
                />

                <div className="flex items-center justify-between">
                  <span>完成订单</span>
                  <span className="font-semibold">{funnel.orders_completed}</span>
                </div>
                <Progress
                  percent={funnel.homepage_views ? Math.round((funnel.orders_completed / funnel.homepage_views) * 100) : 0}
                  showInfo
                  status="success"
                />
              </div>
            </Card>
          )}

          <Row gutter={[16, 16]} className="mt-4">
            <Col xs={24} lg={12}>
              <Card title="支付方式分布">
                {paymentDist.map((item) => (
                  <div key={item.method} className="flex justify-between items-center mb-2">
                    <span>{item.method === 'online' ? '在线支付' : '转账支付'}</span>
                    <Space>
                      <span>{item.count} 笔</span>
                      <Tag>{item.percentage?.toFixed(1)}%</Tag>
                    </Space>
                  </div>
                ))}
              </Card>
            </Col>
            <Col xs={24} lg={12}>
              <Card title="订单状态分布">
                {statusDist.map((item) => (
                  <div key={item.status} className="flex justify-between items-center mb-2">
                    <span>{statusLabels[item.status] || item.status}</span>
                    <Space>
                      <span>{item.count} 笔</span>
                      <Tag>{item.percentage?.toFixed(1)}%</Tag>
                    </Space>
                  </div>
                ))}
              </Card>
            </Col>
          </Row>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">数据分析</h2>
        <Space>
          <Select value={period} onChange={setPeriod} style={{ width: 120 }}>
            <Option value="1d">今天</Option>
            <Option value="7d">近 7 天</Option>
            <Option value="30d">近 30 天</Option>
            <Option value="90d">近 90 天</Option>
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchAnalytics} loading={loading}>
            刷新
          </Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>
            导出 CSV
          </Button>
        </Space>
      </div>

      <Tabs items={tabItems} />
    </div>
  );
}
