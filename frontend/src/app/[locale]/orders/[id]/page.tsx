'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Card,
  Tag,
  Button,
  Timeline,
  Descriptions,
  Table,
  Spin,
  message,
  Modal,
  Empty,
} from 'antd';
import {
  ClockCircleOutlined,
  CheckCircleOutlined,
  CarOutlined,
  CloseCircleOutlined,
  DollarOutlined,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import type { Order, OrderStatus, OrderItem } from '@/types';

/**
 * Order detail page with status timeline, items, and cancel button.
 *
 * Requirements:
 * - 7.7: Return order details including all order items and current status
 * - 24.1: Cancel orders with status "pending_payment"
 * - 24.2: Cancel orders with status "pending_transfer"
 * - 24.4: Prevent cancellation of shipped or completed orders
 */

const ORDER_STATUS_MAP: Record<OrderStatus, { label: string; color: string }> = {
  pending_payment: { label: '待支付', color: 'orange' },
  pending_transfer: { label: '待确认转账', color: 'gold' },
  paid: { label: '已支付', color: 'blue' },
  pending_shipment: { label: '待发货', color: 'cyan' },
  shipped: { label: '已发货', color: 'geekblue' },
  completed: { label: '已完成', color: 'green' },
  cancelled: { label: '已取消', color: 'default' },
  payment_failed: { label: '支付失败', color: 'red' },
};

const STATUS_TIMELINE: OrderStatus[] = [
  'pending_payment',
  'paid',
  'pending_shipment',
  'shipped',
  'completed',
];

function getTimelineIcon(status: OrderStatus) {
  switch (status) {
    case 'pending_payment':
    case 'pending_transfer':
      return <ClockCircleOutlined />;
    case 'paid':
      return <DollarOutlined />;
    case 'pending_shipment':
      return <CheckCircleOutlined />;
    case 'shipped':
      return <CarOutlined />;
    case 'completed':
      return <CheckCircleOutlined />;
    case 'cancelled':
    case 'payment_failed':
      return <CloseCircleOutlined />;
    default:
      return <ClockCircleOutlined />;
  }
}

function getTimelineColor(currentStatus: OrderStatus, timelineStatus: OrderStatus): string {
  const currentIndex = STATUS_TIMELINE.indexOf(currentStatus);
  const timelineIndex = STATUS_TIMELINE.indexOf(timelineStatus);

  if (currentStatus === 'cancelled' || currentStatus === 'payment_failed') {
    return 'gray';
  }

  if (timelineIndex <= currentIndex) {
    return 'green';
  }
  return 'gray';
}

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) {
      router.push(`/login?redirect=/orders/${orderId}`);
    }
  }, [mounted, authLoading, isAuthenticated, router, orderId]);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ data: Order }>(`/orders/${orderId}`);
      setOrder(response.data.data);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        router.push(`/login?redirect=/orders/${orderId}`);
      } else if (err?.response?.status === 404) {
        message.error('订单不存在');
      } else {
        message.error('获取订单详情失败');
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, router]);

  useEffect(() => {
    if (mounted && isAuthenticated && orderId) {
      fetchOrder();
    }
  }, [mounted, isAuthenticated, orderId, fetchOrder]);

  const canCancel = (status: OrderStatus): boolean => {
    return status === 'pending_payment' || status === 'pending_transfer';
  };

  const handleCancel = () => {
    Modal.confirm({
      title: '确认取消订单',
      icon: <ExclamationCircleOutlined />,
      content: '取消后订单将无法恢复，确定要取消吗？',
      okText: '确认取消',
      cancelText: '暂不取消',
      okButtonProps: { danger: true },
      onOk: async () => {
        setCancelling(true);
        try {
          await apiClient.post(`/orders/${orderId}/cancel`);
          message.success('订单已取消');
          fetchOrder();
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: { message?: string } } } };
          const errorMessage = err?.response?.data?.error?.message || '取消订单失败';
          message.error(errorMessage);
        } finally {
          setCancelling(false);
        }
      },
    });
  };

  if (!mounted || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载订单详情..." />
      </div>
    );
  }

  if (!order) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Empty description="订单不存在">
          <Link href="/orders">
            <Button type="primary">返回订单列表</Button>
          </Link>
        </Empty>
      </main>
    );
  }

  const statusInfo = ORDER_STATUS_MAP[order.status] || { label: order.status, color: 'default' };

  const itemColumns = [
    {
      title: '商品',
      dataIndex: 'sku_name',
      key: 'sku_name',
      render: (name: string, record: OrderItem) => (
        <div>
          <div className="font-medium">{name}</div>
          {record.attributes && (
            <div className="text-sm text-gray-500">{record.attributes}</div>
          )}
        </div>
      ),
    },
    {
      title: 'SKU编码',
      dataIndex: 'sku_code',
      key: 'sku_code',
      responsive: ['md' as const],
    },
    {
      title: '单价',
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price: number) => `¥${price.toFixed(2)}`,
    },
    {
      title: '数量',
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: '小计',
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (subtotal: number) => (
        <span className="font-medium">¥{subtotal.toFixed(2)}</span>
      ),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href="/orders" className="text-blue-500 hover:text-blue-600 text-sm">
            ← 返回订单列表
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">订单详情</h1>
        </div>
        {canCancel(order.status) && (
          <Button
            danger
            onClick={handleCancel}
            loading={cancelling}
          >
            取消订单
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Order info and items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Basic Info */}
          <Card title="订单信息">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="订单号">
                <span className="font-mono">{order.order_number}</span>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="下单时间">
                {new Date(order.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">
                {order.payment_method === 'online' ? '在线支付' : '转账支付'}
              </Descriptions.Item>
              <Descriptions.Item label="收货地址" span={2}>
                {order.shipping_address}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Order Items */}
          <Card title="商品列表">
            {/* Desktop table */}
            <div className="hidden sm:block">
              <Table
                columns={itemColumns}
                dataSource={order.items}
                rowKey="id"
                pagination={false}
                summary={() => (
                  <Table.Summary>
                    <Table.Summary.Row>
                      <Table.Summary.Cell index={0} colSpan={3}>
                        <span className="font-medium">合计</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <span className="font-bold text-lg">
                          ¥{order.total_amount.toFixed(2)}
                        </span>
                      </Table.Summary.Cell>
                    </Table.Summary.Row>
                  </Table.Summary>
                )}
              />
            </div>

            {/* Mobile card list */}
            <div className="sm:hidden space-y-3">
              {order.items.map((item) => (
                <div key={item.id} className="border rounded-lg p-3">
                  <div className="font-medium">{item.sku_name}</div>
                  {item.attributes && (
                    <div className="text-sm text-gray-500 mt-1">{item.attributes}</div>
                  )}
                  <div className="flex justify-between items-center mt-2">
                    <span className="text-gray-600">
                      ¥{item.unit_price.toFixed(2)} × {item.quantity}
                    </span>
                    <span className="font-medium">¥{item.subtotal.toFixed(2)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-medium">订单总额</span>
                <span className="font-bold text-lg text-red-500">
                  ¥{order.total_amount.toFixed(2)}
                </span>
              </div>
            </div>
          </Card>

          {/* Shipping Info */}
          {(order.shipping_carrier || order.tracking_number) && (
            <Card title="物流信息">
              <Descriptions column={1} size="small">
                {order.shipping_carrier && (
                  <Descriptions.Item label="物流公司">
                    {order.shipping_carrier}
                  </Descriptions.Item>
                )}
                {order.tracking_number && (
                  <Descriptions.Item label="物流单号">
                    <span className="font-mono">{order.tracking_number}</span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}
        </div>

        {/* Right: Status Timeline */}
        <div className="space-y-6">
          <Card title="订单状态">
            {order.status === 'cancelled' || order.status === 'payment_failed' ? (
              <Timeline
                items={[
                  {
                    color: 'green',
                    dot: <ClockCircleOutlined />,
                    children: (
                      <div>
                        <div className="font-medium">订单创建</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    ),
                  },
                  {
                    color: 'red',
                    dot: <CloseCircleOutlined />,
                    children: (
                      <div>
                        <div className="font-medium">{statusInfo.label}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.updated_at).toLocaleString('zh-CN')}
                        </div>
                      </div>
                    ),
                  },
                ]}
              />
            ) : (
              <Timeline
                items={STATUS_TIMELINE.map((status) => ({
                  color: getTimelineColor(order.status, status),
                  dot: getTimelineIcon(status),
                  children: (
                    <div>
                      <div className={`font-medium ${
                        STATUS_TIMELINE.indexOf(status) <= STATUS_TIMELINE.indexOf(order.status)
                          ? 'text-gray-800'
                          : 'text-gray-400'
                      }`}>
                        {ORDER_STATUS_MAP[status]?.label || status}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* Payment Info */}
          <Card title="支付信息" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="商品小计">
                ¥{order.subtotal.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="运费">
                ¥{order.shipping_fee.toFixed(2)}
              </Descriptions.Item>
              <Descriptions.Item label="订单总额">
                <span className="font-bold text-red-500">
                  ¥{order.total_amount.toFixed(2)}
                </span>
              </Descriptions.Item>
              {order.confirmation_deadline && order.status === 'pending_transfer' && (
                <Descriptions.Item label="确认截止">
                  <span className="text-orange-500">
                    {new Date(order.confirmation_deadline).toLocaleString('zh-CN')}
                  </span>
                </Descriptions.Item>
              )}
            </Descriptions>
          </Card>
        </div>
      </div>
    </main>
  );
}
