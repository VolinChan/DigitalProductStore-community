'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Switch, DatePicker, Select,
  InputNumber, Tabs, Tag, message, Popconfirm, Image,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { Banner, Announcement, AnnouncementType, Priority } from '@/types';
import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;

const announcementTypeLabels: Record<AnnouncementType, string> = {
  info: '信息',
  warning: '警告',
  promotion: '促销',
};

const priorityLabels: Record<Priority, string> = {
  high: '高',
  medium: '中',
  low: '低',
};

const priorityColors: Record<Priority, string> = {
  high: 'red',
  medium: 'orange',
  low: 'blue',
};

export default function AdminContentPage() {
  // Banner state
  const [banners, setBanners] = useState<Banner[]>([]);
  const [bannersLoading, setBannersLoading] = useState(false);
  const [bannerModalOpen, setBannerModalOpen] = useState(false);
  const [editingBanner, setEditingBanner] = useState<Banner | null>(null);
  const [bannerForm] = Form.useForm();

  // Announcement state
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [announcementsLoading, setAnnouncementsLoading] = useState(false);
  const [announcementModalOpen, setAnnouncementModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<Announcement | null>(null);
  const [announcementForm] = Form.useForm();

  const fetchBanners = useCallback(async () => {
    setBannersLoading(true);
    try {
      const res = await apiClient.get<{ data: { banners: Banner[] } }>('/admin/banners');
      setBanners(res.data.data?.banners || []);
    } catch {
      message.error('获取轮播图列表失败');
    } finally {
      setBannersLoading(false);
    }
  }, []);

  const fetchAnnouncements = useCallback(async () => {
    setAnnouncementsLoading(true);
    try {
      const res = await apiClient.get<{ data: { announcements: Announcement[] } }>('/admin/announcements');
      setAnnouncements(res.data.data?.announcements || []);
    } catch {
      message.error('获取公告列表失败');
    } finally {
      setAnnouncementsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchBanners();
    fetchAnnouncements();
  }, [fetchBanners, fetchAnnouncements]);

  // Banner handlers
  const handleCreateBanner = () => {
    setEditingBanner(null);
    bannerForm.resetFields();
    bannerForm.setFieldsValue({ is_active: true, priority: 0 });
    setBannerModalOpen(true);
  };

  const handleEditBanner = (record: Banner) => {
    setEditingBanner(record);
    bannerForm.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : undefined,
      end_date: record.end_date ? dayjs(record.end_date) : undefined,
    });
    setBannerModalOpen(true);
  };

  const handleBannerSubmit = async () => {
    try {
      const values = await bannerForm.validateFields();
      const payload = {
        ...values,
        start_date: values.start_date?.toISOString(),
        end_date: values.end_date?.toISOString(),
      };
      if (editingBanner) {
        await apiClient.put(`/admin/banners/${editingBanner.id}`, payload);
        message.success('更新成功');
      } else {
        await apiClient.post('/admin/banners', payload);
        message.success('创建成功');
      }
      setBannerModalOpen(false);
      fetchBanners();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteBanner = async (id: number) => {
    try {
      await apiClient.delete(`/admin/banners/${id}`);
      message.success('删除成功');
      fetchBanners();
    } catch {
      message.error('删除失败');
    }
  };

  // Announcement handlers
  const handleCreateAnnouncement = () => {
    setEditingAnnouncement(null);
    announcementForm.resetFields();
    announcementForm.setFieldsValue({ is_active: true, type: 'info', priority: 'medium' });
    setAnnouncementModalOpen(true);
  };

  const handleEditAnnouncement = (record: Announcement) => {
    setEditingAnnouncement(record);
    announcementForm.setFieldsValue({
      ...record,
      start_date: record.start_date ? dayjs(record.start_date) : undefined,
      end_date: record.end_date ? dayjs(record.end_date) : undefined,
    });
    setAnnouncementModalOpen(true);
  };

  const handleAnnouncementSubmit = async () => {
    try {
      const values = await announcementForm.validateFields();
      const payload = {
        ...values,
        start_date: values.start_date?.toISOString(),
        end_date: values.end_date?.toISOString(),
      };
      if (editingAnnouncement) {
        await apiClient.put(`/admin/announcements/${editingAnnouncement.id}`, payload);
        message.success('更新成功');
      } else {
        await apiClient.post('/admin/announcements', payload);
        message.success('创建成功');
      }
      setAnnouncementModalOpen(false);
      fetchAnnouncements();
    } catch {
      message.error('操作失败');
    }
  };

  const handleDeleteAnnouncement = async (id: number) => {
    try {
      await apiClient.delete(`/admin/announcements/${id}`);
      message.success('删除成功');
      fetchAnnouncements();
    } catch {
      message.error('删除失败');
    }
  };

  const bannerColumns: ColumnsType<Banner> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '图片',
      dataIndex: 'image_url',
      key: 'image_url',
      render: (url: string) => url ? <Image src={url} alt="Banner" width={80} height={40} style={{ objectFit: 'cover' }} /> : '-',
    },
    { title: '优先级', dataIndex: 'priority', key: 'priority' },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditBanner(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteBanner(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const announcementColumns: ColumnsType<Announcement> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '标题', dataIndex: 'title', key: 'title' },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type: AnnouncementType) => announcementTypeLabels[type],
    },
    {
      title: '优先级',
      dataIndex: 'priority',
      key: 'priority',
      render: (p: Priority) => <Tag color={priorityColors[p]}>{priorityLabels[p]}</Tag>,
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => <Tag color={active ? 'green' : 'red'}>{active ? '启用' : '禁用'}</Tag>,
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEditAnnouncement(record)}>编辑</Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDeleteAnnouncement(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const tabItems = [
    {
      key: 'banners',
      label: '轮播图管理',
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchBanners}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateBanner}>新增轮播图</Button>
            </Space>
          </div>
          <Table columns={bannerColumns} dataSource={banners} rowKey="id" loading={bannersLoading} pagination={false} />
        </div>
      ),
    },
    {
      key: 'announcements',
      label: '公告管理',
      children: (
        <div>
          <div className="flex justify-end mb-4">
            <Space>
              <Button icon={<ReloadOutlined />} onClick={fetchAnnouncements}>刷新</Button>
              <Button type="primary" icon={<PlusOutlined />} onClick={handleCreateAnnouncement}>新增公告</Button>
            </Space>
          </div>
          <Table columns={announcementColumns} dataSource={announcements} rowKey="id" loading={announcementsLoading} pagination={false} />
        </div>
      ),
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold mb-4">内容管理</h2>
      <Tabs items={tabItems} />

      {/* Banner Modal */}
      <Modal
        title={editingBanner ? '编辑轮播图' : '新增轮播图'}
        open={bannerModalOpen}
        onOk={handleBannerSubmit}
        onCancel={() => setBannerModalOpen(false)}
        width={600}
      >
        <Form form={bannerForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="轮播图标题" />
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={2} placeholder="可选描述" />
          </Form.Item>
          <Form.Item name="image_url" label="图片 URL" rules={[{ required: true, message: '请输入图片 URL' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <Form.Item name="link_url" label="链接 URL">
            <Input placeholder="点击跳转链接" />
          </Form.Item>
          <Form.Item name="priority" label="优先级（数字越大越靠前）">
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          <Space>
            <Form.Item name="start_date" label="开始日期">
              <DatePicker showTime />
            </Form.Item>
            <Form.Item name="end_date" label="结束日期">
              <DatePicker showTime />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>

      {/* Announcement Modal */}
      <Modal
        title={editingAnnouncement ? '编辑公告' : '新增公告'}
        open={announcementModalOpen}
        onOk={handleAnnouncementSubmit}
        onCancel={() => setAnnouncementModalOpen(false)}
        width={600}
      >
        <Form form={announcementForm} layout="vertical">
          <Form.Item name="title" label="标题" rules={[{ required: true, message: '请输入标题' }]}>
            <Input placeholder="公告标题" />
          </Form.Item>
          <Form.Item name="content" label="内容" rules={[{ required: true, message: '请输入内容' }]}>
            <TextArea rows={4} placeholder="公告内容" />
          </Form.Item>
          <Space>
            <Form.Item name="type" label="类型">
              <Select style={{ width: 120 }}>
                <Option value="info">信息</Option>
                <Option value="warning">警告</Option>
                <Option value="promotion">促销</Option>
              </Select>
            </Form.Item>
            <Form.Item name="priority" label="优先级">
              <Select style={{ width: 120 }}>
                <Option value="high">高</Option>
                <Option value="medium">中</Option>
                <Option value="low">低</Option>
              </Select>
            </Form.Item>
          </Space>
          <Space>
            <Form.Item name="start_date" label="开始日期">
              <DatePicker showTime />
            </Form.Item>
            <Form.Item name="end_date" label="结束日期">
              <DatePicker showTime />
            </Form.Item>
          </Space>
          <Form.Item name="is_active" label="启用" valuePropName="checked">
            <Switch />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
