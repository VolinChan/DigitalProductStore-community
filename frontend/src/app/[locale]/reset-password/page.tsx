'use client';

import { Suspense, useState } from 'react';
import { Form, Input, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import AuthShell from '@/components/storefront/AuthShell';
import apiClient from '@/lib/api';

type ResetValues = { password: string; confirmPassword: string };

function ResetPasswordContent() {
  const t = useTranslations('resetPassword');
  const common = useTranslations('common');
  const locale = useLocale();
  const params = useSearchParams();
  const token = params.get('token') || '';
  const [submitting, setSubmitting] = useState(false);
  const [complete, setComplete] = useState(false);

  const submit = async (values: ResetValues) => {
    if (!token) { message.error(t('invalidLink')); return; }
    setSubmitting(true);
    try {
      await apiClient.post('/auth/password-reset/confirm', { token, new_password: values.password });
      setComplete(true);
    } catch {
      message.error(t('invalidLink'));
    } finally {
      setSubmitting(false);
    }
  };

  if (!token) return <AuthShell title={t('invalidTitle')} description={t('invalidLink')}><Link href={`/${locale}/forgot-password`} className="sf-button-primary w-full">{t('requestAgain')}</Link></AuthShell>;
  if (complete) return <AuthShell title={t('successTitle')} description={t('successDescription')}><Link href={`/${locale}/login`} className="sf-button-primary w-full">{t('signIn')}</Link></AuthShell>;

  return <AuthShell title={t('title')} description={t('description')}><Form layout="vertical" onFinish={submit} size="large" className="sf-auth-form"><Form.Item name="password" label={t('newPassword')} rules={[{ required: true, message: t('passwordRequired') }, { min: 8, max: 72, message: t('passwordLength') }]}><Input.Password autoComplete="new-password" prefix={<LockOutlined />} /></Form.Item><Form.Item name="confirmPassword" label={t('confirmPassword')} dependencies={['password']} rules={[{ required: true, message: t('confirmRequired') }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error(t('passwordMismatch'))); } })]}><Input.Password autoComplete="new-password" prefix={<LockOutlined />} /></Form.Item><button type="submit" disabled={submitting} className="sf-button-primary w-full">{submitting ? common('submitting') : t('submit')}</button></Form></AuthShell>;
}

export default function ResetPasswordPage() { return <Suspense><ResetPasswordContent /></Suspense>; }
