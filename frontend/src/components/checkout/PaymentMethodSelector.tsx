'use client';

import React from 'react';
import { Typography, Radio, Space } from 'antd';
import { CreditCardOutlined, BankOutlined, SafetyCertificateOutlined } from '@ant-design/icons';
import type { PaymentMethod } from '@/types';
import { useTranslations } from 'next-intl';

const { Title, Text } = Typography;

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
}

export default function PaymentMethodSelector({ value, onChange }: PaymentMethodSelectorProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Title level={4} className="!mb-4">
        <SafetyCertificateOutlined className="mr-2" />
        {t('checkout.paymentMethod')}
      </Title>

      <Radio.Group value={value} onChange={(e) => onChange(e.target.value)} className="w-full">
        <Space orientation="vertical" className="w-full" size="middle">
          {/* Online Payment Option */}
          <Radio value="online" className="w-full">
            <div className={`p-4 rounded-lg border transition-colors cursor-pointer ${value === 'online' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-blue-200 dark:hover:border-blue-800'}`}>
              <div className="flex items-center gap-3">
                <CreditCardOutlined className="text-2xl text-blue-500" />
                <div>
                  <Text strong className="block">{t('payment.online')}</Text>
                  <Text type="secondary" className="text-xs">{t('payment.onlineDesc')}</Text>
                </div>
              </div>
            </div>
          </Radio>

          {/* Transfer Payment Option */}
          <Radio value="transfer" className="w-full">
            <div className={`p-4 rounded-lg border transition-colors cursor-pointer ${value === 'transfer' ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/20' : 'border-gray-200 hover:border-blue-200 dark:hover:border-blue-800'}`}>
              <div className="flex items-center gap-3">
                <BankOutlined className="text-2xl text-green-500" />
                <div>
                  <Text strong className="block">{t('payment.transfer')}</Text>
                  <Text type="secondary" className="text-xs">{t('payment.transferDesc')}</Text>
                </div>
              </div>
            </div>
          </Radio>
        </Space>
      </Radio.Group>
    </div>
  );
}
