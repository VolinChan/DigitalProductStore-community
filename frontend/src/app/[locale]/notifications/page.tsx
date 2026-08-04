'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BellOutlined, CheckOutlined, LoadingOutlined } from '@ant-design/icons';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { InAppNotification } from '@/types';
import { useAuthStore } from '@/store/useAuthStore';

export default function NotificationsPage() {
  const t = useTranslations('notifications');
  const locale = useLocale();
  const authenticated = useAuthStore((state) => state.isAuthenticated);
  const [rows, setRows] = useState<InAppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    if (!authenticated) { setLoading(false); return; }
    setLoading(true);
    try { const response = await apiClient.get('/notifications', { params: { limit: 50 } }); setRows(response.data.data || []); }
    finally { setLoading(false); }
  }, [authenticated]);
  useEffect(() => { void load(); }, [load]);
  const markRead = async (row: InAppNotification) => {
    if (row.read_at) return;
    await apiClient.post(`/notifications/${row.id}/read`);
    setRows((current) => current.map((item) => item.id === row.id ? { ...item, read_at: new Date().toISOString() } : item));
  };
  const markAll = async () => { await apiClient.post('/notifications/read-all'); setRows((current) => current.map((item) => ({ ...item, read_at: item.read_at || new Date().toISOString() }))); };
  if (loading) return <main className="store-container flex min-h-[50vh] items-center justify-center"><LoadingOutlined spin className="text-3xl" /></main>;
  if (!authenticated) return <main className="store-container"><p>{t('signInRequired')}</p><Link href={`/${locale}/login`} className="sf-button-primary mt-4">{t('signIn')}</Link></main>;
  return <main className="store-container"><div className="mx-auto max-w-3xl"><div className="flex items-center justify-between gap-4"><div><p className="text-xs font-extrabold uppercase text-[var(--sf-accent)]">PLEXORIA</p><h1 className="mt-2 text-3xl font-black">{t('title')}</h1></div>{rows.some((row) => !row.read_at) && <button type="button" onClick={() => void markAll()} className="sf-button-secondary"><CheckOutlined />{t('markAll')}</button>}</div>{rows.length === 0 ? <div className="mt-10 rounded-[18px] bg-[var(--sf-soft)] p-8 text-center"><BellOutlined className="text-3xl text-[var(--sf-muted)]" /><p className="mt-3 font-bold">{t('empty')}</p></div> : <ul className="mt-8 space-y-3">{rows.map((row) => <li key={row.id}><Link href={row.deep_link || `/${locale}/orders`} onClick={() => void markRead(row)} className={`block rounded-[16px] border p-4 transition hover:border-[var(--sf-accent)] ${row.read_at ? 'border-[var(--sf-line)] bg-white' : 'border-[var(--sf-accent)]/40 bg-[var(--sf-soft)]'}`}><div className="flex items-start justify-between gap-3"><div><h2 className="font-black">{row.title}</h2><p className="mt-1 text-sm text-[var(--sf-muted)]">{row.body_summary}</p><time className="mt-2 block text-xs text-[var(--sf-subtle)]">{new Date(row.created_at).toLocaleString(locale)}</time></div>{!row.read_at && <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-[var(--sf-accent)]" aria-label={t('unread')} />}</div></Link></li>)}</ul>}</div></main>;
}
