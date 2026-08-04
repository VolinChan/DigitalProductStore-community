'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircleFilled, ClockCircleOutlined, LoadingOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import OrderTrackingLink from '@/components/order/OrderTrackingLink';

function CheckoutSuccessContent() {
  const t = useTranslations();
  const locale = useLocale();
  const params = useSearchParams();
  const orderId = params.get('order_id');
  const orderNumber = params.get('order_number');
  const method = params.get('method');
  const paymentPending = params.get('payment_pending') === 'true';
  const paymentStatus = paymentPending ? t('checkout.pendingPayment') : method === 'transfer' ? t('checkout.pendingProof') : t('checkout.paid');
  const nextStep = method === 'transfer' ? 'transfer' : paymentPending ? 'onlinePending' : 'onlinePaid';
  const orderHref = orderId ? `/${locale}/orders/${orderId}` : `/${locale}/orders`;

  return (
    <main className="store-container">
      <section className="mx-auto max-w-3xl text-center">
        <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[#e4f3e9] text-3xl text-[#24723f]"><CheckCircleFilled /></span>
        <h1 className="mt-6 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('checkout.successTitle')}</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-[var(--sf-muted)] sm:text-base">{orderNumber ? t('checkout.successSub', { number: orderNumber }) : t('checkout.successDefault')}</p>

        {orderNumber && <dl className="mx-auto mt-8 grid max-w-xl gap-px overflow-hidden rounded-[18px] bg-[var(--sf-line)] text-left sm:grid-cols-3">
          <div className="bg-white p-4"><dt className="text-xs font-bold text-[var(--sf-muted)]">{t('checkout.orderNumber')}</dt><dd className="mt-2 break-all font-mono text-sm font-black text-[var(--sf-ink)]">{orderNumber}</dd></div>
          <div className="bg-white p-4"><dt className="text-xs font-bold text-[var(--sf-muted)]">{t('checkout.paymentMethod')}</dt><dd className="mt-2 text-sm font-black text-[var(--sf-ink)]">{method === 'online' ? t('payment.online') : t('payment.transfer')}</dd></div>
          <div className="bg-white p-4"><dt className="text-xs font-bold text-[var(--sf-muted)]">{t('checkout.paymentStatus')}</dt><dd className="mt-2 inline-flex items-center gap-1.5 text-sm font-black text-[#835d00]"><ClockCircleOutlined />{paymentStatus}</dd></div>
        </dl>}

        <div className="mx-auto mt-8 max-w-xl border-t border-[var(--sf-line)] pt-7 text-left">
          <h2 className="flex items-center gap-2 text-lg font-black text-[var(--sf-ink)]"><ShoppingOutlined className="text-[var(--sf-accent)]" />{t('checkout.nextSteps')}</h2>
          {nextStep === 'onlinePending' && <p className="mt-3 text-sm leading-7 text-[var(--sf-subtle)]">{t('checkout.nextStepsOnlinePending')}</p>}
          {nextStep === 'onlinePaid' && <p className="mt-3 text-sm leading-7 text-[var(--sf-subtle)]">{t('checkout.nextStepsOnlinePaid')}</p>}
          {nextStep === 'transfer' && <><p className="mt-3 text-sm leading-7 text-[var(--sf-subtle)]">{t('checkout.nextStepsTransferIntro')}</p><ol className="mt-4 space-y-3 text-sm text-[var(--sf-subtle)]">{['step1', 'step2', 'step3', 'step4'].map((key, index) => <li key={key} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sf-soft-blue)] text-xs font-black text-[var(--sf-accent)]">{index + 1}</span><span className="pt-0.5">{t(`checkout.${key}`)}</span></li>)}</ol></>}
        </div>

        <div className="mt-9 flex flex-col gap-3 sm:flex-row sm:justify-center"><Link href={orderHref} className="sf-button-primary">{orderId ? t('orders.viewOrder') : t('orders.title')}</Link><OrderTrackingLink orderNumber={orderNumber || undefined} className="sf-button-secondary" /><Link href={`/${locale}/products`} className="sf-button-secondary">{t('products.continueShopping')}</Link></div>
      </section>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return <Suspense fallback={<main className="store-container flex min-h-[60vh] items-center justify-center"><LoadingOutlined spin className="text-3xl text-[var(--sf-accent)]" /></main>}><CheckoutSuccessContent /></Suspense>;
}
