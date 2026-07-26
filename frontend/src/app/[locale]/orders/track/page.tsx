'use client';

import { useState } from 'react';
import { Button, Card, Descriptions, Empty, Form, Input, message, Table, Tag, Timeline } from 'antd';
import { CarOutlined, CheckCircleOutlined, ClockCircleOutlined, CloseCircleOutlined, DollarOutlined, SearchOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { Order, OrderItem, OrderStatus } from '@/types';

const timeline: OrderStatus[] = ['pending_payment', 'paid', 'pending_shipment', 'shipped', 'completed'];
const statusColor: Record<OrderStatus, string> = { pending_payment: 'orange', pending_transfer: 'gold', paid: 'blue', pending_shipment: 'cyan', shipped: 'geekblue', completed: 'green', cancelled: 'default', payment_failed: 'red' };
const iconFor = (status: OrderStatus) => status === 'shipped' ? <CarOutlined /> : status === 'paid' ? <DollarOutlined /> : status === 'cancelled' || status === 'payment_failed' ? <CloseCircleOutlined /> : status === 'pending_payment' || status === 'pending_transfer' ? <ClockCircleOutlined /> : <CheckCircleOutlined />;

export default function OrderTrackPage() {
  const t = useTranslations('orderTracking');
  const locale = useLocale();
  const [form] = Form.useForm();
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const status = (value: OrderStatus) => t(`status.${value}`);
  const money = (value: number) => new Intl.NumberFormat(locale, { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
  const date = (value: string) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

  const search = async (values: { order_number: string; email: string }) => {
    setSearching(true); setOrder(null);
    try {
      const response = await apiClient.post<{ data: Order }>('/orders/track', values);
      setOrder(response.data.data);
    } catch (error: unknown) {
      const statusCode = (error as { response?: { status?: number } }).response?.status;
      message.error(statusCode === 404 ? t('notFound') : t('searchFailed'));
    } finally { setSearched(true); setSearching(false); }
  };

  const columns = [
    { title: t('product'), dataIndex: 'sku_name', key: 'sku_name', render: (name: string, item: OrderItem) => <div><div className="font-medium">{name}</div>{item.attributes && <div className="text-sm text-gray-500">{item.attributes}</div>}</div> },
    { title: t('unitPrice'), dataIndex: 'unit_price', key: 'unit_price', render: money },
    { title: t('quantity'), dataIndex: 'quantity', key: 'quantity' },
    { title: t('subtotal'), dataIndex: 'subtotal', key: 'subtotal', render: (value: number) => <span className="font-medium">{money(value)}</span> },
  ];
  const displayTimeline: OrderStatus[] = order
    ? (order.status === 'cancelled' || order.status === 'payment_failed' ? ['pending_payment', order.status] : timeline)
    : timeline;

  return <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-8">
    <Card className="mb-6"><div className="text-center mb-6"><h1 className="text-2xl font-bold">{t('title')}</h1><p className="text-gray-500 mt-2">{t('description')}</p></div>
      <Form form={form} layout="vertical" onFinish={search} autoComplete="off" className="max-w-md mx-auto" size="large">
        <Form.Item name="order_number" label={t('orderNumber')} rules={[{ required: true, message: t('orderNumberRequired') }]}><Input prefix={<SearchOutlined />} placeholder={t('orderNumberPlaceholder')} /></Form.Item>
        <Form.Item name="email" label={t('email')} rules={[{ required: true, message: t('emailRequired') }, { type: 'email', message: t('emailInvalid') }]}><Input placeholder={t('emailPlaceholder')} /></Form.Item>
        <Button type="primary" htmlType="submit" block loading={searching} icon={<SearchOutlined />} className="!h-11">{t('submit')}</Button>
      </Form>
    </Card>
    {searched && !order && <Card><Empty description={t('notFound')} /></Card>}
    {order && <div className="space-y-6">
      <Card title={t('statusTitle')}><div className="flex flex-col sm:flex-row sm:justify-between gap-4 mb-6"><span>{t('orderNumber')}: <b className="font-mono">{order.order_number}</b></span><Tag color={statusColor[order.status]} className="!text-base !px-4 !py-1">{status(order.status)}</Tag></div>
        <Timeline items={displayTimeline.map((item) => ({ color: timeline.indexOf(item) <= timeline.indexOf(order.status) ? 'green' : 'gray', dot: iconFor(item), children: <div><div className="font-medium">{item === 'pending_payment' ? t('created') : status(item)}</div>{item === 'pending_payment' && <div className="text-sm text-gray-500">{date(order.created_at)}</div>}{item === order.status && item !== 'pending_payment' && <div className="text-sm text-gray-500">{date(order.updated_at)}</div>}</div> }))} />
      </Card>
      <Card title={t('infoTitle')}><Descriptions column={{ xs: 1, sm: 2 }} size="small"><Descriptions.Item label={t('date')}>{date(order.created_at)}</Descriptions.Item><Descriptions.Item label={t('paymentMethod')}>{order.payment_method === 'online' ? t('onlinePayment') : t('bankTransfer')}</Descriptions.Item><Descriptions.Item label={t('amount')}><b>{money(order.total_amount)}</b></Descriptions.Item>{order.shipping_carrier && <Descriptions.Item label={t('carrier')}>{order.shipping_carrier}</Descriptions.Item>}{order.tracking_number && <Descriptions.Item label={t('trackingNumber')}><span className="font-mono">{order.tracking_number}</span></Descriptions.Item>}</Descriptions></Card>
      {order.items?.length > 0 && <Card title={t('itemsTitle')}><div className="hidden sm:block"><Table columns={columns} dataSource={order.items} rowKey="id" pagination={false} /></div><div className="sm:hidden space-y-3">{order.items.map((item) => <div key={item.id} className="border rounded-lg p-3"><div className="font-medium">{item.sku_name}</div><div className="flex justify-between mt-2"><span>{money(item.unit_price)} × {item.quantity}</span><b>{money(item.subtotal)}</b></div></div>)}</div></Card>}
      <div className="text-center"><Link href={`/${locale}`}><Button type="link">{t('backHome')}</Button></Link></div>
    </div>}
  </main>;
}
