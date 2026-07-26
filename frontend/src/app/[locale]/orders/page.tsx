'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Empty, Spin, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import type { Order, OrderStatus } from '@/types';

/**
 * User orders list page (requires authentication).
 * Displays all orders associated with the user account.
 *
 * Requirements:
 * - 7.6: Display all orders with status and total amount
 * - 7.8: Record order creation timestamp
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

export default function OrdersPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) {
      router.push('/login?redirect=/orders');
    }
  }, [mounted, authLoading, isAuthenticated, router]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ data: { orders: Order[]; total: number; page: number; page_size: number } }>('/orders');
      setOrders(response.data.data?.orders || []);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        router.push('/login?redirect=/orders');
      } else {
        message.error('获取订单列表失败');
      }
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      fetchOrders();
    }
  }, [mounted, isAuthenticated, fetchOrders]);

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

  const columns = [
    {
      title: '订单号',
      dataIndex: 'order_number',
      key: 'order_number',
      render: (text: string, record: Order) => (
        <Link href={`/orders/${record.id}`} className="text-blue-500 hover:text-blue-600 font-mono">
          {text}
        </Link>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => {
        const statusInfo = ORDER_STATUS_MAP[status] || { label: status, color: 'default' };
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => (
        <span className="font-medium text-gray-800">¥{amount.toFixed(2)}</span>
      ),
    },
    {
      title: '下单时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString('zh-CN'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: unknown, record: Order) => (
        <Link href={`/orders/${record.id}`}>
          <Button type="link" icon={<EyeOutlined />}>
            查看详情
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">我的订单</h1>
        <Link href="/orders/track">
          <Button>订单追踪</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spin size="large" tip="加载订单..." />
        </div>
      ) : orders.length === 0 ? (
        <Empty
          description="暂无订单"
          className="py-16"
        >
          <Link href="/products">
            <Button type="primary">去逛逛</Button>
          </Link>
        </Empty>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden sm:block">
            <Table
              columns={columns}
              dataSource={orders}
              rowKey="id"
              pagination={{ pageSize: 10 }}
            />
          </div>

          {/* Mobile card list */}
          <div className="sm:hidden space-y-4">
            {orders.map((order) => {
              const statusInfo = ORDER_STATUS_MAP[order.status] || { label: order.status, color: 'default' };
              return (
                <Link href={`/orders/${order.id}`} key={order.id} className="block">
                  <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-sm text-gray-600">{order.order_number}</span>
                      <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-800">
                        ¥{order.total_amount.toFixed(2)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString('zh-CN')}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </main>
  );
}
