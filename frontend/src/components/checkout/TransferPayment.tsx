'use client';

import React, { useState } from 'react';
import { Typography, Upload, Button, Alert, Descriptions, message, Spin, Tag } from 'antd';
import { BankOutlined, UploadOutlined, ClockCircleOutlined, CheckCircleOutlined, CopyOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import apiClient from '@/lib/api';
import { useLocale, useTranslations } from 'next-intl';

const { Title, Text, Paragraph } = Typography;

interface TransferPaymentProps {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  confirmationDeadline?: string;
  onUploadSuccess?: () => void;
}

export default function TransferPayment({ orderId, orderNumber, totalAmount, confirmationDeadline, onUploadSuccess }: TransferPaymentProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const bankName = process.env.NEXT_PUBLIC_TRANSFER_BANK_NAME?.trim();
  const accountName = process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME?.trim();
  const accountNumber = process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER?.trim();
  const transferConfigured = Boolean(bankName && accountName && accountNumber);

  const handleUpload = async () => {
    if (fileList.length === 0) { message.warning(t('transfer.uploadWarning')); return; }
    const file = fileList[0];
    const formData = new FormData();
    formData.append('file', file.originFileObj as File);
    formData.append('order_id', orderId.toString());
    setUploading(true);
    try {
      await apiClient.post('/payments/transfer/upload', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      message.success(t('transfer.uploadSuccess'));
      setUploaded(true);
      onUploadSuccess?.();
    } catch { message.error(t('common.error')); }
    finally { setUploading(false); }
  };

  const uploadProps: UploadProps = {
    accept: '.jpg,.jpeg,.png,.pdf',
    maxCount: 1,
    fileList,
    beforeUpload: (file) => {
      const isLt10M = file.size / 1024 / 1024 < 10;
      if (!isLt10M) { message.error(t('transfer.fileTooLarge')); return Upload.LIST_IGNORE; }
      const validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      if (!validTypes.includes(file.type)) { message.error(t('transfer.invalidType')); return Upload.LIST_IGNORE; }
      return false;
    },
    onChange: ({ fileList: newFileList }) => setFileList(newFileList),
    onRemove: () => setFileList([]),
  };

  const formatDeadline = (deadline: string) => {
    const date = new Date(deadline);
    return date.toLocaleString(locale, { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  function formatCLP(amount: number): string {
    return new Intl.NumberFormat(locale, { style: 'currency', currency: 'CLP', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }

  return (
    <div className="space-y-6">
      {/* Bank Account Information */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <Title level={4} className="!mb-4"><BankOutlined className="mr-2" />{t('transfer.bankInfo')}</Title>
        <Alert title={t('transfer.bankInfoAlert')} description={t('transfer.bankInfoDesc')} type="info" showIcon className="mb-4" />
        {!transferConfigured && (
          <Alert title={t('transfer.configMissing')} type="warning" showIcon className="mb-4" />
        )}
        <Descriptions column={1} bordered size="small">
          <Descriptions.Item label={t('transfer.bankName')}>{bankName || t('transfer.notConfigured')}</Descriptions.Item>
          <Descriptions.Item label={t('transfer.accountName')}>{accountName || t('transfer.notConfigured')}</Descriptions.Item>
          <Descriptions.Item label={t('transfer.accountNumber')}>
            <div className="flex items-center gap-2"><Text>{accountNumber || t('transfer.notConfigured')}</Text></div>
          </Descriptions.Item>
          <Descriptions.Item label={t('transfer.amount')}>
            <Text strong className="text-red-500 text-lg">{formatCLP(totalAmount)}</Text>
          </Descriptions.Item>
          <Descriptions.Item label={t('transfer.orderRef')}>
            <Tag color="blue">{orderNumber}</Tag>
          </Descriptions.Item>
        </Descriptions>
      </div>

      {/* Upload Transfer Proof */}
      <div className="bg-white rounded-lg p-6 border border-gray-200">
        <Title level={4} className="!mb-4"><UploadOutlined className="mr-2" />{t('transfer.uploadProof')}</Title>
        {uploaded ? (
          <Alert title={t('transfer.uploaded')} description={t('transfer.uploadedDesc')} type="success" showIcon icon={<CheckCircleOutlined />} />
        ) : (
          <>
            <Paragraph type="secondary" className="!mb-4">{t('transfer.uploadHint')}</Paragraph>
            <Upload.Dragger {...uploadProps} disabled={uploading}>
              <p className="ant-upload-drag-icon"><UploadOutlined className="text-3xl text-blue-400" /></p>
              <p className="ant-upload-text">{t('transfer.dropText')}</p>
              <p className="ant-upload-hint">{t('transfer.hint')}</p>
            </Upload.Dragger>
            <Button type="primary" onClick={handleUpload} disabled={!transferConfigured || fileList.length === 0} loading={uploading} icon={uploading ? <Spin size="small" /> : <UploadOutlined />} size="large" block className="mt-4">
              {uploading ? t('common.submitting') : t('transfer.submitProof')}
            </Button>
          </>
        )}
      </div>

      {/* Confirmation Deadline */}
      {confirmationDeadline && (
        <div className="bg-white rounded-lg p-6 border border-gray-200">
          <Title level={4} className="!mb-4"><ClockCircleOutlined className="mr-2" />{t('transfer.deadline')}</Title>
          <Alert title={t('transfer.deadlineAlert')} description={
            <div>
              <Paragraph className="!mb-1">{t('transfer.deadlineDesc')}</Paragraph>
              <Text strong className="text-lg">{formatDeadline(confirmationDeadline)}</Text>
            </div>
          } type="warning" showIcon icon={<ClockCircleOutlined />} />
        </div>
      )}
    </div>
  );
}
