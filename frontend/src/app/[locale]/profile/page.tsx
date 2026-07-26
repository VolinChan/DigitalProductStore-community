'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, Typography, Button, Descriptions, Spin, Input, message, Alert } from 'antd';
import { EyeInvisibleOutlined, EyeTwoTone, LockOutlined } from '@ant-design/icons';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';

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

// Password policy text used in multiple places so it stays in sync.
const PASSWORD_POLICY =
  '8-72 characters with uppercase, lowercase, a number, and a special character';

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();

  // ── Change-password form state ────────────────────────────────────
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [changingPassword, setChangingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState(false);

  // Redirect back to profile after a successful password change (the
  // frontend clears auth state and forces re-login).
  useEffect(() => {
    if (searchParams.get('passwordChanged') === '1') {
      message.success('Password changed successfully. Please sign in again.');
      router.replace('/profile');
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login?redirect=/profile');
      return;
    }
    if (isAuthenticated && !user) {
      loadUser();
    }
  }, [isAuthenticated, isLoading, user, loadUser, router]);

  const handlePasswordReset = useCallback(() => {
    setCurrentPassword('');
    setNewPassword('');
    setConfirmPassword('');
    setPasswordError('');
    setPasswordSuccess(false);
  }, []);

  const handlePasswordChange = async () => {
    setPasswordError('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordError('All fields are required.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match.');
      return;
    }
    if (newPassword.length < 8 || newPassword.length > 72) {
      setPasswordError(`New password must be ${PASSWORD_POLICY}.`);
      return;
    }

    setChangingPassword(true);
    try {
      await apiClient.put('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess(true);
      message.success('Password changed successfully.');

      // Clear form
      handlePasswordReset();

      // Force re-authentication: clear tokens and redirect to login
      setTimeout(() => {
        logout();
        router.push('/login?redirect=/profile&passwordChanged=1');
      }, 1500);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { error?: string } }; message?: string };
      setPasswordError(
        axiosErr.response?.data?.error || axiosErr.message || 'Failed to change password.'
      );
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
      <Title level={2}>个人中心</Title>

      {/* ── Profile card ─────────────────────────────────────────────── */}
      <Card className="mt-4">
        <Descriptions column={1} bordered size="medium">
          <Descriptions.Item label="邮箱">{(user as User).email}</Descriptions.Item>
          <Descriptions.Item label="姓名">{(user as User).full_name}</Descriptions.Item>
          {(user as User).phone && (
            <Descriptions.Item label="电话">{(user as User).phone}</Descriptions.Item>
          )}
          <Descriptions.Item label="账号类型">{(user as User).role}</Descriptions.Item>
        </Descriptions>
        <div className="mt-4 flex gap-2">
          <Link href="/orders">
            <Button type="primary">我的订单</Button>
          </Link>
          <Button onClick={() => { logout(); router.push('/'); }}>退出登录</Button>
        </div>
      </Card>

      {/* ── Change password card ─────────────────────────────────────── */}
      <Card title="修改密码" className="mt-6">
        {passwordSuccess && (
          <Alert
            title="密码已修改成功"
            description="正在跳转到登录页面，请使用新密码重新登录。"
            type="success"
            showIcon
            closable
            className="mb-4"
            onClose={handlePasswordReset}
          />
        )}

        {passwordError && (
          <Alert title="错误" description={passwordError} type="error" showIcon className="mb-4" />
        )}

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">当前密码</label>
            <Input.Password
              placeholder="输入当前密码"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              prefix={<LockOutlined />}
              visibilityToggle={{ visible: showCurrent, onVisibleChange: setShowCurrent }}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">新密码</label>
            <Input.Password
              placeholder={`至少 8 个字符，${PASSWORD_POLICY}`}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              prefix={<LockOutlined />}
              visibilityToggle={{ visible: showNew, onVisibleChange: setShowNew }}
            />
            <Text type="secondary" className="text-xs mt-1 block">
              {PASSWORD_POLICY}
            </Text>
          </div>

          <div>
            <label className="block text-sm font-medium mb-1">确认新密码</label>
            <Input.Password
              placeholder="再次输入新密码"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              prefix={<LockOutlined />}
              visibilityToggle={{ visible: showConfirm, onVisibleChange: setShowConfirm }}
            />
          </div>

          <Button
            type="primary"
            onClick={handlePasswordChange}
            loading={changingPassword}
            disabled={passwordSuccess}
            className="w-full"
          >
            确认修改密码
          </Button>
        </div>
      </Card>
    </main>
  );
}
