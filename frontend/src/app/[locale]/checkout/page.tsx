'use client';

import React, { useEffect, useState } from 'react';
import { Button, Form, Spin, Steps, message, Typography } from 'antd';
import { ShoppingCartOutlined, CheckCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import EmptyState from '@/components/EmptyState';
import apiClient from '@/lib/api';
import type { PaymentMethod } from '@/types';
import ShippingForm from '@/components/checkout/ShippingForm';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import OrderSummary from '@/components/checkout/OrderSummary';
import { useLocale, useTranslations } from 'next-intl';

const { Title } = Typography;

/**
 * Modern checkout page.
 * Requirements: 2.2-2.3, 7.1-7.8, 8.1-8.5, 37.1-37.8
 */
export default function CheckoutPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const [form] = Form.useForm();
  const { items, totalPrice, totalItems, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      form.setFieldsValue({
        full_name: user.full_name || '',
        email: user.email || '',
        phone: user.phone || '',
      });
    }
  }, [isAuthenticated, user, form]);

  const handleSubmitOrder = async () => {
    try {
      const shippingInfo = await form.validateFields();
      setSubmitting(true);

      const orderPayload = {
        guest_name: shippingInfo.full_name,
        guest_email: shippingInfo.email,
        guest_phone: shippingInfo.phone,
        shipping_address: shippingInfo.address,
        payment_method: paymentMethod,
        items: items.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })),
      };

      const response = await apiClient.post<{
        data: { id: number; order_number: string; total_amount: number };
      }>('/orders', orderPayload);

      const order = response.data.data;
      await clearCart();

      if (paymentMethod === 'online') {
        router.push(
          `/${locale}/checkout/payment?order_id=${order.id}&order_number=${encodeURIComponent(order.order_number)}&method=online`
        );
      } else {
        router.push(
          `/${locale}/checkout/payment?order_id=${order.id}&order_number=${encodeURIComponent(order.order_number)}&amount=${order.total_amount}&method=transfer`
        );
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      message.error(err?.response?.data?.error?.message || t('checkout.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) {
    return (
      <main className="store-container flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </main>
    );
  }

  if (items.length === 0) {
    return (
      <main className="store-container" id="main-content">
        <div className="animate-fade-in-up">
          <TitleWrapper title={t('checkout.title')} />
          <EmptyState
            title={t('checkout.emptyCart')}
            actionLabel={t('checkout.goBrowse')}
            actionHref={`/${locale}/products`}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up space-y-6 sm:space-y-8">
        {/* Header */}
        <div>
          <Link href={`/${locale}/cart`} className="inline-flex items-center gap-1 text-sm text-muted hover:text-accent mb-4 transition-colors">
            <ArrowLeftOutlined /> {t('checkout.backToCart')}
          </Link>
          <h1 className="text-2xl font-bold tracking-tight">{t('checkout.title')}</h1>
        </div>

        {/* Steps */}
        <div className="bg-card rounded-xl border shadow-card p-4 sm:p-6">
          <Steps
            current={1}
            items={[
              { title: t('checkout.stepCart'), icon: <ShoppingCartOutlined /> },
              { title: t('checkout.stepInfo'), icon: <CheckCircleOutlined /> },
              { title: t('checkout.stepPayment') },
            ]}
            className="max-w-lg mx-auto"
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Forms */}
          <div className="lg:col-span-2 space-y-6">
            <section className="bg-card rounded-xl border shadow-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">{t('checkout.shippingInfo')}</h2>
              <ShippingForm
                form={form}
                initialValues={
                  isAuthenticated && user
                    ? { full_name: user.full_name, email: user.email, phone: user.phone || '' }
                    : undefined
                }
              />
            </section>

            <section className="bg-card rounded-xl border shadow-card p-5 sm:p-6">
              <h2 className="text-lg font-semibold mb-4">{t('checkout.paymentMethod')}</h2>
              <PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} />
            </section>
          </div>

          {/* Summary Sidebar */}
          <div className="lg:col-span-1">
            <div className="sticky top-24 space-y-4">
              <div className="bg-card rounded-xl border shadow-card p-5">
                <h2 className="text-lg font-semibold mb-4">{t('checkout.orderSummary')}</h2>
                <OrderSummary items={items} totalPrice={totalPrice} shippingFee={0} />
              </div>

              <button className="store-btn-primary w-full !py-3 !text-base" onClick={handleSubmitOrder} disabled={submitting}>
                {submitting ? t('checkout.submitting') : paymentMethod === 'online' ? t('checkout.submitAndPay') : t('checkout.submitOrder')}
              </button>

              <p className="text-xs text-muted text-center">
                {paymentMethod === 'online' ? t('checkout.submitOnline') : t('checkout.submitTransfer')}
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function TitleWrapper({ title }: { title: string }) {
  return <Title level={1} className="!mb-0 !text-2xl">{title}</Title>;
}
