'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, InputNumber, Tag, Image,
  message, Popconfirm, Alert, Checkbox,
} from 'antd';
import {
  CheckCircleOutlined, CloseCircleOutlined, EyeOutlined, ReloadOutlined,
} from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { Order, Payment } from '@/types';
import type { ColumnsType } from 'antd/es/table';

interface PendingTransfer {
  id: number;
  order_id: number;
  order_number: string;
  amount: number;
  transfer_proof_url: string;
  customer_name: string;
  customer_email: string;
  created_at: string;
  confirmation_deadline: string;
  remaining_hours: number;
}

export default function AdminPaymentsPage() {
  const [transfers, setTransfers] = useState<PendingTransfer[]>([]);
  const [loading, setLoading] = useState(false);
  const [proofModalOpen, setProofModalOpen] = useState(false);
  const [selectedTransfer, setSelectedTransfer] = useState<PendingTransfer | null>(null);
  const [confirmModalOpen, setConfirmModalOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState<React.Key[]>([]);
  const [batchModalOpen, setBatchModalOpen] = useState(false);
  const [confirmForm] = Form.useForm();
  const [rejectForm] = Form.useForm();
  const [batchForm] = Form.useForm();

  const fetchPendingTransfers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get('/admin/payments/transfer/pending');
      setTransfers(res.data.data || []);
    } catch {
      message.error('获取待确认转账列表失败');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPendingTransfers();
  }, [fetchPendingTransfers]);

  const handleViewProof = (record: PendingTransfer) => {
    setSelectedTransfer(record);
    setProofModalOpen(true);
  };

  const handleConfirm = (record: PendingTransfer) => {
    setSelectedTransfer(record);
    confirmForm.setFieldsValue({ received_amount: record.amount });
    setConfirmModalOpen(true);
  };

  const handleConfirmSubmit = async () => {
    try {
      const values = await confirmForm.validateFields();
      await apiClient.post(`/admin/payments/transfer/${selectedTransfer?.id}/confirm`, {
        received_amount: values.received_amount,
        notes: values.notes,
      });
      message.success('转账确认成功');
      setConfirmModalOpen(false);
      fetchPendingTransfers();
    } catch {
      message.error('确认失败');
    }
  };

  const handleReject = (record: PendingTransfer) => {
    setSelectedTransfer(record);
    rejectForm.resetFields();
    setRejectModalOpen(true);
  };

  const handleRejectSubmit = async () => {
    try {
      const values = await rejectForm.validateFields();
      await apiClient.post(`/admin/payments/transfer/${selectedTransfer?.id}/reject`, {
        reason: values.reason,
        notes: values.notes,
      });
      message.success('已拒绝转账');
      setRejectModalOpen(false);
      fetchPendingTransfers();
    } catch {
      message.error('操作失败');
    }
  };

  const handleBatchConfirm = () => {
    if (selectedRowKeys.length === 0) {
      message.warning('请选择要批量确认的转账');
      return;
    }
    setBatchModalOpen(true);
  };

  const handleBatchSubmit = async () => {
    try {
      const confirmations = selectedRowKeys.map((key) => {
        const transfer = transfers.find((t) => t.id === key);
        return {
          payment_id: key,
          received_amount: transfer?.amount || 0,
        };
      });
      await apiClient.post('/admin/payments/transfer/batch-confirm', { confirmations });
      message.success(`批量确认 ${selectedRowKeys.length} 笔转账成功`);
      setBatchModalOpen(false);
      setSelectedRowKeys([]);
      fetchPendingTransfers();
    } catch {
      message.error('批量确认失败');
    }
  };

  const getRemainingTimeTag = (deadline: string) => {
    const remaining = new Date(deadline).getTime() - Date.now();
    const hours = Math.floor(remaining / (1000 * 60 * 60));
    if (hours < 0) return <Tag color="red">已超期</Tag>;
    if (hours < 24) return <Tag color="orange">剩余 {hours} 小时</Tag>;
    const days = Math.floor(hours / 24);
    return <Tag color="blue">剩余 {days} 天</Tag>;
  };

  const columns: ColumnsType<PendingTransfer> = [
    { title: '订单号', dataIndex: 'order_number', key: 'order_number', width: 160 },
    {
      title: '客户',
      key: 'customer',
      render: (_, record) => record.customer_name || record.customer_email,
    },
    {
      title: '金额',
      dataIndex: 'amount',
      key: 'amount',
      render: (v: number) => `¥${v}`,
    },
    {
      title: '截止时间',
      dataIndex: 'confirmation_deadline',
      key: 'deadline',
      render: (val: string) => getRemainingTimeTag(val),
    },
    {
      title: '提交时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EyeOutlined />} onClick={() => handleViewProof(record)}>
            查看凭证
          </Button>
          <Button size="small" type="primary" icon={<CheckCircleOutlined />} onClick={() => handleConfirm(record)}>
            确认
          </Button>
          <Button size="small" danger icon={<CloseCircleOutlined />} onClick={() => handleReject(record)}>
            拒绝
          </Button>
        </Space>
      ),
    },
  ];

  const rowSelection = {
    selectedRowKeys,
    onChange: (keys: React.Key[]) => setSelectedRowKeys(keys),
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">转账确认</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchPendingTransfers}>刷新</Button>
          <Button
            type="primary"
            disabled={selectedRowKeys.length === 0}
            onClick={handleBatchConfirm}
          >
            批量确认 ({selectedRowKeys.length})
          </Button>
        </Space>
      </div>

      {transfers.length > 0 && (
        <Alert
          message={`当前有 ${transfers.length} 笔待确认转账`}
          type="info"
          showIcon
          className="mb-4"
        />
      )}

      <Table
        columns={columns}
        dataSource={transfers}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={false}
      />

      {/* Proof View Modal */}
      <Modal
        title="转账凭证"
        open={proofModalOpen}
        onCancel={() => setProofModalOpen(false)}
        footer={null}
        width={600}
      >
        {selectedTransfer && (
          <div className="text-center">
            <p className="mb-2">订单号: {selectedTransfer.order_number}</p>
            <p className="mb-4">金额: ¥{selectedTransfer.amount}</p>
            {selectedTransfer.transfer_proof_url ? (
              <Image
                src={selectedTransfer.transfer_proof_url}
                alt="转账凭证"
                style={{ maxWidth: '100%', maxHeight: 500 }}
              />
            ) : (
              <p className="text-gray-400">暂无凭证图片</p>
            )}
          </div>
        )}
      </Modal>

      {/* Confirm Modal */}
      <Modal
        title="确认转账"
        open={confirmModalOpen}
        onOk={handleConfirmSubmit}
        onCancel={() => setConfirmModalOpen(false)}
      >
        <Form form={confirmForm} layout="vertical">
          <Form.Item
            name="received_amount"
            label="实际收到金额"
            rules={[{ required: true, message: '请输入实际收到金额' }]}
          >
            <InputNumber style={{ width: '100%' }} min={0} precision={2} prefix="¥" />
          </Form.Item>
          {selectedTransfer && (
            <p className="text-sm text-gray-500 mb-2">
              订单金额: ¥{selectedTransfer.amount}
            </p>
          )}
          <Form.Item name="notes" label="备注">
            <Input.TextArea rows={2} placeholder="可选备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Reject Modal */}
      <Modal
        title="拒绝转账"
        open={rejectModalOpen}
        onOk={handleRejectSubmit}
        onCancel={() => setRejectModalOpen(false)}
      >
        <Form form={rejectForm} layout="vertical">
          <Form.Item
            name="reason"
            label="拒绝原因"
            rules={[{ required: true, message: '请输入拒绝原因' }]}
          >
            <Input.TextArea rows={3} placeholder="请输入拒绝原因，将通知客户" />
          </Form.Item>
          <Form.Item name="notes" label="内部备注">
            <Input.TextArea rows={2} placeholder="可选内部备注" />
          </Form.Item>
        </Form>
      </Modal>

      {/* Batch Confirm Modal */}
      <Modal
        title={`批量确认 ${selectedRowKeys.length} 笔转账`}
        open={batchModalOpen}
        onOk={handleBatchSubmit}
        onCancel={() => setBatchModalOpen(false)}
      >
        <Alert
          message={`将确认 ${selectedRowKeys.length} 笔转账，金额将使用订单金额作为实际收到金额。`}
          type="warning"
          showIcon
          className="mb-4"
        />
        <p>确定要批量确认这些转账吗？</p>
      </Modal>
    </div>
  );
}
