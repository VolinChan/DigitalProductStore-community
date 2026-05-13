'use client';

import React, { useState } from 'react';
import { Form, Input, Button, Card, message, Result } from 'antd';
import { MailOutlined } from '@ant-design/icons';
import Link from 'next/link';
import apiClient from '@/lib/api';

/**
 * Password reset request page.
 * Sends a password reset link to the user's registered email.
 *
 * Requirements:
 * - 1.7: Send password reset link to registered email
 * - 1.8: Expire password reset links after 1 hour
 */
export default function ForgotPasswordPage() {
  const [form] = Form.useForm();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  const handleSubmit = async (values: { email: string }) => {
    setSubmitting(true);
    try {
      await apiClient.post('/auth/password-reset/request', {
        email: values.email,
      });
      setSubmittedEmail(values.email);
      setSubmitted(true);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: { message?: string } } } };
      const errorMessage = err?.response?.data?.error?.message || '发送重置链接失败，请重试';
      message.error(errorMessage);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8">
        <Card className="w-full max-w-md shadow-lg">
          <Result
            status="success"
            title="重置链接已发送"
            subTitle={`我们已向 ${submittedEmail} 发送了密码重置链接，请查收邮件。链接有效期为1小时。`}
            extra={[
              <Link href="/login" key="login">
                <Button type="primary" size="large">
                  返回登录
                </Button>
              </Link>,
              <Button
                key="resend"
                size="large"
                onClick={() => {
                  setSubmitted(false);
                  form.setFieldsValue({ email: submittedEmail });
                }}
              >
                重新发送
              </Button>,
            ]}
          />
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-200px)] flex items-center justify-center px-4 py-8">
      <Card className="w-full max-w-md shadow-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800">忘记密码</h1>
          <p className="text-gray-500 mt-2">
            输入您的注册邮箱，我们将发送密码重置链接
          </p>
        </div>

        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
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
              placeholder="请输入注册邮箱"
            />
          </Form.Item>

          <Form.Item>
            <Button
              type="primary"
              htmlType="submit"
              block
              loading={submitting}
              className="!h-11"
            >
              发送重置链接
            </Button>
          </Form.Item>
        </Form>

        <div className="text-center">
          <Link href="/login" className="text-blue-500 hover:text-blue-600">
            返回登录
          </Link>
        </div>
      </Card>
    </main>
  );
}
