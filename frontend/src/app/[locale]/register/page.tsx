'use client';

import { useEffect, useState } from 'react';
import { Button, Card, Divider, Form, Input, message } from 'antd';
import { LockOutlined, MailOutlined, PhoneOutlined, UserOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
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
  const loginHref = `/${locale}/login${params.get('redirect') ? `?redirect=${encodeURIComponent(params.get('redirect')!)}` : ''}`;
  if (!mounted) return null;

  return <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8">
    <Card className="w-full max-w-md shadow-lg">
      <div className="text-center mb-6"><h1 className="text-2xl font-bold">{t('register')}</h1><p className="text-gray-500 mt-2">{t('registerSubtitle')}</p></div>
      <Form form={form} layout="vertical" onFinish={submit} autoComplete="off" size="large">
        <Form.Item name="full_name" label={t('nameLabel')} rules={[{ required: true, message: t('namePlaceholder') }, { min: 2, message: t('nameMin') }]}><Input prefix={<UserOutlined />} placeholder={t('namePlaceholder')} /></Form.Item>
        <Form.Item name="email" label={t('emailLabel')} rules={[{ required: true, message: t('emailPlaceholder') }, { type: 'email', message: t('emailPlaceholder') }]}><Input prefix={<MailOutlined />} placeholder={t('emailPlaceholder')} /></Form.Item>
        <Form.Item name="password" label={t('passwordLabel')} rules={[{ required: true, message: t('passwordRequired') }, { min: 8, message: t('passwordMin') }]}><Input.Password prefix={<LockOutlined />} placeholder={t('passwordPlaceholder')} /></Form.Item>
        <Form.Item name="confirm_password" label={t('confirmPasswordLabel')} dependencies={['password']} rules={[
          { required: true, message: t('confirmPasswordPlaceholder') },
          ({ getFieldValue }) => ({
            validator(_, value) {
              return !value || getFieldValue('password') === value ? Promise.resolve() : Promise.reject(new Error(t('passwordMismatch')));
            },
          }),
        ]}><Input.Password prefix={<LockOutlined />} placeholder={t('confirmPasswordPlaceholder')} /></Form.Item>
        <Form.Item name="phone" label={t('phoneOptional')}><Input prefix={<PhoneOutlined />} placeholder={t('phonePlaceholder')} /></Form.Item>
        <Button type="primary" htmlType="submit" block loading={isLoading} className="!h-11">{t('submitRegister')}</Button>
      </Form>
      <Divider plain>{t('haveAccount')}</Divider>
      <Link href={loginHref}><Button block size="large" className="!h-11">{t('login')}</Button></Link>
    </Card>
  </main>;
}
