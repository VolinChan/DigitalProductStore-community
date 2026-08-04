'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Form, Input } from 'antd';
import { CheckOutlined, CloseOutlined, SearchOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import OrderStatusBadge from '@/components/storefront/OrderStatusBadge';
import apiClient from '@/lib/api';
import { formatOrderItemAttributes } from '@/lib/order-line';
import { formatCLP, formatDateTime } from '@/lib/utils';
import type { Order, OrderStatus } from '@/types';

const progress: OrderStatus[] = ['pending_payment', 'paid', 'pending_shipment', 'shipped', 'completed'];

export default function OrderTrackPage() {
  const t = useTranslations('orderTracking');
  const locale = useLocale();
  const [form] = Form.useForm();
  const [searching, setSearching] = useState(false);
  const [order, setOrder] = useState<Order | null>(null);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState('');
  const statusLabel = (status: OrderStatus) => t(`status.${status}`);

  useEffect(() => {
    const orderNumber = new URLSearchParams(window.location.search).get('order_number');
    if (orderNumber) form.setFieldValue('order_number', orderNumber);
  }, [form]);

  const search = async (values: { order_number: string; email: string }) => {
    setSearching(true); setOrder(null); setError('');
    try { const response = await apiClient.post<{ data: Order }>('/orders/track', values); setOrder(response.data.data); }
    catch (requestError: unknown) { setError((requestError as { response?: { status?: number } }).response?.status === 404 ? t('notFound') : t('searchFailed')); }
    finally { setSearched(true); setSearching(false); }
  };

  const normalized = order?.status === 'pending_transfer' ? 'pending_payment' : order?.status;
  const currentIndex = normalized ? progress.indexOf(normalized) : -1;
  const stopped = order?.status === 'cancelled' || order?.status === 'payment_failed';

  return (
    <main className="store-container">
      <section className="mx-auto max-w-4xl">
        <header className="max-w-2xl"><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('title')}</h1><p className="mt-3 text-sm leading-7 text-[var(--sf-muted)] sm:text-base">{t('description')}</p></header>
        <div data-testid="order-tracking-card" className="mt-8 rounded-[20px] border border-[var(--sf-line)] bg-white p-5 shadow-[0_8px_32px_rgba(23,63,103,0.07)] sm:p-7">
          <Form form={form} layout="vertical" onFinish={search} autoComplete="on" size="large" className="sf-auth-form grid gap-x-5 sm:grid-cols-2">
            <Form.Item name="order_number" label={t('orderNumber')} rules={[{ required: true, message: t('orderNumberRequired') }]}><Input autoComplete="off" prefix={<SearchOutlined />} placeholder={t('orderNumberPlaceholder')} /></Form.Item>
            <Form.Item name="email" label={t('email')} rules={[{ required: true, message: t('emailRequired') }, { type: 'email', message: t('emailInvalid') }]}><Input autoComplete="email" inputMode="email" placeholder={t('emailPlaceholder')} /></Form.Item>
            <button type="submit" disabled={searching} className="sf-button-primary w-full sm:col-span-2"><SearchOutlined />{t('submit')}</button>
          </Form>
        </div>

        {searched && !order && <div role="alert" className="mt-8 rounded-[16px] bg-[#fdebea] px-5 py-4 text-sm font-semibold text-[#a33a32]">{error || t('notFound')}</div>}

        {order && <div className="mt-10 space-y-10">
          <section className="border-y border-[var(--sf-line)] py-7"><div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-xs font-bold text-[var(--sf-muted)]">{t('orderNumber')}</p><p className="mt-1 break-all font-mono text-sm font-black text-[var(--sf-ink)]">{order.order_number}</p></div><OrderStatusBadge status={order.status} label={statusLabel(order.status)} /></div>
            <ol className="mt-8 grid gap-0 sm:grid-cols-5">{stopped ? <><Progress label={t('created')} done /><Progress label={statusLabel(order.status)} stopped last /></> : progress.map((item, index) => <Progress key={item} label={item === 'pending_payment' ? t('created') : statusLabel(item)} done={index <= currentIndex} last={index === progress.length - 1} horizontal />)}</ol>
          </section>

          <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('infoTitle')}</h2><dl className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"><Info label={t('date')} value={formatDateTime(order.created_at, locale)} /><Info label={t('paymentMethod')} value={order.payment_method === 'online' ? t('onlinePayment') : t('bankTransfer')} /><Info label={t('amount')} value={formatCLP(order.total_amount, locale)} />{order.shipping_carrier && <Info label={t('carrier')} value={order.shipping_carrier} />}{order.tracking_number && <Info label={t('trackingNumber')} value={order.tracking_number} mono />}</dl></section>

          {order.items?.length > 0 && <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('itemsTitle')}</h2><div className="mt-4 divide-y divide-[var(--sf-line)] border-y border-[var(--sf-line)]">{order.items.map(item => { const attributes = formatOrderItemAttributes(item); return <div key={item.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div><p className="text-sm font-black text-[var(--sf-ink)]">{item.sku_name}</p>{attributes && <p className="mt-1 text-xs text-[var(--sf-muted)]">{attributes}</p>}</div><div className="flex justify-between gap-5 sm:block sm:text-right"><p className="text-xs text-[var(--sf-muted)]">{formatCLP(item.unit_price, locale)} × {item.quantity}</p><p className="mt-1 font-black text-[var(--sf-brand)]">{formatCLP(item.subtotal, locale)}</p></div></div>; })}</div></section>}
          <Link href={`/${locale}`} className="sf-button-secondary">{t('backHome')}</Link>
        </div>}
      </section>
    </main>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div><dt className="text-xs font-bold text-[var(--sf-muted)]">{label}</dt><dd className={`mt-1 break-all text-sm font-black text-[var(--sf-ink)] ${mono ? 'font-mono' : ''}`}>{value}</dd></div>; }
function Progress({ label, done, stopped, last, horizontal }: { label: string; done?: boolean; stopped?: boolean; last?: boolean; horizontal?: boolean }) { return <li className={`grid gap-2 ${horizontal ? 'grid-cols-[28px_1fr] sm:grid-cols-1' : 'grid-cols-[28px_1fr]'}`}><div className={`flex ${horizontal ? 'flex-col items-center sm:flex-row' : 'flex-col items-center'}`}><span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs ${stopped ? 'bg-[#fdebea] text-[#a33a32]' : done ? 'bg-[#e4f3e9] text-[#24723f]' : 'bg-[#edf0ee] text-[#879196]'}`}>{stopped ? <CloseOutlined /> : done ? <CheckOutlined /> : null}</span>{!last && <span className={`${horizontal ? 'h-8 w-px sm:h-px sm:w-full' : 'h-8 w-px'} ${done ? 'bg-[#9ccbad]' : 'bg-[var(--sf-line)]'}`} />}</div><span className={`pb-4 pt-1 text-xs font-bold sm:pr-2 ${stopped ? 'text-[#a33a32]' : done ? 'text-[var(--sf-ink)]' : 'text-[var(--sf-muted)]'}`}>{label}</span></li>; }
