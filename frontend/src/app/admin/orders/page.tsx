'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, Select, Tag, DatePicker,
  message, Descriptions, Timeline, Popconfirm,
} from 'antd';
import {
  EyeOutlined, ExportOutlined, ReloadOutlined, SendOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { Order, OrderStatus, PaymentMethod } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { RangePicker } = DatePicker;
const { Option } = Select;

const statusLabels: Record<OrderStatus, string> = {
  pending_payment: '待支付',
  pending_transfer: '待确认转账',
  paid: '已支付',
  pending_shipment: '待发货',
  shipped: '已发货',
  completed: '已完成',
  cancelled: '已取消',
  payment_failed: '支付失败',
};

const statusColors: Record<OrderStatus, string> = {
  pending_payment: 'orange',
  pending_transfer: 'gold',
  paid: 'blue',
  pending_shipment: 'cyan',
  shipped: 'geekblue',
  completed: 'green',
  cancelled: 'red',
  payment_failed: 'volcano',
};

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [shipModalOpen, setShipModalOpen] = useState(false);
  const [shipForm] = Form.useForm();

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        page,
        page_size: pageSize,
      };
      if (statusFilter) params.status = statusFilter;
      const res = await apiClient.get<{
        data: { orders: Order[]; total: number; page: number; page_size: number };
        meta: { total: number };
      }>('/admin/orders', { params });
      setOrders(res.data.data?.orders || []);
      setTotal(res.data.meta?.total || res.data.data?.total || 0);
    } catch {
      message.error('获取订单列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, statusFilter]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const handleViewDetail = (order: Order) => {
    setSelectedOrder(order);
    setDetailModalOpen(true);
  };

  const handleShip = (order: Order) => {
    setSelectedOrder(order);
    shipForm.resetFields();
    setShipModalOpen(true);
  };

  const handleShipSubmit = async () => {
    try {
      const values = await shipForm.validateFields();
      await apiClient.put(`/admin/orders/${selectedOrder?.id}/status`, {
        status: 'shipped',
        shipping_carrier: values.shipping_carrier,
        tracking_number: values.tracking_number,
      });
      message.success('发货成功');
      setShipModalOpen(false);
      fetchOrders();
    } catch {
      message.error('发货失败');
    }
  };

  const handleCancel = async (orderId: number) => {
    try {
      await apiClient.post(`/admin/orders/${orderId}/cancel`);
      message.success('订单已取消');
      fetchOrders();
    } catch {
      message.error('取消失败');
    }
  };

  const handleExport = async () => {
    try {
      const res = await apiClient.get('/admin/orders/export', { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `orders_${Date.now()}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      message.success('导出成功');
    } catch {
      message.error('导出失败');
    }
  };

  const columns: ColumnsType<Order> = [
    { title: '订单号', dataIndex: 'order_number', key: 'order_number', width: 160 },
    {
      title: '客户',
      key: 'customer',
      render: (_, record) => record.guest_name || record.guest_email || `用户#${record.user_id}`,
    },
    {
      title: '金额',
      dataIndex: 'total_amount',
      key: 'total_amount',
      render: (v: number) => `¥${v}`,
    },
    {
      title: '支付方式',
      dataIndex: 'payment_method',
      key: 'payment_method',
      render: (v: PaymentMethod) => (v === 'online' ? '在线支付' : '转账支付'),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: OrderStatus) => (
        <Tag color={statusColors[status]}>{statusLabels[status]}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewDetail(record)}>
            详情
          </Button>
          {(record.status === 'paid' || record.status === 'pending_shipment') && (
            <Button size="small" type="primary" icon={<SendOutlined />} onClick={() => handleShip(record)}>
              发货
            </Button>
          )}
          {(record.status === 'pending_payment' || record.status === 'pending_transfer') && (
            <Popconfirm title="确定取消此订单？" onConfirm={() => handleCancel(record.id)}>
              <Button size="small" danger>取消</Button>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">订单管理</h2>
        <Space>
          <Select
            placeholder="状态筛选"
            allowClear
            style={{ width: 140 }}
            value={statusFilter || undefined}
            onChange={(v) => { setStatusFilter(v || ''); setPage(1); }}
          >
            {Object.entries(statusLabels).map(([key, label]) => (
              <Option key={key} value={key}>{label}</Option>
            ))}
          </Select>
          <Button icon={<ReloadOutlined />} onClick={fetchOrders}>刷新</Button>
          <Button icon={<ExportOutlined />} onClick={handleExport}>导出 CSV</Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={orders}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Order Detail Modal */}
      <Modal
        title={`订单详情 - ${selectedOrder?.order_number || ''}`}
        open={detailModalOpen}
        onCancel={() => setDetailModalOpen(false)}
        footer={null}
        width={700}
      >
        {selectedOrder && (
          <div>
            <Descriptions bordered size="small" column={2}>
              <Descriptions.Item label="订单号">{selectedOrder.order_number}</Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColors[selectedOrder.status]}>{statusLabels[selectedOrder.status]}</Tag>
              </Descriptions.Item>
              <Descriptions.Item label="客户">{selectedOrder.guest_name || `用户#${selectedOrder.user_id}`}</Descriptions.Item>
              <Descriptions.Item label="邮箱">{selectedOrder.guest_email || '-'}</Descriptions.Item>
              <Descriptions.Item label="电话">{selectedOrder.guest_phone || '-'}</Descriptions.Item>
              <Descriptions.Item label="支付方式">{selectedOrder.payment_method === 'online' ? '在线支付' : '转账支付'}</Descriptions.Item>
              <Descriptions.Item label="商品金额">¥{selectedOrder.subtotal}</Descriptions.Item>
              <Descriptions.Item label="运费">¥{selectedOrder.shipping_fee}</Descriptions.Item>
              <Descriptions.Item label="总金额" span={2}>¥{selectedOrder.total_amount}</Descriptions.Item>
              <Descriptions.Item label="收货地址" span={2}>{selectedOrder.shipping_address}</Descriptions.Item>
              {selectedOrder.shipping_carrier && (
                <Descriptions.Item label="物流信息" span={2}>
                  {selectedOrder.shipping_carrier} - {selectedOrder.tracking_number}
                </Descriptions.Item>
              )}
            </Descriptions>
            {selectedOrder.items && selectedOrder.items.length > 0 && (
              <div className="mt-4">
                <h4 className="font-medium mb-2">订单商品</h4>
                <Table
                  size="small"
                  pagination={false}
                  dataSource={selectedOrder.items}
                  rowKey="id"
                  columns={[
                    { title: 'SKU', dataIndex: 'sku_name', key: 'sku_name' },
                    { title: '编码', dataIndex: 'sku_code', key: 'sku_code' },
                    { title: '数量', dataIndex: 'quantity', key: 'quantity' },
                    { title: '单价', dataIndex: 'unit_price', key: 'unit_price', render: (v: number) => `¥${v}` },
                    { title: '小计', dataIndex: 'subtotal', key: 'subtotal', render: (v: number) => `¥${v}` },
                  ]}
                />
              </div>
            )}
          </div>
        )}
      </Modal>

      {/* Ship Modal */}
      <Modal
        title="发货"
        open={shipModalOpen}
        onOk={handleShipSubmit}
        onCancel={() => setShipModalOpen(false)}
      >
        <Form form={shipForm} layout="vertical">
          <Form.Item name="shipping_carrier" label="物流公司" rules={[{ required: true, message: '请输入物流公司' }]}>
            <Input placeholder="如：顺丰速运" />
          </Form.Item>
          <Form.Item name="tracking_number" label="物流单号" rules={[{ required: true, message: '请输入物流单号' }]}>
            <Input placeholder="请输入物流单号" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
