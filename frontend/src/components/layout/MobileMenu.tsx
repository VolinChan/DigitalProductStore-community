'use client';

import React from 'react';
import { Drawer } from 'antd';
import {
  CloseOutlined,
  UserOutlined,
  LoginOutlined,
} from '@ant-design/icons';
import Link from 'next/link';
import Navigation from './Navigation';

interface MobileMenuProps {
  open: boolean;
  onClose: () => void;
}

export default function MobileMenu({ open, onClose }: MobileMenuProps) {
  return (
    <Drawer
      title={
        <span className="text-lg font-bold text-primary">数码商城</span>
      }
      placement="left"
      onClose={onClose}
      open={open}
      width={280}
      closeIcon={<CloseOutlined className="text-lg" />}
      styles={{
        body: { padding: '16px 0' },
      }}
    >
      <div className="flex flex-col h-full">
        {/* Navigation Links */}
        <div className="px-4 mb-6">
          <Navigation direction="vertical" onItemClick={onClose} />
        </div>

        {/* Divider */}
        <div className="border-t border-gray-200 mx-4 mb-6" />

        {/* User Actions */}
        <div className="px-4 flex flex-col gap-2">
          <Link
            href="/login"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-md text-gray-700 hover:bg-gray-100 min-h-[44px] transition-colors"
          >
            <LoginOutlined className="text-lg" />
            <span className="text-sm font-medium">登录</span>
          </Link>
          <Link
            href="/register"
            onClick={onClose}
            className="flex items-center gap-3 px-4 py-3 rounded-md text-gray-700 hover:bg-gray-100 min-h-[44px] transition-colors"
          >
            <UserOutlined className="text-lg" />
            <span className="text-sm font-medium">注册</span>
          </Link>
        </div>

        {/* Bottom section */}
        <div className="mt-auto px-4 pt-6 border-t border-gray-200">
          <p className="text-xs text-gray-400 text-center">
            © {new Date().getFullYear()} 数码商城
          </p>
        </div>
      </div>
    </Drawer>
  );
}
