'use client';

import React, { Suspense } from 'react';
import { Result, Button, Typography, Descriptions, Tag, Spin } from 'antd';
import {
  CheckCircleOutlined,
  ShoppingOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

const { Paragraph, Text } = Typography;

/**
 * Order success page.
 * Displays order confirmation with order number and next steps based on payment method.
 *
 * Requirements:
 * - 2.5: Display unique order tracking number
 * - 7.5: Assign unique order number
 */
function CheckoutSuccessContent() {
  const t = useTranslations();
  const searchParams = useSearchParams();

  const orderNumber = searchParams.get('order_number');
  const method = searchParams.get('method');
  const paymentPending = searchParams.get('payment_pending') === 'true';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <Result
        status="success"
        icon={<CheckCircleOutlined className="text-green-500" />}
        title={t('checkout.successTitle')}
        subTitle={
          orderNumber
            ? t('checkout.successSub', { number: orderNumber })
            : t('checkout.successDefault')
        }
      />

      {/* Order Details */}
      {orderNumber && (
        <div className="max-w-md mx-auto mt-6">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label={t('checkout.orderNumber')}>
              <Text strong copyable>
                {orderNumber}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label={t('checkout.paymentMethod')}>
              {method === 'online' ? (
                <Tag color="blue">{t('payment.online')}</Tag>
              ) : (
                <Tag color="green">{t('payment.transfer')}</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label={t('checkout.paymentStatus')}>
              {paymentPending ? (
                <Tag color="orange" icon={<ClockCircleOutlined />}>
                  {t('checkout.pendingPayment')}
                </Tag>
              ) : method === 'transfer' ? (
                <Tag color="orange" icon={<ClockCircleOutlined />}>
                  {t('checkout.pendingProof')}
                </Tag>
              ) : (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  {t('checkout.paid')}
                </Tag>
              )}
            </Descriptions.Item>
          </Descriptions>
        </div>
      )}

      {/* Next Steps */}
      <div className="max-w-md mx-auto mt-8 bg-gray-50 rounded-lg p-6">
        <Paragraph strong className="!mb-3">
          <ShoppingOutlined className="mr-2" />
          {t('checkout.nextSteps')}
        </Paragraph>

        {method === 'online' && paymentPending && (
          <Paragraph type="secondary">
            {t('checkout.nextStepsOnlinePending')}
          </Paragraph>
        )}

        {method === 'online' && !paymentPending && (
          <Paragraph type="secondary">
            {t('checkout.nextStepsOnlinePaid')}
          </Paragraph>
        )}

        {method === 'transfer' && (
          <div>
            <Paragraph type="secondary">
              {t('checkout.nextStepsTransferIntro')}
            </Paragraph>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>{t('checkout.step1')}</li>
              <li>{t('checkout.step2')}</li>
              <li>{t('checkout.step3')}</li>
              <li>{t('checkout.step4')}</li>
            </ol>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href="/orders">
          <Button type="primary" size="large">
            {t('orders.title')}
          </Button>
        </Link>
        <Link href="/products">
          <Button size="large">{t('products.continueShopping')}</Button>
        </Link>
      </div>
    </main>
  );
}

export default function CheckoutSuccessPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="flex items-center justify-center min-h-[400px]">
            <Spin size="large" />
          </div>
        </main>
      }
    >
      <CheckoutSuccessContent />
    </Suspense>
  );
}
