'use client';

import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Divider } from 'antd';
import { MailOutlined, LockOutlined, UserOutlined, PhoneOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * Registration page with name, email, password, phone form.
 * Auto-login after successful registration.
 *
 * Requirements:
 * - 1.1: Create new user account with valid registration information
 * - 1.2: Return error for existing email
 * - 1.6: Encrypt passwords using bcrypt
 */
export default function RegisterPage() {
  const router = useRouter();
  const { register, isAuthenticated, isLoading } = useAuthStore();
  const [form] = Form.useForm();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Redirect if already authenticated
  useEffect(() => {
    if (mounted && isAuthenticated) {
      router.push('/');
    }
  }, [mounted, isAuthenticated, router]);

  const handleRegister = async (values: {
    full_name: string;
    email: string;
    password: string;
    phone?: string;
  }) => {
    try {
      await register({
        full_name: values.full_name,
        email: values.email,
        password: values.password,
        phone: values.phone,
      });
      message.success('注册成功，已自动登录');
      router.push('/');
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errorMessage = err?.response?.data?.error?.message || '注册失败，请重试';
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
          <h1 className="text-2xl font-bold text-gray-800">注册</h1>
          <p className="text-gray-500 mt-2">创建您的账号，开始购物</p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleRegister}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="full_name"
            label="姓名"
            rules={[
              { required: true, message: '请输入姓名' },
              { min: 2, message: '姓名至少2个字符' },
              { max: 50, message: '姓名最多50个字符' },
            ]}
          >
            <Input
              prefix={<UserOutlined className="text-gray-400" />}
              placeholder="请输入姓名"
            />
          </Form.Item>

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
              { min: 8, message: '密码至少8个字符' },
              {
                pattern: /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/,
                message: '密码需包含大小写字母和数字',
              },
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="请输入密码（至少8位，含大小写字母和数字）"
            />
          </Form.Item>

          <Form.Item
            name="confirm_password"
            label="确认密码"
            dependencies={['password']}
            rules={[
              { required: true, message: '请确认密码' },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!value || getFieldValue('password') === value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('两次输入的密码不一致'));
                },
              }),
            ]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-gray-400" />}
              placeholder="请再次输入密码"
            />
          </Form.Item>

          <Form.Item
            name="phone"
            label="手机号码（选填）"
            rules={[
              {
                pattern: /^1[3-9]\d{9}$/,
                message: '请输入有效的手机号码',
              },
            ]}
          >
            <Input
              prefix={<PhoneOutlined className="text-gray-400" />}
              placeholder="请输入手机号码"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={isLoading}
              className="!h-11"
            >
              注册
            </Button>
          </Form.Item>
        </Form>

        <Divider plain className="!text-gray-400">
          已有账号？
        </Divider>

        <Link href="/login">
          <Button block size="large" className="!h-11">
            去登录
          </Button>
        </Link>
      </Card>
    </main>
  );
}
