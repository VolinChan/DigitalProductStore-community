'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { Modal, message } from 'antd';
import { ArrowLeftOutlined, CheckOutlined, CloseOutlined, LoadingOutlined, ReloadOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import OrderStatusBadge from '@/components/storefront/OrderStatusBadge';
import apiClient from '@/lib/api';
import { formatCLP, formatDateTime } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import type { Order, OrderStatus } from '@/types';
import OrderTrackingLink from '@/components/order/OrderTrackingLink';

const statusKeys: Record<OrderStatus, string> = {
  pending_payment: 'orders.statusPendingPayment', pending_transfer: 'orders.statusPendingTransfer', paid: 'orders.statusPaid',
  pending_shipment: 'orders.statusPendingShipment', shipped: 'orders.statusShipped', completed: 'orders.statusCompleted',
  cancelled: 'orders.statusCancelled', payment_failed: 'orders.statusPaymentFailed',
};
const progressStatuses: OrderStatus[] = ['pending_payment', 'paid', 'pending_shipment', 'shipped', 'completed'];

export default function OrderDetailPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const params = useParams();
  const orderId = String(params.id);
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [modal, modalContextHolder] = Modal.useModal();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) router.replace(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders/${orderId}`)}`);
  }, [authLoading, isAuthenticated, locale, mounted, orderId, router]);

  const fetchOrder = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const response = await apiClient.get<{ data: Order }>(`/orders/${orderId}`);
      setOrder(response.data.data);
    } catch (error: unknown) {
      const code = (error as { response?: { status?: number } }).response?.status;
      if (code === 401) router.replace(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders/${orderId}`)}`);
      else setFailed(true);
    } finally { setLoading(false); }
  }, [locale, orderId, router]);

  useEffect(() => { if (mounted && isAuthenticated && orderId) void fetchOrder(); }, [fetchOrder, isAuthenticated, mounted, orderId]);

  const cancelOrder = () => modal.confirm({
    title: t('orders.cancelConfirm'), content: t('orders.cancelContent'), okText: t('orders.cancelOk'), cancelText: t('common.cancel'), okButtonProps: { danger: true },
    onOk: async () => { setCancelling(true); try { await apiClient.post(`/orders/${orderId}/cancel`); message.success(t('orders.cancelled')); await fetchOrder(); } catch (error: unknown) { message.error((error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || t('orders.cancelFailed')); } finally { setCancelling(false); } },
  });

  if (!mounted || authLoading || loading) return <Loading label={t('orders.loadingDetail')} />;
  if (!isAuthenticated) return null;
  if (failed || !order) return <main className="store-container text-center"><h1 className="text-2xl font-black text-[var(--sf-ink)]">{failed ? t('orders.loadFailed') : t('orders.notFound')}</h1><div className="mt-6 flex flex-wrap justify-center gap-3">{failed && <button type="button" onClick={fetchOrder} className="sf-button-primary"><ReloadOutlined />{t('common.retry')}</button>}<Link href={`/${locale}/orders`} className="sf-button-secondary">{t('orders.backToOrders')}</Link></div></main>;

  const canCancel = order.status === 'pending_payment' || order.status === 'pending_transfer';
  const canContinueTransfer = order.payment_method === 'transfer' && order.status === 'pending_payment';
  const transferHref = `/${locale}/checkout/payment?order_id=${order.id}&order_number=${encodeURIComponent(order.order_number)}&amount=${order.total_amount}&method=transfer`;
  const statusLabel = order.payment_method === 'transfer' && order.status === 'pending_payment'
    ? t('orders.statusAwaitingTransferProof')
    : t(statusKeys[order.status]);
  const currentProgressStatus = order.status === 'pending_transfer' ? 'pending_payment' : order.status;
  const currentIndex = progressStatuses.indexOf(currentProgressStatus);
  const stopped = order.status === 'cancelled' || order.status === 'payment_failed';

  return (
    <main className="store-container">
      {modalContextHolder}
      <Link href={`/${locale}/orders`} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--sf-accent)]"><ArrowLeftOutlined />{t('orders.backToOrders')}</Link>
      <header className="mt-4 flex flex-col gap-5 border-b border-[var(--sf-line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="font-mono text-sm font-bold text-[var(--sf-muted)]">{order.order_number}</p><h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('orders.detailTitle')}</h1><div className="mt-4"><OrderStatusBadge status={order.status} label={statusLabel} /></div></div>
        <div className="flex flex-wrap gap-3">{canContinueTransfer && <Link href={transferHref} className="sf-button-primary">{t('orders.continueTransfer')}</Link>}<OrderTrackingLink orderNumber={order.order_number} className="sf-button-secondary" />{canCancel && <button type="button" onClick={cancelOrder} disabled={cancelling} className="inline-flex min-h-11 w-fit items-center justify-center rounded-full border border-[#d66a60] px-5 text-sm font-bold text-[#a33a32] transition hover:bg-[#fdebea] disabled:opacity-50">{t('orders.cancelBtn')}</button>}</div>
      </header>

      <div className="mt-8 grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)] lg:gap-14">
        <div className="min-w-0 space-y-10">
          <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('orders.itemsTitle')}</h2><div className="mt-4 divide-y divide-[var(--sf-line)] border-y border-[var(--sf-line)]">{order.items.map(item => <div key={item.id} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto] sm:items-center"><div className="min-w-0"><h3 className="break-words text-sm font-black text-[var(--sf-ink)]">{item.sku_name}</h3>{item.attributes && <p className="mt-1 text-xs leading-5 text-[var(--sf-muted)]">{item.attributes}</p>}<p className="mt-2 font-mono text-xs text-[var(--sf-muted)]">{item.sku_code}</p></div><div className="flex items-end justify-between gap-5 sm:block sm:text-right"><p className="text-xs text-[var(--sf-muted)]">{formatCLP(item.unit_price, locale)} × {item.quantity}</p><p className="mt-1 font-black text-[var(--sf-brand)]">{formatCLP(item.subtotal, locale)}</p></div></div>)}</div></section>

          <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('orders.infoTitle')}</h2><dl className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2"><Info label={t('orders.orderDate')} value={formatDateTime(order.created_at, locale)} /><Info label={t('orders.paymentMethod')} value={order.payment_method === 'online' ? t('payment.online') : t('payment.transfer')} /><Info label={t('orders.shippingAddress')} value={order.shipping_address} wide />{order.shipping_carrier && <Info label={t('orders.shippingCarrier')} value={order.shipping_carrier} />}{order.tracking_number && <Info label={t('orders.trackingNumber')} value={order.tracking_number} mono />}</dl></section>
        </div>

        <aside className="space-y-9">
          <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('orders.statusTitle')}</h2><ol className="mt-5 space-y-0">{stopped ? <><ProgressItem label={t('orders.created')} done /><ProgressItem label={t(statusKeys[order.status])} stopped last /></> : progressStatuses.map((status, index) => <ProgressItem key={status} label={t(statusKeys[status])} done={index <= currentIndex} last={index === progressStatuses.length - 1} />)}</ol></section>
          <section className="rounded-[18px] bg-[var(--sf-soft)] p-5"><h2 className="text-lg font-black text-[var(--sf-ink)]">{t('orders.paymentInfo')}</h2><dl className="mt-5 space-y-3 text-sm"><PriceRow label={t('common.subtotal')} value={formatCLP(order.subtotal, locale)} /><PriceRow label={t('cart.shippingFee')} value={formatCLP(order.shipping_fee, locale)} /><div className="border-t border-[var(--sf-line)] pt-4"><PriceRow label={t('orders.orderTotal')} value={formatCLP(order.total_amount, locale)} strong /></div>{order.confirmation_deadline && order.status === 'pending_transfer' && <div className="border-t border-[var(--sf-line)] pt-4"><dt className="text-xs font-bold text-[var(--sf-muted)]">{t('orders.confirmationDeadline')}</dt><dd className="mt-1 text-sm font-black text-[#835d00]">{formatDateTime(order.confirmation_deadline, locale)}</dd></div>}</dl></section>
        </aside>
      </div>
    </main>
  );
}

function Loading({ label }: { label: string }) { return <main className="store-container flex min-h-[55vh] items-center justify-center"><span className="inline-flex items-center gap-3 text-sm font-bold text-[var(--sf-muted)]"><LoadingOutlined spin className="text-2xl text-[var(--sf-accent)]" />{label}</span></main>; }
function Info({ label, value, wide, mono }: { label: string; value: string; wide?: boolean; mono?: boolean }) { return <div className={wide ? 'sm:col-span-2' : ''}><dt className="text-xs font-bold text-[var(--sf-muted)]">{label}</dt><dd className={`mt-1 break-words text-sm font-semibold leading-6 text-[var(--sf-ink)] ${mono ? 'font-mono' : ''}`}>{value}</dd></div>; }
function PriceRow({ label, value, strong }: { label: string; value: string; strong?: boolean }) { return <div className="flex items-baseline justify-between gap-4"><dt className={strong ? 'font-black text-[var(--sf-ink)]' : 'text-[var(--sf-muted)]'}>{label}</dt><dd className={strong ? 'text-xl font-black text-[var(--sf-brand)]' : 'font-semibold text-[var(--sf-ink)]'}>{value}</dd></div>; }
function ProgressItem({ label, done = false, stopped = false, last = false }: { label: string; done?: boolean; stopped?: boolean; last?: boolean }) { return <li className="grid grid-cols-[28px_1fr] gap-3"><div className="flex flex-col items-center"><span className={`flex h-7 w-7 items-center justify-center rounded-full text-xs ${stopped ? 'bg-[#fdebea] text-[#a33a32]' : done ? 'bg-[#e4f3e9] text-[#24723f]' : 'bg-[#edf0ee] text-[#879196]'}`}>{stopped ? <CloseOutlined /> : done ? <CheckOutlined /> : null}</span>{!last && <span className={`h-8 w-px ${done ? 'bg-[#9ccbad]' : 'bg-[var(--sf-line)]'}`} />}</div><span className={`pt-1 text-sm font-bold ${stopped ? 'text-[#a33a32]' : done ? 'text-[var(--sf-ink)]' : 'text-[var(--sf-muted)]'}`}>{label}</span></li>; }
