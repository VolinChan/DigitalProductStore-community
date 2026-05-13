'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, Typography, Button, Descriptions, Spin } from 'antd';
import Link from 'next/link';
import { useAuthStore } from '@/store/useAuthStore';

const { Title } = Typography;

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, loadUser, logout } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated && !isLoading) {
      router.push('/login?redirect=/profile');
      return;
    }
    if (isAuthenticated && !user) {
      loadUser();
    }
  }, [isAuthenticated, isLoading, user, loadUser, router]);

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
      <Card className="mt-4">
        <Descriptions column={1} bordered size="middle">
          <Descriptions.Item label="邮箱">{user.email}</Descriptions.Item>
          <Descriptions.Item label="姓名">{user.full_name}</Descriptions.Item>
          {user.phone && (
            <Descriptions.Item label="电话">{user.phone}</Descriptions.Item>
          )}
          <Descriptions.Item label="账号类型">{user.role}</Descriptions.Item>
        </Descriptions>
        <div className="mt-4 flex gap-2">
          <Link href="/orders">
            <Button type="primary">我的订单</Button>
          </Link>
          <Button onClick={() => { logout(); router.push('/'); }}>退出登录</Button>
        </div>
      </Card>
    </main>
  );
}
