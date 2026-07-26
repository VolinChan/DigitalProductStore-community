'use client';

import { Suspense, useEffect, useState } from 'react';
import { Button, Card, Divider, Form, Input, message, Spin } from 'antd';
import { LockOutlined, MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import { useAuthStore } from '@/store/useAuthStore';

function LoginForm() {
  const t = useTranslations('auth'); const locale = useLocale(); const router = useRouter(); const params = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuthStore(); const [form] = Form.useForm(); const [mounted, setMounted] = useState(false);
  const destination = params.get('redirect') || `/${locale}`;
  useEffect(() => setMounted(true), []);
  useEffect(() => { if (mounted && isAuthenticated) router.push(destination); }, [destination, isAuthenticated, mounted, router]);
  const submit = async (values: { email: string; password: string }) => { try { await login(values); message.success(t('loginSuccess')); router.push(destination); } catch (error: unknown) { message.error((error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message || t('loginFailed')); } };
  if (!mounted) return null;
  return <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8"><Card className="w-full max-w-md shadow-lg"><div className="text-center mb-6"><h1 className="text-2xl font-bold">{t('login')}</h1><p className="text-gray-500 mt-2">{t('welcomeBack')}</p></div><Form form={form} layout="vertical" onFinish={submit} autoComplete="off" size="large"><Form.Item name="email" label={t('emailLabel')} rules={[{ required: true, message: t('emailPlaceholder') }, { type: 'email', message: t('emailPlaceholder') }]}><Input prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} /></Form.Item><Form.Item name="password" label={t('passwordLabel')} rules={[{ required: true, message: t('passwordRequired') }]}><Input.Password prefix={<LockOutlined />} placeholder={t('passwordPlaceholder')} /></Form.Item><div className="flex justify-end mb-4"><Link href={`/${locale}/forgot-password`} className="text-blue-500 text-sm">{t('forgotPassword')}</Link></div><Button type="primary" htmlType="submit" block loading={isLoading} className="!h-11">{t('submitLogin')}</Button></Form><Divider plain>{t('noAccount')}</Divider><Link href={`/${locale}/register${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`}><Button block size="large" className="!h-11">{t('createAccount')}</Button></Link></Card></main>;
}
export default function LoginPage() { return <Suspense fallback={<div className="min-h-[calc(100vh-200px)] flex items-center justify-center"><Spin size="large" /></div>}><LoginForm /></Suspense>; }
