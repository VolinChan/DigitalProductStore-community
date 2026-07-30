'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Typography, Button, Descriptions, Spin, Input, message, Form } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone, LockOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import { useLocale, useTranslations } from 'next-intl';

const { Title, Text } = Typography;

interface User {
  id: number;
  email: string;
  full_name: string;
  phone?: string;
  role: string;
  is_active: boolean;
}

interface AuthUser {
  email?: string;
  full_name?: string;
  role?: string;
}

export default function ProfilePage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();

  // ── Change-password form state ────────────────────────────────────
  const [passwordForm] = Form.useForm();
  const [changingPassword, setChangingPassword] = useState(false);

  // Redirect back to profile after a successful password change (the
  // frontend clears auth state and forces re-login).
  useEffect(() => {
    if (searchParams.get('passwordChanged') === '1') {
      message.success(t('profile.passwordChanged'));
      router.replace(`/${locale}/profile`);
    }
  }, [searchParams, router, locale, t]);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/profile`)}`);
      return;
    }
    if (isAuthenticated && !user) {
      loadUser();
    }
  }, [isAuthenticated, isLoading, user, loadUser, router, locale]);

  const handlePasswordChange = async (values: { current_password: string; new_password: string }) => {

    setChangingPassword(true);
    try {
      await apiClient.put('/auth/password', {
        current_password: values.current_password,
        new_password: values.new_password,
      });
      message.success(t('profile.passwordChanged'));
      passwordForm.resetFields();

      // Force re-authentication: clear tokens and redirect to login
      setTimeout(() => {
        logout();
        router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/profile`)}&passwordChanged=1`);
      }, 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const serverMessage = axiosErr.response?.data?.error?.message;
      passwordForm.setFields([{ name: 'current_password', errors: [serverMessage === 'invalid current password' ? t('profile.invalidCurrentPassword') : serverMessage || t('profile.passwordChangeFailed')] }]);
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" />
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>{t('profile.title')}</Title>

      {/* ── Profile card ─────────────────────────────────────────────── */}
      <Card className="mt-4">
        <Descriptions column={1} bordered size="medium">
          <Descriptions.Item label={t('profile.email')}>{(user as User).email}</Descriptions.Item>
          <Descriptions.Item label={t('profile.fullName')}>{(user as User).full_name}</Descriptions.Item>
          {(user as User).phone && (
            <Descriptions.Item label={t('profile.phone')}>{(user as User).phone}</Descriptions.Item>
          )}
          <Descriptions.Item label={t('profile.accountType')}>{(user as User).role}</Descriptions.Item>
        </Descriptions>
        <div className="mt-4 flex gap-2">
          <Link href={`/${locale}/orders`}>
            <Button type="primary">{t('orders.title')}</Button>
          </Link>
          {(user as User).role === 'super_admin' && (
            <Link href="/admin">
              <Button>{t('layout.admin')}</Button>
            </Link>
          )}
          <Button onClick={() => { logout(); router.push(`/${locale}`); }}>{t('layout.logout')}</Button>
        </div>
      </Card>

      {/* ── Change password card ─────────────────────────────────────── */}
      <Card title={t('profile.changePassword')} className="mt-6">
        <Form form={passwordForm} layout="vertical" onFinish={handlePasswordChange} autoComplete="off">
          <Form.Item name="current_password" label={t('profile.currentPassword')} rules={[{ required: true, message: t('profile.currentPasswordPlaceholder') }]}>
            <Input.Password placeholder={t('profile.currentPasswordPlaceholder')} prefix={<LockOutlined />} />
          </Form.Item>

          <Form.Item name="new_password" label={t('profile.newPassword')} rules={[
            { required: true, message: t('auth.passwordRequired') },
            () => ({ validator(_, value) {
              const valid = typeof value === 'string' && value.length >= 8 && value.length <= 72 && /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value) && /\p{N}/u.test(value) && /[\p{P}\p{S}]/u.test(value);
              return !value || valid ? Promise.resolve() : Promise.reject(new Error(t('profile.passwordPolicy')));
            }}),
          ]}>
            <Input.Password placeholder={t('profile.newPasswordPlaceholder', { policy: t('profile.passwordPolicy') })} prefix={<LockOutlined />} />
          </Form.Item>
          <Text type="secondary" className="text-xs -mt-4 mb-4 block">{t('profile.passwordPolicy')}</Text>

          <Form.Item name="confirm_password" label={t('profile.confirmPassword')} dependencies={['new_password']} rules={[
            { required: true, message: t('profile.confirmPasswordPlaceholder') },
            ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('new_password') === value ? Promise.resolve() : Promise.reject(new Error(t('profile.passwordMismatch'))); } }),
          ]}>
            <Input.Password placeholder={t('profile.confirmPasswordPlaceholder')} prefix={<LockOutlined />} />
          </Form.Item>

          <Button type="primary" htmlType="submit" loading={changingPassword} className="w-full">
            {t('profile.changePassword')}
          </Button>
        </Form>
      </Card>
    </main>
  );
}
