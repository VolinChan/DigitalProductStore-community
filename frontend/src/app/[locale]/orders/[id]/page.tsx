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
import { useLocale, useTranslations } from 'next-intl';

/**
 * Order detail page with status timeline, items, and cancel button.
 *
 * Requirements:
 * - 7.7: Return order details including all order items and current status
 * - 24.1: Cancel orders with status "pending_payment"
 * - 24.2: Cancel orders with status "pending_transfer"
 * - 24.4: Prevent cancellation of shipped or completed orders
 */

const ORDER_STATUS_DEFINITIONS: Record<OrderStatus, { key: string; color: string }> = {
  pending_payment: { key: 'orders.statusPendingPayment', color: 'orange' },
  pending_transfer: { key: 'orders.statusPendingTransfer', color: 'gold' },
  paid: { key: 'orders.statusPaid', color: 'blue' },
  pending_shipment: { key: 'orders.statusPendingShipment', color: 'cyan' },
  shipped: { key: 'orders.statusShipped', color: 'geekblue' },
  completed: { key: 'orders.statusCompleted', color: 'green' },
  cancelled: { key: 'orders.statusCancelled', color: 'default' },
  payment_failed: { key: 'orders.statusPaymentFailed', color: 'red' },
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
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [modal, modalContextHolder] = Modal.useModal();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders/${orderId}`)}`);
    }
  }, [mounted, authLoading, isAuthenticated, router, orderId, locale]);

  const fetchOrder = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get<{ data: Order }>(`/orders/${orderId}`);
      setOrder(response.data.data);
    } catch (error: unknown) {
      const err = error as { response?: { status?: number } };
      if (err?.response?.status === 401) {
        router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders/${orderId}`)}`);
      } else if (err?.response?.status === 404) {
        message.error(t('orders.notFound'));
      } else {
        message.error(t('orders.loadFailed'));
      }
    } finally {
      setLoading(false);
    }
  }, [orderId, router, locale, t]);

  useEffect(() => {
    if (mounted && isAuthenticated && orderId) {
      fetchOrder();
    }
  }, [mounted, isAuthenticated, orderId, fetchOrder]);

  const canCancel = (status: OrderStatus): boolean => {
    return status === 'pending_payment' || status === 'pending_transfer';
  };

  const handleCancel = () => {
    modal.confirm({
      title: t('orders.cancelConfirm'),
      icon: <ExclamationCircleOutlined />,
      content: t('orders.cancelContent'),
      okText: t('orders.cancelOk'),
      cancelText: t('common.cancel'),
      okButtonProps: { danger: true },
      onOk: async () => {
        setCancelling(true);
        try {
          await apiClient.post(`/orders/${orderId}/cancel`);
          message.success(t('orders.cancelled'));
          fetchOrder();
        } catch (error: unknown) {
          const err = error as { response?: { data?: { error?: { message?: string } } } };
          const errorMessage = err?.response?.data?.error?.message || t('orders.cancelFailed');
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
        <Spin size="large" description={t('common.loading')} />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" description={t('orders.loadingDetail')} />
      </div>
    );
  }

  if (!order) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Empty description={t('orders.notFound')}>
          <Link href={`/${locale}/orders`}>
            <Button type="primary">{t('orders.backToOrders')}</Button>
          </Link>
        </Empty>
      </main>
    );
  }

  const statusInfo = orderStatusInfo(order.status, t);

  const itemColumns = [
    {
      title: t('orders.product'),
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
      title: t('orders.skuCode'),
      dataIndex: 'sku_code',
      key: 'sku_code',
      responsive: ['md' as const],
    },
    {
      title: t('orders.unitPrice'),
      dataIndex: 'unit_price',
      key: 'unit_price',
      render: (price: number) => formatCLP(price, locale),
    },
    {
      title: t('common.quantity'),
      dataIndex: 'quantity',
      key: 'quantity',
    },
    {
      title: t('common.subtotal'),
      dataIndex: 'subtotal',
      key: 'subtotal',
      render: (subtotal: number) => (
        <span className="font-medium">{formatCLP(subtotal, locale)}</span>
      ),
    },
  ];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {modalContextHolder}
      {/* Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <Link href={`/${locale}/orders`} className="text-blue-500 hover:text-blue-600 text-sm">
            {t('orders.backToOrders')}
          </Link>
          <h1 className="text-2xl font-bold text-gray-800 mt-2">{t('orders.detailTitle')}</h1>
        </div>
        {canCancel(order.status) && (
          <Button
            danger
            onClick={handleCancel}
            loading={cancelling}
          >
            {t('orders.cancelBtn')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Order info and items */}
        <div className="lg:col-span-2 space-y-6">
          {/* Order Basic Info */}
          <Card title={t('orders.infoTitle')}>
            <Descriptions column={{ xs: 1, sm: 2 }} size="small">
              <Descriptions.Item label={t('orders.orderNumber')}>
                <span className="font-mono">{order.order_number}</span>
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.status')}>
                <Tag color={statusInfo.color}>{statusInfo.label}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.orderDate')}>
                {new Date(order.created_at).toLocaleString(locale)}
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.paymentMethod')}>
                {order.payment_method === 'online' ? t('payment.online') : t('payment.transfer')}
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.shippingAddress')} span={2}>
                {order.shipping_address}
              </Descriptions.Item>
            </Descriptions>
          </Card>

          {/* Order Items */}
          <Card title={t('orders.itemsTitle')}>
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
                        <span className="font-medium">{t('common.total')}</span>
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={1}>
                        {order.items.reduce((sum, item) => sum + item.quantity, 0)}
                      </Table.Summary.Cell>
                      <Table.Summary.Cell index={2}>
                        <span className="font-bold text-lg">
                          {formatCLP(order.total_amount, locale)}
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
                      {formatCLP(item.unit_price, locale)} × {item.quantity}
                    </span>
                    <span className="font-medium">{formatCLP(item.subtotal, locale)}</span>
                  </div>
                </div>
              ))}
              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-medium">{t('orders.orderTotal')}</span>
                <span className="font-bold text-lg text-red-500">
                  {formatCLP(order.total_amount, locale)}
                </span>
              </div>
            </div>
          </Card>

          {/* Shipping Info */}
          {(order.shipping_carrier || order.tracking_number) && (
            <Card title={t('orders.shippingInfo')}>
              <Descriptions column={1} size="small">
                {order.shipping_carrier && (
                  <Descriptions.Item label={t('orders.shippingCarrier')}>
                    {order.shipping_carrier}
                  </Descriptions.Item>
                )}
                {order.tracking_number && (
                  <Descriptions.Item label={t('orders.trackingNumber')}>
                    <span className="font-mono">{order.tracking_number}</span>
                  </Descriptions.Item>
                )}
              </Descriptions>
            </Card>
          )}
        </div>

        {/* Right: Status Timeline */}
        <div className="space-y-6">
          <Card title={t('orders.statusTitle')}>
            {order.status === 'cancelled' || order.status === 'payment_failed' ? (
              <Timeline
                items={[
                  {
                    color: 'green',
                    icon: <ClockCircleOutlined />,
                    content: (
                      <div>
                        <div className="font-medium">{t('orders.created')}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.created_at).toLocaleString(locale)}
                        </div>
                      </div>
                    ),
                  },
                  {
                    color: 'red',
                    icon: <CloseCircleOutlined />,
                    content: (
                      <div>
                        <div className="font-medium">{statusInfo.label}</div>
                        <div className="text-sm text-gray-500">
                          {new Date(order.updated_at).toLocaleString(locale)}
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
                  icon: getTimelineIcon(status),
                  content: (
                    <div>
                      <div className={`font-medium ${
                        STATUS_TIMELINE.indexOf(status) <= STATUS_TIMELINE.indexOf(order.status)
                          ? 'text-gray-800'
                          : 'text-gray-400'
                      }`}>
                        {orderStatusInfo(status, t).label}
                      </div>
                    </div>
                  ),
                }))}
              />
            )}
          </Card>

          {/* Payment Info */}
          <Card title={t('orders.paymentInfo')} size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label={t('common.subtotal')}>
                {formatCLP(order.subtotal, locale)}
              </Descriptions.Item>
              <Descriptions.Item label={t('cart.shippingFee')}>
                {formatCLP(order.shipping_fee, locale)}
              </Descriptions.Item>
              <Descriptions.Item label={t('orders.orderTotal')}>
                <span className="font-bold text-red-500">
                  {formatCLP(order.total_amount, locale)}
                </span>
              </Descriptions.Item>
              {order.confirmation_deadline && order.status === 'pending_transfer' && (
                <Descriptions.Item label={t('orders.confirmationDeadline')}>
                  <span className="text-orange-500">
                    {new Date(order.confirmation_deadline).toLocaleString(locale)}
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

function orderStatusInfo(
  status: OrderStatus,
  t: ReturnType<typeof useTranslations>
): { label: string; color: string } {
  const definition = ORDER_STATUS_DEFINITIONS[status];
  return definition
    ? { label: t(definition.key), color: definition.color }
    : { label: status, color: 'default' };
}

function formatCLP(amount: number, locale: string): string {
  return new Intl.NumberFormat(locale, {
    style: 'currency',
    currency: 'CLP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}
