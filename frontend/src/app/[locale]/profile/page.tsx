'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Input, message } from 'antd';
import { ArrowRightOutlined, LoadingOutlined, LockOutlined, LogoutOutlined, ShoppingOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import { useAuthStore } from '@/store/useAuthStore';
import type { User } from '@/types';
import AddressBookManager from '@/components/account/AddressBookManager';

function ProfileContent() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();
  const [passwordForm] = Form.useForm();
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    if (searchParams.get('passwordChanged') === '1') { message.success(t('profile.passwordChanged')); router.replace(`/${locale}/profile`); }
  }, [locale, router, searchParams, t]);
  useEffect(() => {
    if (!isAuthenticated && !isLoading) router.replace(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/profile`)}`);
    else if (isAuthenticated && !user) void loadUser();
  }, [isAuthenticated, isLoading, loadUser, locale, router, user]);

  const changePassword = async (values: { current_password: string; new_password: string }) => {
    setChangingPassword(true);
    try {
      await apiClient.put('/auth/password', values);
      message.success(t('profile.passwordChanged'));
      passwordForm.resetFields();
      window.setTimeout(() => { logout(); router.push(`/${locale}/login?redirect=${encodeURIComponent(`/${locale}/profile`)}&passwordChanged=1`); }, 1500);
    } catch (error: unknown) {
      const serverMessage = (error as { response?: { data?: { error?: { message?: string } } } }).response?.data?.error?.message;
      passwordForm.setFields([{ name: 'current_password', errors: [serverMessage === 'invalid current password' ? t('profile.invalidCurrentPassword') : serverMessage || t('profile.passwordChangeFailed')] }]);
    } finally { setChangingPassword(false); }
  };

  if (isLoading || !user) return <Loading />;
  const currentUser = user as User;

  return (
    <main className="store-container">
      <div className="mx-auto max-w-4xl">
        <header className="border-b border-[var(--sf-line)] pb-7"><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('profile.title')}</h1></header>
        <div className="mt-8 grid gap-12 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
          <div>
            <section><h2 className="text-lg font-black text-[var(--sf-ink)]">{t('orders.infoTitle')}</h2><dl className="mt-5 space-y-5"><Info label={t('profile.fullName')} value={currentUser.full_name} /><Info label={t('profile.email')} value={currentUser.email} />{currentUser.phone && <Info label={t('profile.phone')} value={currentUser.phone} />}<Info label={t('profile.accountType')} value={currentUser.role} /></dl></section>
            <nav className="mt-8 border-t border-[var(--sf-line)] pt-6" aria-label={t('layout.userMenu')}><Link href={`/${locale}/orders`} className="flex min-h-12 items-center justify-between text-sm font-black text-[var(--sf-ink)] hover:text-[var(--sf-accent)]"><span className="inline-flex items-center gap-2"><ShoppingOutlined />{t('orders.title')}</span><ArrowRightOutlined /></Link>{currentUser.role === 'super_admin' && <Link href="/admin" className="flex min-h-12 items-center justify-between text-sm font-black text-[var(--sf-ink)] hover:text-[var(--sf-accent)]"><span>{t('layout.admin')}</span><ArrowRightOutlined /></Link>}<button type="button" onClick={() => { logout(); router.push(`/${locale}`); }} className="flex min-h-12 w-full items-center gap-2 text-sm font-black text-[#a33a32]"><LogoutOutlined />{t('layout.logout')}</button></nav>
          </div>

          <section className="rounded-[20px] bg-white p-5 shadow-[0_8px_32px_rgba(23,63,103,0.07)] sm:p-7"><h2 className="flex items-center gap-2 text-xl font-black text-[var(--sf-ink)]"><LockOutlined className="text-[var(--sf-accent)]" />{t('profile.changePassword')}</h2><p className="mt-2 text-sm leading-6 text-[var(--sf-muted)]">{t('profile.passwordPolicy')}</p>
            <Form form={passwordForm} layout="vertical" onFinish={changePassword} autoComplete="off" size="large" className="sf-auth-form mt-6">
              <Form.Item name="current_password" label={t('profile.currentPassword')} rules={[{ required: true, message: t('profile.currentPasswordPlaceholder') }]}><Input.Password autoComplete="current-password" placeholder={t('profile.currentPasswordPlaceholder')} prefix={<LockOutlined />} /></Form.Item>
              <Form.Item name="new_password" label={t('profile.newPassword')} rules={[{ required: true, message: t('auth.passwordRequired') }, () => ({ validator(_, value) { const valid = typeof value === 'string' && value.length >= 8 && value.length <= 72 && /\p{Lu}/u.test(value) && /\p{Ll}/u.test(value) && /\p{N}/u.test(value) && /[\p{P}\p{S}]/u.test(value); return !value || valid ? Promise.resolve() : Promise.reject(new Error(t('profile.passwordPolicy'))); } })]}><Input.Password autoComplete="new-password" placeholder={t('profile.newPasswordPlaceholder', { policy: t('profile.passwordPolicy') })} prefix={<LockOutlined />} /></Form.Item>
              <Form.Item name="confirm_password" label={t('profile.confirmPassword')} dependencies={['new_password']} rules={[{ required: true, message: t('profile.confirmPasswordPlaceholder') }, ({ getFieldValue }) => ({ validator(_, value) { return !value || getFieldValue('new_password') === value ? Promise.resolve() : Promise.reject(new Error(t('profile.passwordMismatch'))); } })]}><Input.Password autoComplete="new-password" placeholder={t('profile.confirmPasswordPlaceholder')} prefix={<LockOutlined />} /></Form.Item>
              <button type="submit" disabled={changingPassword} className="sf-button-primary w-full">{changingPassword ? t('common.submitting') : t('profile.changePassword')}</button>
            </Form>
          </section>
        </div>
		<AddressBookManager />
      </div>
    </main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-bold text-[var(--sf-muted)]">{label}</dt><dd className="mt-1 break-all text-sm font-black text-[var(--sf-ink)]">{value}</dd></div>; }
function Loading() { return <main className="store-container flex min-h-[55vh] items-center justify-center"><LoadingOutlined spin className="text-3xl text-[var(--sf-accent)]" /></main>; }
export default function ProfilePage() { return <Suspense fallback={<Loading />}><ProfileContent /></Suspense>; }
