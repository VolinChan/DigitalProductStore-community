'use client';

import { useState } from 'react';
import { Form, Input, message } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import AuthShell from '@/components/storefront/AuthShell';
import apiClient from '@/lib/api';

export default function ForgotPasswordPage() {
  const t = useTranslations('forgotPassword');
  const auth = useTranslations('auth');
  const common = useTranslations('common');
  const locale = useLocale();
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');
  const submit = async (values: { email: string }) => {
    setSubmitting(true);
    try { await apiClient.post('/auth/password-reset/request', { email: values.email }); setSubmittedEmail(values.email); }
    catch (error: unknown) { const apiError = error as { response?: { data?: { error?: { message?: string } } } }; message.error(apiError?.response?.data?.error?.message || common('error')); }
    finally { setSubmitting(false); }
  };
  if (submittedEmail) return <AuthShell title={t('successTitle')} description={t('successDesc', { email: submittedEmail })}><Link href={`/${locale}/login`} className="sf-button-primary w-full">{auth('login')}</Link><button type="button" onClick={() => { form.setFieldsValue({ email: submittedEmail }); setSubmittedEmail(''); }} className="sf-button-secondary mt-3 w-full">{t('resend')}</button></AuthShell>;
  return <AuthShell title={auth('forgotPassword')} description={t('desc')}><Form form={form} layout="vertical" onFinish={submit} size="large" className="sf-auth-form"><Form.Item name="email" label={auth('emailLabel')} rules={[{ required: true, message: auth('emailPlaceholder') }, { type: 'email', message: auth('emailPlaceholder') }]}><Input autoComplete="email" inputMode="email" prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} /></Form.Item><button type="submit" disabled={submitting} className="sf-button-primary w-full">{submitting ? common('submitting') : t('submit')}</button></Form><Link href={`/${locale}/login`} className="mt-6 block text-center text-sm font-bold text-[var(--sf-accent)]">{auth('login')}</Link></AuthShell>;
}
