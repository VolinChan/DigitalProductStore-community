'use client';

import { Form, Input } from 'antd';
import { EnvironmentOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';

export interface ShippingInfo { full_name: string; email: string; phone: string; address: string; region?: string; commune?: string }
interface ShippingFormProps { form: ReturnType<typeof Form.useForm>[0]; initialValues?: Partial<ShippingInfo> }

export default function ShippingForm({ form, initialValues }: ShippingFormProps) {
  const t = useTranslations();
  return (
    <Form form={form} layout="vertical" initialValues={initialValues} requiredMark="optional" className="sf-checkout-form">
      <div className="grid gap-x-4 sm:grid-cols-2">
        <Form.Item name="full_name" label={t('shipping.fullName')} rules={[{ required: true, message: t('shipping.fullNameRequired') }, { min: 2, message: t('shipping.fullNameMin') }, { max: 100, message: t('shipping.fullNameMax') }]}><Input autoComplete="name" prefix={<UserOutlined />} placeholder={t('shipping.fullName')} size="large" /></Form.Item>
        <Form.Item name="email" label={t('shipping.email')} rules={[{ required: true, message: t('shipping.emailRequired') }, { type: 'email', message: t('shipping.emailInvalid') }]}><Input autoComplete="email" inputMode="email" prefix={<MailOutlined />} placeholder={t('shipping.email')} size="large" /></Form.Item>
        <Form.Item name="phone" label={t('shipping.phone')} rules={[{ required: true, message: t('shipping.phoneRequired') }, { pattern: /^(\+?\d{1,4}[-\s]?)?(\d{7,15})$/, message: t('shipping.phoneInvalid') }]}><Input autoComplete="tel" inputMode="tel" prefix={<PhoneOutlined />} placeholder="+56 9 ..." size="large" /></Form.Item>
        <Form.Item name="region" label={t('shipping.region')} rules={[{ required: true, message: t('shipping.regionRequired') }]}><Input autoComplete="address-level1" placeholder={t('shipping.region')} size="large" /></Form.Item>
        <Form.Item name="commune" label={t('shipping.commune')} rules={[{ required: true, message: t('shipping.communeRequired') }]}><Input autoComplete="address-level2" placeholder={t('shipping.commune')} size="large" /></Form.Item>
      </div>
      <Form.Item name="address" label={t('shipping.address')} rules={[{ required: true, message: t('shipping.addressRequired') }, { min: 5, message: t('shipping.addressMin') }]}><Input.TextArea autoComplete="street-address" placeholder={t('shipping.addressPlaceholder')} rows={4} showCount maxLength={500} /></Form.Item>
    </Form>
  );
}
