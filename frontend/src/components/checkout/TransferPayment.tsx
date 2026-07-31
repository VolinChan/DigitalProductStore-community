'use client';

import { useState } from 'react';
import { Upload, message } from 'antd';
import { BankOutlined, UploadOutlined, ClockCircleOutlined, CheckCircleFilled } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';
import apiClient from '@/lib/api';
import { useLocale, useTranslations } from 'next-intl';
import { formatCLP, formatDateTime } from '@/lib/utils';

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

  return (
    <div className="space-y-10">
      <section>
        <h2 className="flex items-center gap-2 text-xl font-black text-[var(--sf-ink)]"><BankOutlined className="text-[var(--sf-accent)]" />{t('transfer.bankInfo')}</h2>
        <p className="mt-3 text-sm leading-6 text-[var(--sf-muted)]">{t('transfer.bankInfoDesc')}</p>
        {!transferConfigured && <p role="alert" className="mt-4 rounded-lg bg-[#fff5d9] px-4 py-3 text-sm font-semibold text-[#835d00]">{t('transfer.configMissing')}</p>}
        <dl className="mt-5 overflow-hidden rounded-[16px] border border-[var(--sf-line)] bg-white">
          {[
            [t('transfer.bankName'), bankName || t('transfer.notConfigured')],
            [t('transfer.accountName'), accountName || t('transfer.notConfigured')],
            [t('transfer.accountNumber'), accountNumber || t('transfer.notConfigured')],
            [t('transfer.amount'), formatCLP(totalAmount, locale)],
            [t('transfer.orderRef'), orderNumber],
          ].map(([label, value], index) => <div key={label} className={`grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] sm:gap-5 ${index > 0 ? 'border-t border-[var(--sf-line)]' : ''}`}><dt className="text-xs font-bold text-[var(--sf-muted)]">{label}</dt><dd className={`break-all text-sm font-black ${index >= 3 ? 'text-[var(--sf-brand)]' : 'text-[var(--sf-ink)]'}`}>{value}</dd></div>)}
        </dl>
      </section>

      <section className="border-t border-[var(--sf-line)] pt-8">
        <h2 className="flex items-center gap-2 text-xl font-black text-[var(--sf-ink)]"><UploadOutlined className="text-[var(--sf-accent)]" />{t('transfer.uploadProof')}</h2>
        {uploaded ? (
          <div role="status" className="mt-5 flex gap-3 rounded-[16px] bg-[#e4f3e9] p-4 text-[#24723f]"><CheckCircleFilled className="mt-0.5 text-xl" /><div><p className="font-black">{t('transfer.uploaded')}</p><p className="mt-1 text-sm leading-6">{t('transfer.uploadedDesc')}</p></div></div>
        ) : (
          <>
            <p className="mb-4 mt-3 text-sm leading-6 text-[var(--sf-muted)]">{t('transfer.uploadHint')}</p>
            <Upload.Dragger {...uploadProps} disabled={uploading} className="!rounded-[16px] !border-[var(--sf-line)] !bg-[var(--sf-soft)]">
              <p className="ant-upload-drag-icon"><UploadOutlined className="text-3xl text-[var(--sf-accent)]" /></p>
              <p className="ant-upload-text">{t('transfer.dropText')}</p>
              <p className="ant-upload-hint">{t('transfer.hint')}</p>
            </Upload.Dragger>
            <button type="button" onClick={handleUpload} disabled={!transferConfigured || fileList.length === 0 || uploading} className="sf-button-primary mt-4 w-full"><UploadOutlined />{uploading ? t('common.submitting') : t('transfer.submitProof')}</button>
          </>
        )}
      </section>

      {confirmationDeadline && (
        <section className="border-t border-[var(--sf-line)] pt-8"><h2 className="flex items-center gap-2 text-xl font-black text-[var(--sf-ink)]"><ClockCircleOutlined className="text-[var(--sf-accent)]" />{t('transfer.deadline')}</h2><div className="mt-4 rounded-[16px] bg-[#fff5d9] p-4 text-[#835d00]"><p className="text-sm">{t('transfer.deadlineDesc')}</p><p className="mt-2 font-black">{formatDateTime(confirmationDeadline, locale)}</p></div></section>
      )}
    </div>
  );
}
