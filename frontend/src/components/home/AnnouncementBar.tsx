'use client';

import { useEffect, useState } from 'react';
import { CloseOutlined, GiftOutlined, InfoCircleOutlined, WarningOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { Announcement, AnnouncementType } from '@/types';

interface AnnouncementBarProps {
  announcements: Announcement[];
}

const DISMISSED_KEY = 'dismissed_announcements';

export default function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const t = useTranslations();
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      if (stored) setDismissedIds(JSON.parse(stored));
    } catch {
      setDismissedIds([]);
    }
  }, []);

  const visible = announcements
    .filter((announcement) => !dismissedIds.includes(announcement.id))
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.priority] - ({ high: 0, medium: 1, low: 2 })[b.priority]);

  if (visible.length === 0) return null;

  const dismiss = (id: number) => {
    const next = [...dismissedIds, id];
    setDismissedIds(next);
    try { localStorage.setItem(DISMISSED_KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  };

  return (
    <div className="space-y-2">
      {visible.map((announcement) => (
        <div key={announcement.id} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-[0_2px_16px_rgba(23,63,103,0.05)]">
          <span className="mt-0.5 text-[var(--sf-accent)]">{announcementIcon(announcement.type)}</span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-[var(--sf-ink)]">{announcement.title}</p>
            <p className="mt-0.5 text-xs leading-5 text-[var(--sf-muted)] sm:text-sm">{announcement.content}</p>
          </div>
          <button type="button" onClick={() => dismiss(announcement.id)} className="sf-icon-button !h-11 !w-11 !shrink-0" aria-label={t('common.close')}>
            <CloseOutlined />
          </button>
        </div>
      ))}
    </div>
  );
}

function announcementIcon(type: AnnouncementType) {
  if (type === 'warning') return <WarningOutlined />;
  if (type === 'promotion') return <GiftOutlined />;
  return <InfoCircleOutlined />;
}
