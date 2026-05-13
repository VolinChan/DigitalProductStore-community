'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Layout, Menu, Avatar, Dropdown, Button, Spin } from 'antd';
import {
  DashboardOutlined,
  ShoppingOutlined,
  OrderedListOutlined,
  DollarOutlined,
  UserOutlined,
  PictureOutlined,
  BarChartOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  LogoutOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useAuthStore } from '@/store/useAuthStore';
import type { UserRole } from '@/types';
import type { MenuProps } from 'antd';

const { Header, Sider, Content } = Layout;

type MenuItem = Required<MenuProps>['items'][number];

/** Define which roles can access which menu items */
const menuPermissions: Record<string, UserRole[]> = {
  '/admin/analytics': ['super_admin', 'order_manager', 'product_manager'],
  '/admin/products': ['super_admin', 'product_manager'],
  '/admin/orders': ['super_admin', 'order_manager'],
  '/admin/payments': ['super_admin', 'order_manager'],
  '/admin/users': ['super_admin'],
  '/admin/content': ['super_admin', 'product_manager'],
};

function getMenuItems(role: UserRole): MenuItem[] {
  const allItems: (MenuItem & { permission?: string })[] = [
    {
      key: '/admin/analytics',
      icon: <BarChartOutlined />,
      label: '数据分析',
      permission: '/admin/analytics',
    },
    {
      key: '/admin/products',
      icon: <ShoppingOutlined />,
      label: '商品管理',
      permission: '/admin/products',
    },
    {
      key: '/admin/orders',
      icon: <OrderedListOutlined />,
      label: '订单管理',
      permission: '/admin/orders',
    },
    {
      key: '/admin/payments',
      icon: <DollarOutlined />,
      label: '转账确认',
      permission: '/admin/payments',
    },
    {
      key: '/admin/users',
      icon: <UserOutlined />,
      label: '用户管理',
      permission: '/admin/users',
    },
    {
      key: '/admin/content',
      icon: <PictureOutlined />,
      label: '内容管理',
      permission: '/admin/content',
    },
  ];

  return allItems.filter((item) => {
    const path = item.permission || (item.key as string);
    const allowedRoles = menuPermissions[path];
    if (!allowedRoles) return true;
    return allowedRoles.includes(role);
  });
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading, logout, loadUser } = useAuthStore();
  const [collapsed, setCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated) {
      router.replace('/login?redirect=/admin');
      return;
    }
    if (!user) {
      loadUser();
    }
  }, [isAuthenticated, user, router, loadUser]);

  useEffect(() => {
    if (user && !['super_admin', 'product_manager', 'order_manager'].includes(user.role)) {
      router.replace('/');
    }
  }, [user, router]);

  if (!mounted || isLoading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  if (!['super_admin', 'product_manager', 'order_manager'].includes(user.role)) {
    return null;
  }

  const menuItems = getMenuItems(user.role);

  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <SettingOutlined />,
      label: '个人设置',
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      danger: true,
    },
  ];

  const handleMenuClick = (e: { key: string }) => {
    router.push(e.key);
  };

  const handleUserMenuClick: MenuProps['onClick'] = (e) => {
    if (e.key === 'logout') {
      logout();
      router.replace('/login');
    }
  };

  const selectedKey = menuItems.find(
    (item) => item && pathname.startsWith(item.key as string)
  )?.key as string || '/admin/analytics';

  return (
    <Layout className="min-h-screen">
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        breakpoint="lg"
        onBreakpoint={(broken) => setCollapsed(broken)}
        className="!bg-white shadow-md"
        width={220}
      >
        <div className="h-16 flex items-center justify-center border-b border-gray-100">
          <h1 className={`font-bold text-lg text-blue-600 transition-all ${collapsed ? 'text-sm' : ''}`}>
            {collapsed ? '管理' : '数码商城管理'}
          </h1>
        </div>
        <Menu
          mode="inline"
          selectedKeys={[selectedKey]}
          items={menuItems}
          onClick={handleMenuClick}
          className="border-r-0 mt-2"
        />
      </Sider>
      <Layout>
        <Header className="!bg-white !px-4 flex items-center justify-between shadow-sm h-16">
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-500">{user.role === 'super_admin' ? '超级管理员' : user.role === 'product_manager' ? '商品管理员' : '订单管理员'}</span>
            <Dropdown menu={{ items: userMenuItems, onClick: handleUserMenuClick }} placement="bottomRight">
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 px-2 py-1 rounded">
                <Avatar icon={<UserOutlined />} size="small" />
                <span className="text-sm">{user.full_name}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="m-4 p-6 bg-white rounded-lg min-h-[calc(100vh-112px)]">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
}
