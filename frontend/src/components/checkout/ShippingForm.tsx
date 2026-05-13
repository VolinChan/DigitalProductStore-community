'use client';

import React from 'react';
import { Form, Input, Typography } from 'antd';
import {
  UserOutlined,
  MailOutlined,
  PhoneOutlined,
  EnvironmentOutlined,
} from '@ant-design/icons';

const { Title } = Typography;
const { TextArea } = Input;

export interface ShippingInfo {
  full_name: string;
  email: string;
  phone: string;
  address: string;
}

interface ShippingFormProps {
  form: ReturnType<typeof Form.useForm>[0];
  initialValues?: Partial<ShippingInfo>;
}

/**
 * Shipping information form component.
 * Collects full name, email, phone, and shipping address.
 *
 * Requirements:
 * - 2.2: Collect full name, email, phone, and shipping address
 * - 2.3: Validate email format and phone number format
 */
export default function ShippingForm({ form, initialValues }: ShippingFormProps) {
  return (
    <div className="bg-white rounded-lg p-6 border border-gray-200">
      <Title level={4} className="!mb-4">
        <EnvironmentOutlined className="mr-2" />
        收货信息
      </Title>

      <Form
        form={form}
        layout="vertical"
        initialValues={initialValues}
        requiredMark="optional"
      >
        <Form.Item
          name="full_name"
          label="收货人姓名"
          rules={[
            { required: true, message: '请输入收货人姓名' },
            { min: 2, message: '姓名至少 2 个字符' },
            { max: 100, message: '姓名不能超过 100 个字符' },
          ]}
        >
          <Input
            prefix={<UserOutlined className="text-gray-400" />}
            placeholder="请输入收货人姓名"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="email"
          label="邮箱地址"
          rules={[
            { required: true, message: '请输入邮箱地址' },
            { type: 'email', message: '请输入有效的邮箱地址' },
          ]}
        >
          <Input
            prefix={<MailOutlined className="text-gray-400" />}
            placeholder="请输入邮箱地址"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="phone"
          label="联系电话"
          rules={[
            { required: true, message: '请输入联系电话' },
            {
              pattern: /^(\+?\d{1,4}[-\s]?)?(\d{7,15})$/,
              message: '请输入有效的电话号码',
            },
          ]}
        >
          <Input
            prefix={<PhoneOutlined className="text-gray-400" />}
            placeholder="请输入联系电话"
            size="large"
          />
        </Form.Item>

        <Form.Item
          name="address"
          label="收货地址"
          rules={[
            { required: true, message: '请输入收货地址' },
            { min: 5, message: '地址至少 5 个字符' },
          ]}
        >
          <TextArea
            placeholder="请输入详细收货地址（省/市/区/街道/门牌号）"
            rows={3}
            showCount
            maxLength={500}
          />
        </Form.Item>
      </Form>
    </div>
  );
}
