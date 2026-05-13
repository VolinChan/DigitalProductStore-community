'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Input, Tag, message, Descriptions, Popconfirm,
} from 'antd';
import {
  EyeOutlined, StopOutlined, CheckCircleOutlined, KeyOutlined, ReloadOutlined, SearchOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { User, UserRole } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const roleLabels: Record<UserRole, string> = {
  guest: '游客',
  user: '普通用户',
  product_manager: '商品管理员',
  order_manager: '订单管理员',
  super_admin: '超级管理员',
};

const roleColors: Record<UserRole, string> = {
  guest: 'default',
  user: 'blue',
  product_manager: 'cyan',
  order_manager: 'purple',
  super_admin: 'red',
};

export default function AdminUsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [search, setSearch] = useState('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      if (search) params.search = search;
      const res = await apiClient.get<{
        data: { users: User[] };
        meta: { total: number; page: number; per_page: number; total_pages: number };
      }>('/admin/users', { params });
      setUsers(res.data.data?.users || []);
      setTotal(res.data.meta?.total || 0);
    } catch {
      message.error('获取用户列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, search]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleViewDetail = async (user: User) => {
    try {
      const res = await apiClient.get(`/admin/users/${user.id}`);
      setSelectedUser(res.data.data || user);
    } catch {
      setSelectedUser(user);
    }
    setDetailModalOpen(true);
  };

  const handleDisable = async (userId: number) => {
    try {
      await apiClient.put(`/admin/users/${userId}/disable`, { reason: '管理员禁用' });
      message.success('用户已禁用');
      fetchUsers();
    } catch {
      message.error('操作失败');
    }
  };

  const handleEnable = async (userId: number) => {
    try {
      await apiClient.put(`/admin/users/${userId}/disable`, { is_active: true });
      message.success('用户已启用');
      fetchUsers();
    } catch {
      message.error('操作失败');
    }
  };

  const handleResetPassword = async (userId: number) => {
    try {
      await apiClient.post(`/admin/users/${userId}/reset-password`);
      message.success('密码重置链接已发送');
    } catch {
      message.error('密码重置失败');
    }
  };

  const handleSearch = () => {
    setPage(1);
    fetchUsers();
  };

  const columns: ColumnsType<User> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '邮箱', dataIndex: 'email', key: 'email' },
    { title: '姓名', dataIndex: 'full_name', key: 'full_name' },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role: UserRole) => (
        <Tag color={roleColors[role]}>{roleLabels[role]}</Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '正常' : '已禁用'}</Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {record.is_active ? (
            <Popconfirm title="确定禁用此用户？" onConfirm={() => handleDisable(record.id)}>
              <Button size="small" danger icon={<StopOutlined />}>禁用</Button>
            </Popconfirm>
          ) : (
            <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleEnable(record.id)}>
              启用
            </Button>
          )}
          <Popconfirm title="确定重置密码？" onConfirm={() => handleResetPassword(record.id)}>
            <Button size="small" icon={<KeyOutlined />}>重置密码</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">用户管理</h2>
        <Space>
          <Input
            placeholder="搜索邮箱/姓名"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onPressEnter={handleSearch}
            style={{ width: 200 }}
            suffix={<SearchOutlined onClick={handleSearch} className="cursor-pointer" />}
          />
          <Button icon={<ReloadOutlined />} onClick={fetchUsers}>刷新</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      {/* User Detail Modal */}
      <Modal
        title="用户详情"
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedUser && (
          <Descriptions bordered size="small" column={2}>
            <Descriptions.Item label="ID">{selectedUser.id}</Descriptions.Item>
            <Descriptions.Item label="邮箱">{selectedUser.email}</Descriptions.Item>
            <Descriptions.Item label="姓名">{selectedUser.full_name}</Descriptions.Item>
            <Descriptions.Item label="电话">{selectedUser.phone || '-'}</Descriptions.Item>
            <Descriptions.Item label="角色">
              <Tag color={roleColors[selectedUser.role]}>{roleLabels[selectedUser.role]}</Tag>
            </Descriptions.Item>
            <Descriptions.Item label="状态">
              <Tag color={selectedUser.is_active ? 'green' : 'red'}>
                {selectedUser.is_active ? '正常' : '已禁用'}
              </Tag>
            </Descriptions.Item>
            <Descriptions.Item label="注册时间" span={2}>
              {new Date(selectedUser.created_at).toLocaleString()}
            </Descriptions.Item>
          </Descriptions>
        )}
      </Modal>
    </div>
  );
}
