'use client';

import React, { useState } from 'react';
import {
  Form,
  Input,
  Button,
  Card,
  message,
  Tag,
  Descriptions,
  Timeline,
  Table,
  Empty,
} from 'antd';
import {
  SearchOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CarOutlined,
  CloseCircleOutlined,
  DollarOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import apiClient from '@/lib/api';
import type { Order, OrderStatus, OrderItem } from '@/types';

/**
 * Guest order tracking page.
 * Allows guests to track their order using order number + email.
 *
 * Requirements:
 * - 2.7: Allow guest to track order using order tracking number and email
 * - 7.7: Return order details including all order items and current status
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

export default function OrderTrackPage() {
  const [form] = Form.useForm();
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);

  const handleSearch = async (values: { order_number: string; email: string }) => {
    setSearching(true);
    setOrder(null);
    try {
      const response = await apiClient.post<{ data: Order }>('/orders/track', {
        order_number: values.order_number,
        email: values.email,
      });
      setOrder(response.data.data);
      setSearched(true);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number; data?: { error?: { message?: string } } } };
      if (err?.response?.status === 404) {
        message.error('未找到匹配的订单，请检查订单号和邮箱');
      } else {
        const errorMessage = err?.response?.data?.error?.message || '查询失败，请重试';
        message.error(errorMessage);
      }
      setSearched(true);
    } finally {
      setSearching(false);
    }
  };

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
    <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Search Form */}
      <Card className="mb-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">订单追踪</h1>
          <p className="text-gray-500 mt-2">
            输入订单号和下单邮箱查询订单状态
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSearch}
          autoComplete="off"
          className="max-w-md mx-auto"
          size="large"
        >
          <Form.Item
            name="order_number"
            label="订单号"
            rules={[{ required: true, message: '请输入订单号' }]}
          >
            <Input
              prefix={<SearchOutlined className="text-gray-400" />}
              placeholder="请输入订单号"
            />
          </Form.Item>

          <Form.Item
            name="email"
            label="下单邮箱"
            rules={[
              { required: true, message: '请输入下单邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入下单时使用的邮箱" />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={searching}
              icon={<SearchOutlined />}
              className="!h-11"
            >
              查询订单
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* Search Results */}
      {searched && !order && (
        <Card>
          <Empty description="未找到匹配的订单，请检查订单号和邮箱是否正确" />
        </Card>
      )}

      {order && (
        <div className="space-y-6">
          {/* Order Status */}
          <Card title="订单状态">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
              <div>
                <span className="text-gray-500">订单号：</span>
                <span className="font-mono font-medium">{order.order_number}</span>
              </div>
              <Tag color={ORDER_STATUS_MAP[order.status]?.color || 'default'} className="!text-base !px-4 !py-1">
                {ORDER_STATUS_MAP[order.status]?.label || order.status}
              </Tag>
            </div>

            {/* Timeline */}
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
                        <div className="font-medium">
                          {ORDER_STATUS_MAP[order.status]?.label || order.status}
                        </div>
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

          {/* Order Details */}
          <Card title="订单信息">
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label="下单时间">
                {new Date(order.created_at).toLocaleString('zh-CN')}
              </Descriptions.Item>
              <Descriptions.Item label="支付方式">
                {order.payment_method === 'online' ? '在线支付' : '转账支付'}
              </Descriptions.Item>
              <Descriptions.Item label="订单总额">
                <span className="font-bold text-red-500">
                  ¥{order.total_amount.toFixed(2)}
                </span>
              </Descriptions.Item>
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

          {/* Order Items */}
          {order.items && order.items.length > 0 && (
            <Card title="商品列表">
              {/* Desktop table */}
              <div className="hidden sm:block">
                <Table
                  columns={itemColumns}
                  dataSource={order.items}
                  rowKey="id"
                  pagination={false}
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
              </div>
            </Card>
          )}

          {/* Back link */}
          <div className="text-center">
            <Link href="/">
              <Button type="link">返回首页</Button>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
