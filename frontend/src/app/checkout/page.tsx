'use client';

import React, { useState, useEffect } from 'react';
import { Button, Form, message, Spin, Empty, Steps } from 'antd';
import {
  ShoppingCartOutlined,
  CheckCircleOutlined,
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useCartStore } from '@/store/useCartStore';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import type { PaymentMethod } from '@/types';
import ShippingForm from '@/components/checkout/ShippingForm';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import OrderSummary from '@/components/checkout/OrderSummary';

/**
 * Main checkout page.
 * Collects shipping information, payment method selection, and displays order summary.
 * Supports both authenticated users (pre-fill info) and guests.
 *
 * Requirements:
 * - 2.2: Collect full name, email, phone, and shipping address for guests
 * - 2.3: Validate email format and phone number format
 * - 8.1: Display available payment method options
 * - 8.2: Allow selection of one payment method
 * - 8.3: Redirect to payment gateway for online payment
 * - 8.4: Display bank account info for transfer payment
 * - 8.5: Record selected payment method with order
 */
export default function CheckoutPage() {
  const router = useRouter();
  const [form] = Form.useForm();
  const { items, totalPrice, totalItems, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Ensure client-side rendering for hydration
  useEffect(() => {
    setMounted(true);
  }, []);

  // Pre-fill form for authenticated users
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
      // Validate shipping form (Requirement 2.3)
      const shippingInfo = await form.validateFields();

      setSubmitting(true);

      // Create order via API (Requirement 7.1, 8.5)
      const orderPayload = {
        full_name: shippingInfo.full_name,
        email: shippingInfo.email,
        phone: shippingInfo.phone,
        shipping_address: shippingInfo.address,
        payment_method: paymentMethod,
        items: items.map((item) => ({
          sku_id: item.sku_id,
          quantity: item.quantity,
        })),
      };

      const response = await apiClient.post<{
        data: { id: number; order_number: string; total_amount: number };
      }>('/orders', orderPayload);

      const order = response.data.data;

      // Clear cart after successful order creation
      await clearCart();

      // Route based on payment method
      if (paymentMethod === 'online') {
        // Create online payment session (Requirement 9.1)
        try {
          const paymentResponse = await apiClient.post<{
            data: { payment_url: string; session_id: string };
          }>('/payments/online/session', { order_id: order.id });

          const { payment_url } = paymentResponse.data.data;

          // Redirect to payment gateway (Requirement 9.2, 8.3)
          if (payment_url) {
            window.location.href = payment_url;
          } else {
            // Fallback: go to payment page
            router.push(
              `/checkout/payment?order_id=${order.id}&order_number=${order.order_number}&method=online`
            );
          }
        } catch {
          // If payment session creation fails, redirect to payment page
          message.warning('支付会话创建失败，请在订单中重新发起支付');
          router.push(
            `/checkout/success?order_number=${order.order_number}&method=online&payment_pending=true`
          );
        }
      } else {
        // Transfer payment: redirect to payment page with bank info
        router.push(
          `/checkout/payment?order_id=${order.id}&order_number=${order.order_number}&amount=${order.total_amount}&method=transfer`
        );
      }
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) {
        // Form validation error - already shown by antd
        return;
      }
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errorMessage =
        err?.response?.data?.error?.message || '订单创建失败，请重试';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  // Show loading state until mounted (avoid hydration mismatch)
  if (!mounted) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // Empty cart state
  if (items.length === 0) {
    return (
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col items-center justify-center py-16">
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description="购物车是空的，无法结算"
          >
            <Link href="/products">
              <Button type="primary" size="large">
                去逛逛
              </Button>
            </Link>
          </Empty>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Page Header */}
      <div className="mb-6">
        <Steps
          current={1}
          items={[
            { title: '购物车', icon: <ShoppingCartOutlined /> },
            { title: '填写信息', icon: <CheckCircleOutlined /> },
            { title: '完成支付' },
          ]}
          className="max-w-lg mx-auto"
        />
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column: Forms */}
        <div className="flex-1 space-y-6">
          {/* Shipping Information Form */}
          <ShippingForm
            form={form}
            initialValues={
              isAuthenticated && user
                ? {
                    full_name: user.full_name,
                    email: user.email,
                    phone: user.phone || '',
                  }
                : undefined
            }
          />

          {/* Payment Method Selection */}
          <PaymentMethodSelector
            value={paymentMethod}
            onChange={setPaymentMethod}
          />
        </div>

        {/* Right Column: Order Summary */}
        <div className="w-full lg:w-96 lg:flex-shrink-0">
          <div className="sticky top-4 space-y-4">
            <OrderSummary
              items={items}
              totalPrice={totalPrice}
              shippingFee={0}
            />

            {/* Submit Button */}
            <Button
              type="primary"
              size="large"
              block
              onClick={handleSubmitOrder}
              loading={submitting}
              className="!h-12 !text-base !font-medium"
            >
              {submitting
                ? '提交中...'
                : paymentMethod === 'online'
                ? '提交订单并支付'
                : '提交订单'}
            </Button>

            {/* Info text */}
            <p className="text-xs text-gray-500 text-center">
              {paymentMethod === 'online'
                ? '提交后将跳转到支付页面完成付款'
                : '提交后将显示银行转账信息'}
            </p>

            {/* Back to cart */}
            <Link href="/cart" className="block">
              <Button type="link" block>
                返回购物车
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
