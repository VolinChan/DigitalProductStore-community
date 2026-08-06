'use client';

import { Suspense, useEffect, useState } from 'react';
import { Form, Input, message, Spin } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import AuthShell from '@/components/storefront/AuthShell';
import { useAuthStore } from '@/store/useAuthStore';
import { sanitizeLocalRedirect } from '@/lib/admin-navigation';

function LoginForm() {
  const t = useTranslations('auth');
  const locale = useLocale();
  const router = useRouter();
  const params = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [mounted, setMounted] = useState(false);
  const destination = sanitizeLocalRedirect(params.get('redirect'), `/${locale}`);
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted && isAuthenticated) router.push(destination); }, [destination, isAuthenticated, mounted, router]);
  const submit = async (values: { email: string; password: string }) => {
    try { await login(values); message.success(t('loginSuccess')); router.push(destination); }
    catch (error: unknown) { message.error((error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || t('loginFailed')); }
  };
  if (!mounted) return null;
  const registerHref = `/${locale}/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`;
  return <AuthShell title={t('login')} description={t('welcomeBack')}><Form form={form} layout="vertical" onFinish={submit} autoComplete="on" size="large" className="sf-auth-form"><Form.Item name="email" label={t('emailLabel')} rules={[{ required: true, message: t('emailPlaceholder') }, { type: 'email', message: t('emailPlaceholder') }]}><Input autoComplete="email" inputMode="email" prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} /></Form.Item><Form.Item name="password" label={t('passwordLabel')} rules={[{ required: true, message: t('passwordRequired') }]}><Input.Password autoComplete="current-password" prefix={<LockOutlined />} placeholder={t('passwordPlaceholder')} /></Form.Item><div className="mb-5 flex justify-end"><Link href={`/${locale}/forgot-password`} className="text-sm font-bold text-[var(--sf-accent)]">{t('forgotPassword')}</Link></div><button type="submit" disabled={isLoading} className="sf-button-primary w-full">{isLoading ? t('login') : t('submitLogin')}</button></Form><div className="my-6 border-t border-[var(--sf-line)]" /><p className="text-center text-sm text-[var(--sf-muted)]">{t('noAccount')}</p><Link href={registerHref} className="sf-button-secondary mt-4 w-full">{t('createAccount')}</Link></AuthShell>;
}

export default function LoginPage() {
  return <Suspense fallback={<div className="flex min-h-[400px] items-center justify-center"><Spin size="large" /></div>}><LoginForm /></Suspense>;
}
