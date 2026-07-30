'use client';

import React, { Suspense, useEffect, useRef, useState } from 'react';
import { Spin, Result, Button, Typography } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TransferPayment from '@/components/checkout/TransferPayment';
import apiClient from '@/lib/api';
import { useLocale, useTranslations } from 'next-intl';

const { Title, Paragraph } = Typography;

/**
 * Payment processing page content.
 * Handles both online payment redirect and transfer payment flow.
 *
 * Requirements:
 * - 9.1-9.2: Create payment session and redirect to payment gateway
 * - 9.3-9.4: Handle payment success/failure
 * - 10.1-10.8: Transfer payment flow (bank info, upload, deadline)
 */
function PaymentPageContent() {
  const t = useTranslations();
  const locale = useLocale();
  const searchParams = useSearchParams();

  const orderId = searchParams.get('order_id');
  const orderNumber = searchParams.get('order_number');
  const method = searchParams.get('method');
  const amount = searchParams.get('amount');
  const status = searchParams.get('status'); // For payment callback

  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>(
    status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending'
  );
  const [paymentError, setPaymentError] = useState<string | undefined>();
  const [confirmationDeadline, setConfirmationDeadline] = useState<string | undefined>();
  const automaticallyAttemptedOrderId = useRef<string | null>(null);

  // Handle online payment redirect
  useEffect(() => {
    if (
      method === 'online' &&
      paymentStatus === 'pending' &&
      orderId &&
      !status &&
      automaticallyAttemptedOrderId.current !== orderId
    ) {
      automaticallyAttemptedOrderId.current = orderId;
      handleOnlinePayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, orderId, status]);

  const handleOnlinePayment = async () => {
    setPaymentStatus('pending');
    setPaymentError(undefined);
    setLoading(true);
    try {
      const response = await apiClient.post<{
        data: { payment_url: string; session_id: string };
      }>('/payments/online/session', { order_id: Number(orderId) });

      const { payment_url } = response.data.data;

      if (payment_url) {
        // Redirect to payment gateway (Requirement 9.2)
        window.location.href = payment_url;
      } else {
        setPaymentError(t('payment.failedDefault'));
        setPaymentStatus('failed');
      }
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      setPaymentError(err.response?.data?.error?.message || t('payment.failedDefault'));
      setPaymentStatus('failed');
    } finally {
      setLoading(false);
    }
  };

  const handleTransferUploadSuccess = () => {
    // After successful upload, calculate deadline (7 days from now as approximation)
    const deadline = new Date();
    deadline.setDate(deadline.getDate() + 7);
    setConfirmationDeadline(deadline.toISOString());
  };

  // Online payment: loading/redirect state
  if (method === 'online' && paymentStatus === 'pending') {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          <Spin
            indicator={<LoadingOutlined className="text-4xl" spin />}
            size="large"
          />
          <Title level={3} className="!mt-6">
            {t('payment.redirecting')}
          </Title>
          <Paragraph type="secondary">
            {t('payment.pleaseWait')}
          </Paragraph>
          {loading && (
            <Paragraph type="secondary" className="!mt-4">
              {t('payment.retryHint')}
              <Button type="link" onClick={handleOnlinePayment} className="!px-1">
                {t('payment.retry')}
              </Button>
            </Paragraph>
          )}
        </div>
      </main>
    );
  }

  // Online payment: success (Requirement 9.3)
  if (method === 'online' && paymentStatus === 'success') {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Result
          status="success"
          icon={<CheckCircleOutlined />}
          title={t('payment.successTitle')}
          subTitle={
            orderNumber
              ? `${t('checkout.orderNumber')}: ${orderNumber}. ${t('payment.successSub')}`
              : t('payment.successDefault')
          }
          extra={[
            <Link key="orders" href={orderId ? `/${locale}/orders/${orderId}` : `/${locale}/orders`}>
              <Button type="primary" size="large">
                {t('orders.viewOrder')}
              </Button>
            </Link>,
            <Link key="home" href={`/${locale}`}>
              <Button size="large">{t('layout.home')}</Button>
            </Link>,
          ]}
        />
      </main>
    );
  }

  // Online payment: failed (Requirement 9.4)
  if (method === 'online' && paymentStatus === 'failed') {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <Result
          status="error"
          icon={<CloseCircleOutlined />}
          title={t('payment.failedTitle')}
          subTitle={
            orderNumber
              ? `${t('checkout.orderNumber')}: ${orderNumber}. ${paymentError || t('payment.failedSub')}`
              : paymentError || t('payment.failedDefault')
          }
          extra={[
            <Button
              key="retry"
              type="primary"
              size="large"
              onClick={handleOnlinePayment}
              loading={loading}
            >
              {t('payment.retry')}
            </Button>,
            <Link key="orders" href={orderId ? `/${locale}/orders/${orderId}` : `/${locale}/orders`}>
              <Button size="large">{t('orders.viewOrder')}</Button>
            </Link>,
          ]}
        />
      </main>
    );
  }

  // Transfer payment flow (Requirements 10.1-10.8)
  if (method === 'transfer' && orderId && orderNumber) {
    return (
      <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <Title level={2} className="!mb-6 text-center">
          {t('payment.transferTitle')}
        </Title>
        <Paragraph type="secondary" className="text-center !mb-8">
          {t('checkout.orderNumber')}: {orderNumber}
        </Paragraph>

        <TransferPayment
          orderId={Number(orderId)}
          orderNumber={orderNumber}
          totalAmount={Number(amount) || 0}
          confirmationDeadline={confirmationDeadline}
          onUploadSuccess={handleTransferUploadSuccess}
        />

        <div className="mt-8 text-center">
          <Link href={`/${locale}/orders/${orderId}`}>
            <Button type="link">{t('orders.viewOrder')}</Button>
          </Link>
        </div>
      </main>
    );
  }

  // Fallback: no valid params
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <Result
        status="warning"
        title={t('payment.errorTitle')}
        subTitle={t('payment.errorSub')}
        extra={[
          <Link key="orders" href={`/${locale}/orders`}>
            <Button type="primary" size="large">
              {t('orders.viewOrder')}
            </Button>
          </Link>,
          <Link key="home" href={`/${locale}`}>
            <Button size="large">{t('layout.home')}</Button>
          </Link>,
        ]}
      />
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={<PaymentPageFallback />}
    >
      <PaymentPageContent />
    </Suspense>
  );
}

function PaymentPageFallback() {
  const t = useTranslations();
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center">
        <Spin indicator={<LoadingOutlined className="text-4xl" spin />} size="large" />
        <Paragraph type="secondary" className="!mt-4">{t('common.loading')}</Paragraph>
      </div>
    </main>
  );
}
