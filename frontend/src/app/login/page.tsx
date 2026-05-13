'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Form, Input, Button, Card, message, Divider, Spin } from 'antd';
import { MailOutlined, LockOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Login page with email/password form.
 * Redirects to previous page or home after successful login.
 *
 * Requirements:
 * - 1.3: Authenticate user and return access token
 * - 1.4: Return authentication error for invalid credentials
 * - 1.5: Lock account after 5 failed attempts within 15 minutes
 */

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && isAuthenticated) {
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
    }
  }, [mounted, isAuthenticated, router, searchParams]);

  const handleLogin = async (values: { email: string; password: string }) => {
    try {
      await login(values);
      message.success('登录成功');
      const redirect = searchParams.get('redirect') || '/';
      router.push(redirect);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errorMessage = err?.response?.data?.error?.message || '登录失败，请检查邮箱和密码';
      message.error(errorMessage);
    }
  };

  if (!mounted) {
    return null;
  }

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">登录</h1>
          <p className="text-gray-500 mt-2">欢迎回来，请登录您的账号</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleLogin}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱地址' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input
              prefix={<MailOutlined className="text-gray-400" />}
              placeholder="请输入邮箱地址"
            />
          </Form.Item>

          <Form.Item
            name="password"
            label="密码"
            rules={[
              { required: true, message: '请输入密码' },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="请输入密码"
            />
          </Form.Item>

          <div className="flex justify-end mb-4">
            <Link href="/forgot-password" className="text-blue-500 hover:text-blue-600 text-sm">
              忘记密码？
            </Link>
          </div>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isLoading}
              className="!h-11"
            >
              登录
            </Button>
          </Form.Item>
        </Form>

        <Divider plain className="!text-gray-400">
          还没有账号？
        </Divider>

        <Link href="/register">
          <Button block size="large" className="!h-11">
            注册新账号
          </Button>
        </Link>
      </Card>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[calc(100vh-200px)] flex items-center justify-center">
          <Spin size="large" tip="加载中..." />
        </div>
      }
    >
      <LoginForm />
    </Suspense>
  );
}
