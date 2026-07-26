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
  const searchParams = useSearchParams();

  const orderNumber = searchParams.get('order_number');
  const method = searchParams.get('method');
  const paymentPending = searchParams.get('payment_pending') === 'true';

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12 lg:py-16">
      <Result
        status="success"
        icon={<CheckCircleOutlined className="text-green-500" />}
        title="订单提交成功"
        subTitle={
          orderNumber
            ? `您的订单号为 ${orderNumber}，请妥善保存`
            : '您的订单已成功创建'
        }
      />

      {/* Order Details */}
      {orderNumber && (
        <div className="max-w-md mx-auto mt-6">
          <Descriptions column={1} bordered size="small">
            <Descriptions.Item label="订单号">
              <Text strong copyable>
                {orderNumber}
              </Text>
            </Descriptions.Item>
            <Descriptions.Item label="支付方式">
              {method === 'online' ? (
                <Tag color="blue">在线支付</Tag>
              ) : (
                <Tag color="green">转账支付</Tag>
              )}
            </Descriptions.Item>
            <Descriptions.Item label="订单状态">
              {paymentPending ? (
                <Tag color="orange" icon={<ClockCircleOutlined />}>
                  待支付
                </Tag>
              ) : method === 'transfer' ? (
                <Tag color="orange" icon={<ClockCircleOutlined />}>
                  待上传凭证
                </Tag>
              ) : (
                <Tag color="green" icon={<CheckCircleOutlined />}>
                  已支付
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
          下一步
        </Paragraph>

        {method === 'online' && paymentPending && (
          <Paragraph type="secondary">
            您的订单已创建，但支付尚未完成。请前往订单详情页重新发起支付。
          </Paragraph>
        )}

        {method === 'online' && !paymentPending && (
          <Paragraph type="secondary">
            支付已完成，我们将尽快为您安排发货。您可以在订单详情中查看物流信息。
          </Paragraph>
        )}

        {method === 'transfer' && (
          <div>
            <Paragraph type="secondary">
              请按照以下步骤完成转账支付：
            </Paragraph>
            <ol className="list-decimal list-inside text-sm text-gray-600 space-y-1">
              <li>使用银行转账方式支付订单金额</li>
              <li>转账时请在备注中填写订单号</li>
              <li>转账完成后上传转账凭证</li>
              <li>管理员将在 7 天内确认您的付款</li>
            </ol>
          </div>
        )}
      </div>

      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-3 justify-center mt-8">
        <Link href="/orders">
          <Button type="primary" size="large">
            查看我的订单
          </Button>
        </Link>
        <Link href="/products">
          <Button size="large">继续购物</Button>
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
