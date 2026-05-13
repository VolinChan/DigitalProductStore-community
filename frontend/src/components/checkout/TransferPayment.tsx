'use client';

import React, { useState } from 'react';
import {
  Typography,
  Upload,
  Button,
  Alert,
  Descriptions,
  message,
  Spin,
  Tag,
} from 'antd';
import {
  BankOutlined,
  UploadOutlined,
  ClockCircleOutlined,
  CheckCircleOutlined,
  CopyOutlined,
} from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import apiClient from '@/lib/api';

const { Title, Text, Paragraph } = Typography;

interface TransferPaymentProps {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  confirmationDeadline?: string;
  onUploadSuccess?: () => void;
}

// Bank account info (would typically come from backend config)
const BANK_ACCOUNT_INFO = {
  bank_name: '中国工商银行',
  account_name: '数码商城有限公司',
  account_number: '6222 0200 0000 1234 567',
  branch: '北京市朝阳区支行',
};

/**
 * Transfer payment component.
 * Displays bank account information, allows transfer proof upload,
 * and shows confirmation deadline.
 *
 * Requirements:
 * - 10.1: Display bank account information, exact payment amount, and order number reference
 * - 10.2: Allow upload of transfer proof in JPEG, PNG, or PDF format
 * - 10.3: Reject files larger than 10 MB
 * - 10.7: Set confirmation deadline of 7 days from order creation
 * - 10.8: Display confirmation deadline after upload
 */
export default function TransferPayment({
  orderId,
  orderNumber,
  totalAmount,
  confirmationDeadline,
  onUploadSuccess,
}: TransferPaymentProps) {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      message.success('已复制到剪贴板');
    });
  };

  const handleUpload = async () => {
    if (fileList.length === 0) {
      message.warning('请先选择转账凭证文件');
      return;
    }

    const file = fileList[0];
    const formData = new FormData();
    formData.append('file', file.originFileObj as File);
    formData.append('order_id', orderId.toString());

    setUploading(true);
    try {
      await apiClient.post('/payments/transfer/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      message.success('转账凭证上传成功');
      setUploaded(true);
      onUploadSuccess?.();
    } catch {
      message.error('上传失败，请重试');
    } finally {
      setUploading(false);
    }
  };

  const uploadProps: UploadProps = {
    accept: '.jpg,.jpeg,.png,.pdf',
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      // Validate file size (Requirement 10.3: reject files > 10MB)
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) {
        message.error('文件大小不能超过 10MB');
        return Upload.LIST_IGNORE;
      }

      // Validate file type (Requirement 10.2: JPEG, PNG, PDF)
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) {
        message.error('仅支持 JPEG、PNG 或 PDF 格式');
        return Upload.LIST_IGNORE;
      }

      return false; // Prevent auto upload
    },
    onChange: ({ fileList: newFileList }) => {
      setFileList(newFileList);
    },
    onRemove: () => {
      setFileList([]);
    },
  };

  // Format deadline for display
  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    return date.toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="space-y-6">
      {/* Bank Account Information (Requirement 10.1) */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <Title level={4} className="!mb-4">
          <BankOutlined className="mr-2" />
          银行转账信息
        </Title>

        <Alert
          message="请使用以下银行账户信息完成转账"
          description="转账时请务必在备注中填写订单号，以便我们快速确认您的付款。"
          type="info"
          showIcon
          className="mb-4"
        />

        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label="收款银行">
            {BANK_ACCOUNT_INFO.bank_name}
          </Descriptions.Item>
          <Descriptions.Item label="账户名称">
            {BANK_ACCOUNT_INFO.account_name}
          </Descriptions.Item>
          <Descriptions.Item label="银行账号">
            <div className="flex items-center gap-2">
              <Text copyable={false}>{BANK_ACCOUNT_INFO.account_number}</Text>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() =>
                  copyToClipboard(BANK_ACCOUNT_INFO.account_number.replace(/\s/g, ''))
                }
              />
            </div>
          </Descriptions.Item>
          <Descriptions.Item label="开户支行">
            {BANK_ACCOUNT_INFO.branch}
          </Descriptions.Item>
          <Descriptions.Item label="转账金额">
            <Text strong className="text-red-500 text-lg">
              ¥{totalAmount.toFixed(2)}
            </Text>
          </Descriptions.Item>
          <Descriptions.Item label="转账备注">
            <div className="flex items-center gap-2">
              <Tag color="blue">{orderNumber}</Tag>
              <Button
                type="text"
                size="small"
                icon={<CopyOutlined />}
                onClick={() => copyToClipboard(orderNumber)}
              />
            </div>
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* Upload Transfer Proof (Requirement 10.2) */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <Title level={4} className="!mb-4">
          <UploadOutlined className="mr-2" />
          上传转账凭证
        </Title>

        {uploaded ? (
          <Alert
            message="转账凭证已上传"
            description="我们已收到您的转账凭证，管理员将在确认截止时间前完成审核。"
            type="success"
            showIcon
            icon={<CheckCircleOutlined />}
          />
        ) : (
          <>
            <Paragraph type="secondary" className="!mb-4">
              请上传转账成功的截图或凭证文件，支持 JPEG、PNG、PDF 格式，文件大小不超过
              10MB。
            </Paragraph>

            <Upload.Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon">
                <UploadOutlined className="text-3xl text-blue-400" />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持 JPEG、PNG、PDF 格式，文件大小不超过 10MB
              </p>
            </Upload.Dragger>

            <Button
              type="primary"
              onClick={handleUpload}
              disabled={fileList.length === 0}
              loading={uploading}
              icon={uploading ? <Spin size="small" /> : <UploadOutlined />}
              size="large"
              block
              className="mt-4"
            >
              {uploading ? '上传中...' : '提交转账凭证'}
            </Button>
          </>
        )}
      </div>

      {/* Confirmation Deadline (Requirement 10.7, 10.8) */}
      {confirmationDeadline && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <Title level={4} className="!mb-4">
            <ClockCircleOutlined className="mr-2" />
            确认截止时间
          </Title>

          <Alert
            message="请注意确认截止时间"
            description={
              <div>
                <Paragraph className="!mb-1">
                  管理员将在以下时间前确认您的转账：
                </Paragraph>
                <Text strong className="text-lg">
                  {formatDeadline(confirmationDeadline)}
                </Text>
                <Paragraph type="secondary" className="!mt-2 !mb-0">
                  如果在截止时间前未确认，订单将自动取消并恢复库存。
                </Paragraph>
              </div>
            }
            type="warning"
            showIcon
            icon={<ClockCircleOutlined />}
          />
        </div>
      )}
    </div>
  );
}
