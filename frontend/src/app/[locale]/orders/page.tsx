'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowRightOutlined, LoadingOutlined, ReloadOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import OrderStatusBadge from '@/components/storefront/OrderStatusBadge';
import apiClient from '@/lib/api';
import { formatCLP, formatDate } from '@/lib/utils';
import { useAuthStore } from '@/store/useAuthStore';
import type { Order, OrderStatus } from '@/types';

const statusKeys: Record<OrderStatus, string> = {
  pending_payment: 'orders.statusPendingPayment', pending_transfer: 'orders.statusPendingTransfer', paid: 'orders.statusPaid',
  pending_shipment: 'orders.statusPendingShipment', shipped: 'orders.statusShipped', completed: 'orders.statusCompleted',
  cancelled: 'orders.statusCancelled', payment_failed: 'orders.statusPaymentFailed',
};

export default function OrdersPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted && !authLoading && !isAuthenticated) router.replace(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders`)}`);
  }, [authLoading, isAuthenticated, locale, mounted, router]);

  const fetchOrders = useCallback(async () => {
    setLoading(true); setFailed(false);
    try {
      const response = await apiClient.get<{ data: { orders: Order[] } }>('/orders');
      setOrders(response.data.data?.orders || []);
    } catch (error: unknown) {
      if ((error as { response?: { status?: number } }).response?.status === 401) router.replace(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/orders`)}`);
      else setFailed(true);
    } finally { setLoading(false); }
  }, [locale, router]);

  useEffect(() => { if (mounted && isAuthenticated) void fetchOrders(); }, [fetchOrders, isAuthenticated, mounted]);

  if (!mounted || authLoading || (loading && orders.length === 0)) return <PageLoading label={t('common.loading')} />;
  if (!isAuthenticated) return null;

  return (
    <main className="store-container">
      <div className="flex flex-col gap-4 border-b border-[var(--sf-line)] pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('orders.title')}</h1></div>
        <Link href={`/${locale}/orders/track`} className="sf-button-secondary">{t('orders.tracking')} <ArrowRightOutlined /></Link>
      </div>

      {failed ? <State title={t('common.error')} action={<button type="button" onClick={fetchOrders} className="sf-button-primary"><ReloadOutlined />{t('common.retry')}</button>} />
        : orders.length === 0 ? <State title={t('orders.noOrders')} icon={<ShoppingOutlined />} action={<Link href={`/${locale}/products`} className="sf-button-primary">{t('orders.browseProducts')}</Link>} />
        : <div className="divide-y divide-[var(--sf-line)]">
          {orders.map((order) => <Link key={order.id} href={`/${locale}/orders/${order.id}`} className="group grid min-h-[118px] gap-4 py-6 transition sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-center">
            <div className="min-w-0"><p className="text-xs font-bold text-[var(--sf-muted)]">{t('orders.orderNumber')}</p><p className="mt-1 break-all font-mono text-sm font-black text-[var(--sf-ink)] group-hover:text-[var(--sf-accent)]">{order.order_number}</p></div>
            <div><p className="text-xs font-bold text-[var(--sf-muted)] sm:hidden">{t('orders.status')}</p><div className="mt-1 sm:mt-0"><OrderStatusBadge status={order.status} label={order.payment_method === 'transfer' && order.status === 'pending_payment' ? t('orders.statusAwaitingTransferProof') : t(statusKeys[order.status])} /></div></div>
            <div className="flex items-end justify-between gap-4 sm:block"><div><p className="text-xs font-bold text-[var(--sf-muted)]">{formatDate(order.created_at, locale)}</p><p className="mt-1 text-lg font-black text-[var(--sf-brand)]">{formatCLP(order.total_amount, locale)}</p></div><ArrowRightOutlined className="mb-1 text-[var(--sf-accent)] sm:hidden" /></div>
            <ArrowRightOutlined className="hidden text-[var(--sf-accent)] transition group-hover:translate-x-1 sm:block" />
          </Link>)}
        </div>}
    </main>
  );
}

function PageLoading({ label }: { label: string }) { return <main className="store-container flex min-h-[55vh] items-center justify-center"><span className="inline-flex items-center gap-3 text-sm font-bold text-[var(--sf-muted)]"><LoadingOutlined spin className="text-2xl text-[var(--sf-accent)]" />{label}</span></main>; }
function State({ title, icon, action }: { title: string; icon?: React.ReactNode; action: React.ReactNode }) { return <section className="py-20 text-center">{icon && <span className="text-4xl text-[var(--sf-accent)]">{icon}</span>}<h2 className="mt-4 text-xl font-black text-[var(--sf-ink)]">{title}</h2><div className="mt-6 flex justify-center">{action}</div></section>; }
