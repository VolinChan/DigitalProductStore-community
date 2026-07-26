'use client';

import React from 'react';
import { Form, Input, Typography } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';
import { useTranslations } from 'next-intl';

const { Title } = Typography;
const { TextArea } = Input;

export interface ShippingInfo {
  full_name: string;
  email: string;
  phone: string;
  address: string;
  region?: string;
  commune?: string;
}

interface ShippingFormProps {
  form: ReturnType<typeof Form.useForm>[0];
  initialValues?: Partial<ShippingInfo>;
}

/**
 * Shipping information form component.
 * Collects full name, email, phone, and shipping address.
 * Supports Chilean address fields (Región, Comuna).
 */
export default function ShippingForm({ form, initialValues }: ShippingFormProps) {
  const t = useTranslations();

  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Title level={4} className="!mb-4">
        <EnvironmentOutlined className="mr-2" />
        {t('checkout.shippingInfo')}
      </Title>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        requiredMark="optional"
      >
        <Form.Item
          name="full_name"
          label={t('shipping.fullName')}
          rules={[
            { required: true, message: t('shipping.fullNameRequired') },
            { min: 2, message: t('shipping.fullNameMin') },
            { max: 100, message: t('shipping.fullNameMax') },
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-gray-400" />}
            placeholder={t('shipping.fullName')}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label={t('shipping.email')}
          rules={[
            { required: true, message: t('shipping.emailRequired') },
            { type: 'email', message: t('shipping.emailInvalid') },
          ]}
        >
          <Input
            prefix={<MailOutlined className="text-gray-400" />}
            placeholder={t('shipping.email')}
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label={t('shipping.phone')}
          rules={[
            { required: true, message: t('shipping.phoneRequired') },
            {
              pattern: /^(\+?\d{1,4}[-\s]?)?(\d{7,15})$/,
              message: t('shipping.phoneInvalid'),
            },
          ]}
        >
          <Input
            prefix={<PhoneOutlined className="text-gray-400" />}
            placeholder="+56 9 ..."
            size="large"
          />
        </Form.Item>

        {/* Chilean address fields */}
        <Form.Item
          name="region"
          label={t('shipping.region')}
          rules={[
            { required: true, message: t('shipping.regionRequired') },
          ]}
        >
          <Input placeholder={t('shipping.region')} size="large" />
        </Form.Item>

        <Form.Item
          name="commune"
          label={t('shipping.commune')}
          rules={[
            { required: true, message: t('shipping.communeRequired') },
          ]}
        >
          <Input placeholder={t('shipping.commune')} size="large" />
        </Form.Item>

        <Form.Item
          name="address"
          label={t('shipping.address')}
          rules={[
            { required: true, message: t('shipping.addressRequired') },
            { min: 5, message: t('shipping.addressMin') },
          ]}
        >
          <TextArea
            placeholder={t('shipping.addressPlaceholder')}
            rows={3}
            showCount
            maxLength={500}
          />
        </Form.Item>
      </Form>
    </div>
  );
}
