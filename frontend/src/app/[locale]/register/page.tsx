'use client';

import { useEffect, useState } from 'react';
import { Form, Input, message } from 'antd';
import { LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import AuthShell from '@/components/storefront/AuthShell';
import { useAuthStore } from '@/store/useAuthStore';

export default function RegisterPage() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { register, isAuthenticated, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [mounted, setMounted] = useState(false);
  const destination = params.get('redirect') || `/${locale}`;
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted && isAuthenticated) router.push(destination); }, [destination, isAuthenticated, mounted, router]);
  const submit = async (values: { full_name: string; email: string; password: string; phone?: string }) => {
    try { await register(values); message.success(t('registerSuccess')); router.push(destination); }
    catch (error: unknown) { message.error((error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || t('registerFailed')); }
  };
  if (!mounted) return null;
  const loginHref = `/${locale}/login${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`;
  return <AuthShell title={t('register')} description={t('registerSubtitle')}><Form form={form} layout="vertical" onFinish={submit} autoComplete="on" size="large" className="sf-auth-form"><Form.Item name="full_name" label={t('nameLabel')} rules={[{ required: true, message: t('namePlaceholder') }, { min: 2, message: t('nameMin') }]}><Input autoComplete="name" prefix={<UserOutlined />} placeholder={t('namePlaceholder')} /></Form.Item><Form.Item name="email" label={t('emailLabel')} rules={[{ required: true, message: t('emailPlaceholder') }, { type: 'email', message: t('emailPlaceholder') }]}><Input autoComplete="email" inputMode="email" prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} /></Form.Item><Form.Item name="password" label={t('passwordLabel')} rules={[{ required: true, message: t('passwordRequired') }, { min: 8, message: t('passwordMin') }]}><Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder={t('passwordPlaceholder')} /></Form.Item><Form.Item name="confirm_password" label={t('confirmPasswordLabel')} dependencies={['password']} rules={[{ required: true, message: t('confirmPasswordPlaceholder') }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error(t('passwordMismatch'))); } })]}><Input.Password autoComplete="new-password" prefix={<LockOutlined />} placeholder={t('confirmPasswordPlaceholder')} /></Form.Item><Form.Item name="phone" label={t('phoneOptional')}><Input autoComplete="tel" inputMode="tel" prefix={<PhoneOutlined />} placeholder={t('phonePlaceholder')} /></Form.Item><button type="submit" disabled={isLoading} className="sf-button-primary w-full">{isLoading ? t('creatingAccount') : t('submitRegister')}</button></Form><div className="my-6 border-t border-[var(--sf-line)]" /><p className="text-center text-sm text-[var(--sf-muted)]">{t('haveAccount')}</p><Link href={loginHref} className="sf-button-secondary mt-4 w-full">{t('login')}</Link></AuthShell>;
}
