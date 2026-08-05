'use client';

import { Suspense, useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  CheckCircleFilled,
  CloseCircleFilled,
  LoadingOutlined,
  WarningFilled,
} from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import TransferPayment from '@/components/checkout/TransferPayment';
import apiClient from '@/lib/api';
import type { Order, TransferPaymentAccount } from '@/types';
import OrderTrackingLink from '@/components/order/OrderTrackingLink';

function PaymentPageContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();
  const orderId = searchParams.get('order_id');
  const orderNumber = searchParams.get('order_number');
  const method = searchParams.get('method');
  const amount = searchParams.get('amount');
  const callbackStatus = searchParams.get('status');
  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>(
    callbackStatus === 'success' ? 'success' : callbackStatus === 'failed' ? 'failed' : 'pending',
  );
  const [paymentError, setPaymentError] = useState<string>();
  const [confirmationDeadline, setConfirmationDeadline] = useState<string>();
  const [transferAccounts, setTransferAccounts] = useState<TransferPaymentAccount[]>();
  const attemptedOrderId = useRef<string | null>(null);

  const handleOnlinePayment = useCallback(async () => {
    if (!orderId) return;
    setPaymentStatus('pending');
    setPaymentError(undefined);
    setLoading(true);
    try {
      const response = await apiClient.post<{ data: { payment_url: string } }>('/payments/online/session', {
        order_id: Number(orderId),
      });
      const paymentUrl = response.data.data?.payment_url;
      if (!paymentUrl) throw new Error(t('payment.failedDefault'));
      window.location.assign(paymentUrl);
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      setPaymentError(apiError.response?.data?.error?.message || apiError.message || t('payment.failedDefault'));
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  }, [orderId, t]);

  useEffect(() => {
    if (method === 'online' && paymentStatus === 'pending' && orderId && !callbackStatus && attemptedOrderId.current !== orderId) {
      attemptedOrderId.current = orderId;
      void handleOnlinePayment();
    }
  }, [callbackStatus, handleOnlinePayment, method, orderId, paymentStatus]);

  useEffect(() => {
    if (method !== 'transfer' || !orderId) return;
    const stored = sessionStorage.getItem(`transfer-accounts:${orderId}`);
    if (stored) {
      try {
        const parsed = JSON.parse(stored) as TransferPaymentAccount[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setTransferAccounts(parsed);
          return;
        }
      } catch {
        sessionStorage.removeItem(`transfer-accounts:${orderId}`);
      }
    }

    // A signed-in customer may return from order history in a new browser
    // session. Reload the immutable account snapshot captured on the order.
    let active = true;
    void apiClient.get<{ data: Order }>(`/orders/${orderId}`)
      .then((response) => {
        if (!active) return;
        const snapshot = response.data.data?.transfer_account_snapshot;
        if (Array.isArray(snapshot) && snapshot.length > 0) {
          setTransferAccounts(snapshot);
          sessionStorage.setItem(`transfer-accounts:${orderId}`, JSON.stringify(snapshot));
        }
      })
      .catch(() => undefined);
    return () => { active = false; };
  }, [method, orderId]);

  const orderHref = orderId ? `/${locale}/orders/${orderId}` : `/${locale}/orders`;

  if (method === 'online' && paymentStatus === 'pending') {
    return <PaymentState icon={<LoadingOutlined spin />} tone="info" title={t('payment.redirecting')} text={t('payment.pleaseWait')}>
      <button type="button" onClick={handleOnlinePayment} disabled={loading} className="sf-button-secondary mt-7">
        {t('payment.retry')}
      </button>
    </PaymentState>;
  }

  if (method === 'online' && paymentStatus === 'success') {
    return <PaymentState icon={<CheckCircleFilled />} tone="success" title={t('payment.successTitle')} text={orderNumber ? `${t('checkout.orderNumber')}: ${orderNumber}. ${t('payment.successSub')}` : t('payment.successDefault')}>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <Link href={orderHref} className="sf-button-primary">{t('orders.viewOrder')}</Link>
        <Link href={`/${locale}`} className="sf-button-secondary">{t('layout.home')}</Link>
      </div>
    </PaymentState>;
  }

  if (method === 'online' && paymentStatus === 'failed') {
    return <PaymentState icon={<CloseCircleFilled />} tone="error" title={t('payment.failedTitle')} text={orderNumber ? `${orderNumber}. ${paymentError || t('payment.failedSub')}` : paymentError || t('payment.failedSub')}>
      <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
        <button type="button" onClick={handleOnlinePayment} disabled={loading} className="sf-button-primary">{t('payment.retry')}</button>
        <OrderTrackingLink orderNumber={orderNumber || undefined} className="sf-button-secondary" />
        <Link href={orderHref} className="sf-button-secondary">{t('orders.viewOrder')}</Link>
      </div>
    </PaymentState>;
  }

  if (method === 'transfer' && orderId && orderNumber) {
    return (
      <main className="store-container">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p>
          <h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('payment.transferTitle')}</h1>
          <p className="mt-3 text-sm text-[var(--sf-muted)]">{t('checkout.orderNumber')}: <span className="font-mono font-bold text-[var(--sf-ink)]">{orderNumber}</span></p>
          <div className="mt-8">
            <TransferPayment orderId={Number(orderId)} orderNumber={orderNumber} totalAmount={Number(amount) || 0} accounts={transferAccounts} confirmationDeadline={confirmationDeadline} onUploadSuccess={() => { const deadline = new Date(); deadline.setDate(deadline.getDate() + 7); setConfirmationDeadline(deadline.toISOString()); }} />
          </div>
          <Link href={orderHref} className="sf-button-secondary mt-8">{t('orders.viewOrder')}</Link>
        </div>
      </main>
    );
  }

  return <PaymentState icon={<WarningFilled />} tone="warning" title={t('payment.errorTitle')} text={t('payment.errorSub')}>
    <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
      <Link href={`/${locale}/orders`} className="sf-button-primary">{t('orders.title')}</Link>
      <Link href={`/${locale}`} className="sf-button-secondary">{t('layout.home')}</Link>
    </div>
  </PaymentState>;
}

function PaymentState({ icon, tone, title, text, orderNumber, children }: { icon: React.ReactNode; tone: 'info' | 'success' | 'error' | 'warning'; title: string; text: string; orderNumber?: string; children?: React.ReactNode }) {
  const colors = { info: 'bg-[#e8f4fb] text-[#17658a]', success: 'bg-[#e4f3e9] text-[#24723f]', error: 'bg-[#fdebea] text-[#a33a32]', warning: 'bg-[#fff5d9] text-[#835d00]' };
  return <main className="store-container flex min-h-[60vh] items-center justify-center"><section className="w-full max-w-2xl text-center"><span className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full text-3xl ${colors[tone]}`}>{icon}</span><h1 className="mt-6 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{title}</h1>{orderNumber && <p className="mt-3 font-mono text-sm font-bold text-[var(--sf-accent)]">{orderNumber}</p>}<p className="mx-auto mt-4 max-w-lg text-sm leading-7 text-[var(--sf-muted)] sm:text-base">{text}</p>{children}</section></main>;
}

export default function PaymentPage() {
  return <Suspense fallback={<main className="store-container flex min-h-[60vh] items-center justify-center"><LoadingOutlined spin className="text-3xl text-[var(--sf-accent)]" /></main>}><PaymentPageContent /></Suspense>;
}
