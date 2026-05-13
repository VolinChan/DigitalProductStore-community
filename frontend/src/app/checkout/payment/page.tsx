'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { Spin, Result, Button, Typography } from 'antd';
import {
  LoadingOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
} from '@ant-design/icons';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import TransferPayment from '@/components/checkout/TransferPayment';
import apiClient from '@/lib/api';

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
  const searchParams = useSearchParams();
  const router = useRouter();

  const orderId = searchParams.get('order_id');
  const orderNumber = searchParams.get('order_number');
  const method = searchParams.get('method');
  const amount = searchParams.get('amount');
  const status = searchParams.get('status'); // For payment callback

  const [loading, setLoading] = useState(false);
  const [paymentStatus, setPaymentStatus] = useState<'pending' | 'success' | 'failed'>(
    status === 'success' ? 'success' : status === 'failed' ? 'failed' : 'pending'
  );
  const [confirmationDeadline, setConfirmationDeadline] = useState<string | undefined>();

  // Handle online payment redirect
  useEffect(() => {
    if (method === 'online' && paymentStatus === 'pending' && orderId && !status) {
      handleOnlinePayment();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [method, orderId, status]);

  const handleOnlinePayment = async () => {
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
        setPaymentStatus('failed');
      }
    } catch {
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
            正在跳转到支付页面...
          </Title>
          <Paragraph type="secondary">
            请稍候，正在为您创建支付会话并跳转到支付网关
          </Paragraph>
          {loading && (
            <Paragraph type="secondary" className="!mt-4">
              如果长时间未跳转，请
              <Button type="link" onClick={handleOnlinePayment} className="!px-1">
                点击这里重试
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
          title="支付成功"
          subTitle={
            orderNumber
              ? `订单号：${orderNumber}，支付已完成`
              : '您的支付已成功完成'
          }
          extra={[
            <Link key="orders" href="/orders">
              <Button type="primary" size="large">
                查看订单
              </Button>
            </Link>,
            <Link key="home" href="/">
              <Button size="large">返回首页</Button>
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
          title="支付失败"
          subTitle={
            orderNumber
              ? `订单号：${orderNumber}，支付未完成。您可以稍后重新发起支付。`
              : '支付过程中出现问题，请重试'
          }
          extra={[
            <Button
              key="retry"
              type="primary"
              size="large"
              onClick={handleOnlinePayment}
            >
              重新支付
            </Button>,
            <Link key="orders" href="/orders">
              <Button size="large">查看订单</Button>
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
          转账支付
        </Title>
        <Paragraph type="secondary" className="text-center !mb-8">
          订单号：{orderNumber}
        </Paragraph>

        <TransferPayment
          orderId={Number(orderId)}
          orderNumber={orderNumber}
          totalAmount={Number(amount) || 0}
          confirmationDeadline={confirmationDeadline}
          onUploadSuccess={handleTransferUploadSuccess}
        />

        <div className="mt-8 text-center">
          <Link href="/orders">
            <Button type="link">查看我的订单</Button>
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
        title="页面参数错误"
        subTitle="无法确定支付信息，请从订单页面重新发起支付"
        extra={[
          <Link key="orders" href="/orders">
            <Button type="primary" size="large">
              查看订单
            </Button>
          </Link>,
          <Link key="home" href="/">
            <Button size="large">返回首页</Button>
          </Link>,
        ]}
      />
    </main>
  );
}

export default function PaymentPage() {
  return (
    <Suspense
      fallback={
        <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <Spin indicator={<LoadingOutlined className="text-4xl" spin />} size="large" />
            <Paragraph type="secondary" className="!mt-4">加载中...</Paragraph>
          </div>
        </main>
      }
    >
      <PaymentPageContent />
    </Suspense>
  );
}
