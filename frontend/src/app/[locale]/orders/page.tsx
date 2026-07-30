'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Table, Tag, Button, Empty, Spin, message } from 'antd';
import { EyeOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import type { Order, OrderStatus } from '@/types';
import { useLocale, useTranslations } from 'next-intl';

/**
 * User orders list page (requires authentication).
 * Displays all orders associated with the user account.
 *
 * Requirements:
 * - 7.6: Display all orders with status and total amount
 * - 7.8: Record order creation timestamp
 */

export default function OrdersPage() {
  const t = useTranslations();
  const locale = useLocale();
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
      router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders`)}`);
    }
  }, [mounted, authLoading, isAuthenticated, router, locale]);

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ data: { orders: Order[]; total: number; page: number; page_size: number } }>('/orders');
      setOrders(response.data.data?.orders || []);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders`)}`);
      } else {
        message.error(t('common.error'));
      }
    } finally {
      setLoading(false);
    }
  }, [router, locale, t]);

  useEffect(() => {
    if (mounted && isAuthenticated) {
      fetchOrders();
    }
  }, [mounted, isAuthenticated, fetchOrders]);

  if (!mounted || authLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip={t('common.loading')} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  const columns = [
    {
      title: t('orders.orderNumber'),
      dataIndex: 'order_number',
      key: 'order_number',
      render: (text: string, record: Order) => (
        <Link href={`/${locale}/orders/${record.id}`} className="text-blue-500 hover:text-blue-600 font-mono">
          {text}
        </Link>
      ),
    },
    {
      title: t('orders.status'),
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => {
        const statusInfo = statusInfoFor(status, t);
        return <Tag color={statusInfo.color}>{statusInfo.label}</Tag>;
      },
    },
    {
      title: t('orders.amount'),
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (amount: number) => (
        <span className="font-medium text-gray-800">{formatCLP(amount, locale)}</span>
      ),
    },
    {
      title: t('orders.date'),
      dataIndex: 'created_at',
      key: 'created_at',
      render: (date: string) => new Date(date).toLocaleString(locale),
    },
    {
      title: t('common.actions'),
      key: 'action',
      render: (_: unknown, record: Order) => (
        <Link href={`/${locale}/orders/${record.id}`}>
          <Button type="link" icon={<EyeOutlined />}>
            {t('orders.viewOrder')}
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-800">{t('orders.title')}</h1>
        <Link href={`/${locale}/orders/track`}>
          <Button>{t('orders.tracking')}</Button>
        </Link>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Spin size="large" tip={t('common.loading')} />
        </div>
      ) : orders.length === 0 ? (
        <Empty
          description={t('orders.noOrders')}
          className="py-16"
        >
          <Link href={`/${locale}/products`}>
            <Button type="primary">{t('orders.browseProducts')}</Button>
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
              const statusInfo = statusInfoFor(order.status, t);
              return (
                <Link href={`/${locale}/orders/${order.id}`} key={order.id} className="block">
                  <div className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <span className="font-mono text-sm text-gray-600">{order.order_number}</span>
                      <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-lg font-medium text-gray-800">
                        {formatCLP(order.total_amount, locale)}
                      </span>
                      <span className="text-sm text-gray-500">
                        {new Date(order.created_at).toLocaleDateString(locale)}
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

function statusInfoFor(status: OrderStatus, t: ReturnType<typeof useTranslations>): { label: string; color: string } {
  const definitions: Record<OrderStatus, { key: string; color: string }> = {
    pending_payment: { key: 'orders.statusPendingPayment', color: 'orange' },
    pending_transfer: { key: 'orders.statusPendingTransfer', color: 'gold' },
    paid: { key: 'orders.statusPaid', color: 'blue' },
    pending_shipment: { key: 'orders.statusPendingShipment', color: 'cyan' },
    shipped: { key: 'orders.statusShipped', color: 'geekblue' },
    completed: { key: 'orders.statusCompleted', color: 'green' },
    cancelled: { key: 'orders.statusCancelled', color: 'default' },
    payment_failed: { key: 'orders.statusPaymentFailed', color: 'red' },
  };
  const definition = definitions[status];
  return definition ? { label: t(definition.key), color: definition.color } : { label: status, color: 'default' };
}

function formatCLP(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
}
