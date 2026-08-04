'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { BankOutlined, CameraOutlined, CheckCircleFilled, ClockCircleOutlined, DeleteOutlined, PlusOutlined, ReloadOutlined, UploadOutlined } from '@ant-design/icons';
import { message } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import { formatCLP, formatDateTime } from '@/lib/utils';
import type { TransferDeclaration, TransferDeclarationEntry, TransferPaymentAccount, TransferPaymentConfig } from '@/types';
import OrderTrackingLink from '@/components/order/OrderTrackingLink';

interface TransferPaymentProps {
  orderId: number;
  orderNumber: string;
  totalAmount: number;
  accounts?: TransferPaymentAccount[];
  confirmationDeadline?: string;
  onUploadSuccess?: () => void;
  adjustmentId?: number;
}

type UploadStatus = 'queued' | 'uploading' | 'uploaded' | 'failed';
interface ProofTask { id: string; file: File; entryKey?: string; status: UploadStatus; progress: number; error?: string }
interface TransferEntryDraft { key: string; accountId?: number; amount: string; note: string }

const acceptedExtensions = ['jpg', 'jpeg', 'png', 'pdf', 'heic', 'heif'];
const acceptedMIMEs = ['image/jpeg', 'image/png', 'application/pdf', 'image/heic', 'image/heif'];
const uploadConcurrency = Math.max(1, Math.min(4, Number(process.env.NEXT_PUBLIC_MEDIA_UPLOAD_CONCURRENCY) || 3));

const legacyTransferConfig: TransferPaymentConfig = {
  bank_name: process.env.NEXT_PUBLIC_TRANSFER_BANK_NAME?.trim() || '',
  account_name: process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME?.trim() || '',
  account_number: process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER?.trim() || '',
  configured: false,
  accounts: [],
};
legacyTransferConfig.configured = Boolean(legacyTransferConfig.bank_name && legacyTransferConfig.account_name && legacyTransferConfig.account_number);
if (legacyTransferConfig.configured) legacyTransferConfig.accounts = [{ bank_name: legacyTransferConfig.bank_name, account_name: legacyTransferConfig.account_name, rut: '', account_type: '', account_number: legacyTransferConfig.account_number, email: '', sort_order: 0, is_active: true }];

function isTransferPaymentConfig(value: unknown): value is TransferPaymentConfig {
  if (!value || typeof value !== 'object') return false;
  const config = value as Partial<TransferPaymentConfig>;
  return typeof config.configured === 'boolean' && Array.isArray(config.accounts);
}

function newKey(prefix: string) {
  return `${prefix}-${typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
}

export default function TransferPayment({ orderId, orderNumber, totalAmount, accounts: snapshotAccounts, confirmationDeadline, onUploadSuccess, adjustmentId }: TransferPaymentProps) {
  const t = useTranslations();
  const locale = useLocale();
  const [transferConfig, setTransferConfig] = useState<TransferPaymentConfig>(legacyTransferConfig);
  const [configLoading, setConfigLoading] = useState(snapshotAccounts === undefined);
  const [started, setStarted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [entries, setEntries] = useState<TransferEntryDraft[]>([]);
  const [tasks, setTasks] = useState<ProofTask[]>([]);
  const [declaration, setDeclaration] = useState<TransferDeclaration>();
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const idempotencyKey = useRef(newKey('transfer-declaration'));
  const purchaseEmail = typeof window === 'undefined' ? '' : (sessionStorage.getItem(`transfer-email:${orderId}`) || '');
  const displayedAccounts = snapshotAccounts ?? transferConfig.accounts;
  const transferConfigured = displayedAccounts.length > 0;

  useEffect(() => {
    if (snapshotAccounts !== undefined) { setConfigLoading(false); return; }
    let active = true;
    void apiClient.get<{ data: TransferPaymentConfig }>('/store-config/transfer-payment')
      .then((response) => { if (active && isTransferPaymentConfig(response.data.data)) setTransferConfig(response.data.data); })
      .catch(() => undefined)
      .finally(() => { if (active) setConfigLoading(false); });
    return () => { active = false; };
  }, [snapshotAccounts]);

  const entryIDByKey = useMemo(() => {
    const result = new Map<string, number>();
    entries.forEach((entry, index) => {
      const persisted = declaration?.entries?.[index];
      if (persisted) result.set(entry.key, persisted.id);
    });
    return result;
  }, [declaration, entries]);

  const validateFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) return t('transfer.fileTooLarge');
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!acceptedExtensions.includes(extension) || (file.type && !acceptedMIMEs.includes(file.type))) return t('transfer.invalidType');
    return '';
  };

  const addFiles = (files: FileList | File[], entryKey?: string) => {
    const additions: ProofTask[] = [];
    Array.from(files).forEach((file) => {
      const error = validateFile(file);
      if (error) { message.error(`${file.name}: ${error}`); return; }
      additions.push({ id: newKey('proof'), file, entryKey, status: 'queued', progress: 0 });
    });
    setTasks((current) => [...current, ...additions]);
  };

  const createDeclaration = async () => {
    if (declaration) return declaration;
	const endpoint = adjustmentId ? `/shipping-adjustments/${adjustmentId}/declarations` : '/transfer-declarations';
    const response = await apiClient.post<{ data: TransferDeclaration }>(endpoint, {
      order_id: orderId,
      purchase_email: purchaseEmail,
      idempotency_key: idempotencyKey.current,
      entries: expanded ? entries.map((entry) => ({ account_id: entry.accountId || null, amount: entry.amount || null, note: entry.note || null })) : [],
	  shipping_adjustment_id: adjustmentId,
    });
    setDeclaration(response.data.data);
    return response.data.data;
  };

  const uploadOne = async (task: ProofTask, currentDeclaration: TransferDeclaration, mappedEntryID?: number) => {
    setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'uploading', progress: 0, error: undefined } : item));
    const form = new FormData();
    form.append('file', task.file);
    if (purchaseEmail) form.append('purchase_email', purchaseEmail);
    if (mappedEntryID) form.append('entry_id', String(mappedEntryID));
    try {
      await apiClient.post(`/transfer-declarations/${currentDeclaration.id}/proofs`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (event) => {
          const progress = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
          setTasks((current) => current.map((item) => item.id === task.id ? { ...item, progress } : item));
        },
      });
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'uploaded', progress: 100 } : item));
      return true;
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: { message?: string } } } };
      setTasks((current) => current.map((item) => item.id === task.id ? { ...item, status: 'failed', error: apiError.response?.data?.error?.message || t('common.error') } : item));
      return false;
    }
  };

  const uploadQueue = async (queue: ProofTask[], currentDeclaration: TransferDeclaration, currentEntries: TransferDeclarationEntry[]) => {
    let cursor = 0;
    let allSucceeded = true;
    const mapping = new Map<string, number>();
    entries.forEach((entry, index) => { if (currentEntries[index]) mapping.set(entry.key, currentEntries[index].id); });
    const worker = async () => {
      while (cursor < queue.length) {
        const task = queue[cursor++];
        const succeeded = await uploadOne(task, currentDeclaration, task.entryKey ? mapping.get(task.entryKey) : undefined);
        if (!succeeded) allSucceeded = false;
      }
    };
    await Promise.all(Array.from({ length: Math.min(uploadConcurrency, queue.length) }, worker));
    return allSucceeded;
  };

  const handleSubmit = async () => {
    if (tasks.length === 0) { message.warning(t('transfer.uploadWarning')); return; }
    if (expanded && entries.some((entry) => entry.amount && Number(entry.amount) <= 0)) { message.error(t('transfer.invalidAmount')); return; }
    setSubmitting(true);
    try {
      const currentDeclaration = await createDeclaration();
      const queue = tasks.filter((task) => task.status !== 'uploaded');
      const succeeded = await uploadQueue(queue, currentDeclaration, currentDeclaration.entries || []);
      if (!succeeded) { message.error(t('transfer.someUploadsFailed')); return; }
      await apiClient.post(`/transfer-declarations/${currentDeclaration.id}/submit`, { purchase_email: purchaseEmail });
      setSubmitted(true);
      message.success(t('transfer.uploadSuccess'));
      onUploadSuccess?.();
    } catch (error: unknown) {
      const apiError = error as { response?: { data?: { error?: { message?: string } } } };
      message.error(apiError.response?.data?.error?.message || t('common.error'));
    } finally { setSubmitting(false); }
  };

  const retryTask = async (task: ProofTask) => {
    if (!declaration) return;
    await uploadOne(task, declaration, task.entryKey ? entryIDByKey.get(task.entryKey) : undefined);
  };

  return <div className="space-y-10">
    <section>
      <h2 className="flex items-center gap-2 text-xl font-black text-[var(--sf-ink)]"><BankOutlined className="text-[var(--sf-accent)]" />{t('transfer.bankInfo')}</h2>
      <p className="mt-3 text-sm leading-6 text-[var(--sf-muted)]">{t('transfer.bankInfoDesc')}</p>
      {!configLoading && !transferConfigured && <p role="alert" className="mt-4 rounded-lg bg-[#fff5d9] px-4 py-3 text-sm font-semibold text-[#835d00]">{t('transfer.configMissing')}</p>}
      <div className="mt-5 space-y-4">
        {displayedAccounts.map((account, index) => <section key={account.id ?? `${account.bank_name}-${index}`} className="overflow-hidden rounded-[16px] border border-[var(--sf-line)] bg-white">
          <h3 className="bg-[var(--sf-soft)] px-4 py-3 text-sm font-black">{t('transfer.accountHeading', { number: index + 1 })}</h3>
          <dl>{[[t('transfer.bankName'), account.bank_name], [t('transfer.accountName'), account.account_name], [t('transfer.rut'), account.rut], [t('transfer.accountType'), account.account_type], [t('transfer.accountNumber'), account.account_number], [t('transfer.email'), account.email]].map(([label, value], row) => <div key={label} className={`grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] ${row ? 'border-t border-[var(--sf-line)]' : ''}`}><dt className="text-xs font-bold text-[var(--sf-muted)]">{label}</dt><dd className="break-all text-sm font-black">{value || t('transfer.notConfigured')}</dd></div>)}</dl>
        </section>)}
        <dl className="overflow-hidden rounded-[16px] border border-[var(--sf-line)] bg-white">{[[t('transfer.amount'), formatCLP(totalAmount, locale)], [t('transfer.orderRef'), orderNumber]].map(([label, value], index) => <div key={label} className={`grid gap-1 px-4 py-3 sm:grid-cols-[170px_1fr] ${index ? 'border-t border-[var(--sf-line)]' : ''}`}><dt className="text-xs font-bold text-[var(--sf-muted)]">{label}</dt><dd className="break-all text-sm font-black text-[var(--sf-brand)]">{value}</dd></div>)}</dl>
      </div>
    </section>

    <section className="border-t border-[var(--sf-line)] pt-8">
      {!started && !submitted && <button type="button" disabled={configLoading || !transferConfigured} onClick={() => setStarted(true)} className="sf-button-primary w-full">{t('transfer.iTransferred')}</button>}
      {submitted ? <div role="status" className="flex gap-3 rounded-[16px] bg-[#e4f3e9] p-4 text-[#24723f]"><CheckCircleFilled className="mt-0.5 text-xl" /><div><p className="font-black">{t('transfer.uploaded')}</p><p className="mt-1 text-sm">{t('transfer.uploadedDesc')}</p></div></div> : started && <div className="space-y-5">
        <div><h2 className="flex items-center gap-2 text-xl font-black"><UploadOutlined className="text-[var(--sf-accent)]" />{t('transfer.uploadProof')}</h2><p className="mt-2 text-sm text-[var(--sf-muted)]">{t('transfer.uploadHint')}</p></div>
        <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-[16px] border border-dashed border-[var(--sf-line)] bg-[var(--sf-soft)] p-5 text-center"><UploadOutlined className="text-2xl text-[var(--sf-accent)]" /><span className="mt-2 font-bold">{t('transfer.dropText')}</span><span className="mt-1 text-xs text-[var(--sf-muted)]">{t('transfer.hint')}</span><input className="sr-only" type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.heic,.heif,image/jpeg,image/png,application/pdf,image/heic,image/heif" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} /></label>
        <label className="sf-button-secondary w-full cursor-pointer"><CameraOutlined />{t('transfer.takePhoto')}<input className="sr-only" type="file" accept="image/jpeg,image/png,image/heic,image/heif" capture="environment" onChange={(event) => { if (event.target.files) addFiles(event.target.files); event.target.value = ''; }} /></label>

        <button type="button" disabled={Boolean(declaration)} onClick={() => { setExpanded((value) => !value); if (entries.length === 0) setEntries([{ key: newKey('entry'), amount: '', note: '' }]); }} className="text-sm font-black text-[var(--sf-accent)]">{t('transfer.multipleQuestion')}</button>
        {expanded && <div className="space-y-4 rounded-[16px] border border-[var(--sf-line)] p-4">
          {entries.map((entry, index) => <div key={entry.key} className="space-y-3 border-b border-[var(--sf-line)] pb-4 last:border-0">
            <div className="flex items-center justify-between"><p className="font-black">{t('transfer.transferEntry', { number: index + 1 })}</p>{entries.length > 1 && !declaration && <button type="button" aria-label={t('common.delete')} onClick={() => { setEntries((current) => current.filter((item) => item.key !== entry.key)); setTasks((current) => current.filter((task) => task.entryKey !== entry.key)); }}><DeleteOutlined /></button>}</div>
            <select disabled={Boolean(declaration)} value={entry.accountId || ''} onChange={(event) => setEntries((current) => current.map((item) => item.key === entry.key ? { ...item, accountId: Number(event.target.value) || undefined } : item))} className="sf-input w-full"><option value="">{t('transfer.selectAccount')}</option>{displayedAccounts.map((account, accountIndex) => <option key={account.id ?? accountIndex} value={account.id}>{account.bank_name} · {account.account_number}</option>)}</select>
            <input disabled={Boolean(declaration)} inputMode="decimal" value={entry.amount} onChange={(event) => setEntries((current) => current.map((item) => item.key === entry.key ? { ...item, amount: event.target.value } : item))} placeholder={t('transfer.entryAmount')} className="sf-input w-full" />
            <textarea disabled={Boolean(declaration)} value={entry.note} onChange={(event) => setEntries((current) => current.map((item) => item.key === entry.key ? { ...item, note: event.target.value } : item))} placeholder={t('transfer.entryNote')} maxLength={500} className="sf-input min-h-20 w-full" />
            <label className="sf-button-secondary w-full cursor-pointer"><UploadOutlined />{t('transfer.addEntryProof')}<input className="sr-only" type="file" multiple accept=".jpg,.jpeg,.png,.pdf,.heic,.heif" onChange={(event) => { if (event.target.files) addFiles(event.target.files, entry.key); event.target.value = ''; }} /></label>
          </div>)}
          {!declaration && <button type="button" onClick={() => setEntries((current) => [...current, { key: newKey('entry'), amount: '', note: '' }])} className="sf-button-secondary w-full"><PlusOutlined />{t('transfer.addTransfer')}</button>}
        </div>}

        {tasks.length > 0 && <ul aria-label={t('transfer.uploadQueue')} className="space-y-2">{tasks.map((task) => <li key={task.id} className="rounded-xl border border-[var(--sf-line)] bg-white p-3"><div className="flex items-center gap-3"><div className="min-w-0 flex-1"><p className="truncate text-sm font-bold">{task.file.name}</p><p className="text-xs text-[var(--sf-muted)]">{t(`transfer.status.${task.status}`)} · {task.progress}%</p></div>{task.status === 'failed' && <button type="button" onClick={() => void retryTask(task)} aria-label={t('transfer.retryFile')} className="text-[var(--sf-accent)]"><ReloadOutlined /></button>}{task.status === 'queued' && !declaration && <button type="button" onClick={() => setTasks((current) => current.filter((item) => item.id !== task.id))} aria-label={t('common.delete')}><DeleteOutlined /></button>}</div><div className="mt-2 h-1.5 overflow-hidden rounded bg-[var(--sf-soft)]"><div className={`h-full ${task.status === 'failed' ? 'bg-red-500' : 'bg-[var(--sf-accent)]'}`} style={{ width: `${task.progress}%` }} /></div>{task.error && <p role="alert" className="mt-1 text-xs text-red-700">{task.error}</p>}</li>)}</ul>}
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting || tasks.length === 0} className="sf-button-primary w-full"><UploadOutlined />{submitting ? t('common.submitting') : t('transfer.submitProof')}</button>
      </div>}
    </section>

    {confirmationDeadline && <section className="border-t border-[var(--sf-line)] pt-8"><h2 className="flex items-center gap-2 text-xl font-black"><ClockCircleOutlined className="text-[var(--sf-accent)]" />{t('transfer.deadline')}</h2><div className="mt-4 rounded-[16px] bg-[#fff5d9] p-4 text-[#835d00]"><p className="text-sm">{t('transfer.deadlineDesc')}</p><p className="mt-2 font-black">{formatDateTime(confirmationDeadline, locale)}</p></div></section>}
    <OrderTrackingLink orderNumber={orderNumber} className="sf-button-secondary w-full" />
  </div>;
}
