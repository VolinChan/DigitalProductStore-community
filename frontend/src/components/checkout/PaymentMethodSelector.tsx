'use client';

import React from 'react';
import { Typography, Radio, Space } from 'antd';
import {
  CreditCardOutlined,
  BankOutlined,
  SafetyCertificateOutlined,
} from '@ant-design/icons';
import type { PaymentMethod } from '@/types';

const { Title, Text } = Typography;

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

/**
 * Payment method selection component.
 * Allows user to choose between online payment and bank transfer.
 *
 * Requirements:
 * - 8.1: Display available payment method options (online and transfer)
 * - 8.2: Allow user to select one payment method before completing the order
 */
export default function PaymentMethodSelector({
  value,
  onChange,
}: PaymentMethodSelectorProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Title level={4} className="!mb-4">
        <SafetyCertificateOutlined className="mr-2" />
        支付方式
      </Title>

      <Radio.Group
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full"
      >
        <Space direction="vertical" className="w-full" size="middle">
          {/* Online Payment Option */}
          <Radio value="online" className="w-full">
            <div
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                value === 'online'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <CreditCardOutlined className="text-2xl text-blue-500" />
                <div>
                  <Text strong className="block">
                    在线支付
                  </Text>
                  <Text type="secondary" className="text-xs">
                    通过 Stripe/PayPal 等支付网关即时完成支付，安全快捷
                  </Text>
                </div>
              </div>
            </div>
          </Radio>

          {/* Transfer Payment Option */}
          <Radio value="transfer" className="w-full">
            <div
              className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                value === 'transfer'
                  ? 'border-blue-400 bg-blue-50'
                  : 'border-gray-200 hover:border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <BankOutlined className="text-2xl text-green-500" />
                <div>
                  <Text strong className="block">
                    转账支付
                  </Text>
                  <Text type="secondary" className="text-xs">
                    通过银行转账支付，上传转账凭证后由管理员确认（7 天内确认）
                  </Text>
                </div>
              </div>
            </div>
          </Radio>
        </Space>
      </Radio.Group>
    </div>
  );
}
