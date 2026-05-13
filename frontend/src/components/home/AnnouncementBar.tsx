'use client';

import React, { useEffect, useState } from 'react';
import { Alert } from 'antd';
import {
  InfoCircleOutlined,
  WarningOutlined,
  GiftOutlined,
} from '@ant-design/icons';
import type { Announcement, AnnouncementType } from '@/types';

interface AnnouncementBarProps {
  announcements: Announcement[];
}

const DISMISSED_KEY = 'dismissed_announcements';

/**
 * Announcement display component for the homepage.
 * Requirement 26.5: Display active announcements with priority "high" prominently at the top.
 * Requirement 26.7: Allow users to dismiss announcements and remember dismissal in browser storage.
 */
export default function AnnouncementBar({ announcements }: AnnouncementBarProps) {
  const [dismissedIds, setDismissedIds] = useState<number[]>([]);

  useEffect(() => {
    // Load dismissed announcements from localStorage
    try {
      const stored = localStorage.getItem(DISMISSED_KEY);
      if (stored) {
        setDismissedIds(JSON.parse(stored));
      }
    } catch {
      // Ignore parse errors
    }
  }, []);

  const handleDismiss = (id: number) => {
    const updated = [...dismissedIds, id];
    setDismissedIds(updated);
    try {
      localStorage.setItem(DISMISSED_KEY, JSON.stringify(updated));
    } catch {
      // Ignore storage errors
    }
  };

  // Filter out dismissed announcements and sort by priority (high first)
  const visibleAnnouncements = announcements
    .filter((a) => !dismissedIds.includes(a.id))
    .sort((a, b) => {
      const priorityOrder = { high: 0, medium: 1, low: 2 };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  if (visibleAnnouncements.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {visibleAnnouncements.map((announcement) => (
        <Alert
          key={announcement.id}
          message={announcement.title}
          description={announcement.content}
          type={getAlertType(announcement.type)}
          icon={getIcon(announcement.type)}
          showIcon
          closable
          onClose={() => handleDismiss(announcement.id)}
          className={announcement.priority === 'high' ? 'border-2' : ''}
        />
      ))}
    </div>
  );
}

function getAlertType(type: AnnouncementType): 'info' | 'warning' | 'success' | 'error' {
  switch (type) {
    case 'warning':
      return 'warning';
    case 'promotion':
      return 'success';
    case 'info':
    default:
      return 'info';
  }
}

function getIcon(type: AnnouncementType) {
  switch (type) {
    case 'warning':
      return <WarningOutlined />;
    case 'promotion':
      return <GiftOutlined />;
    case 'info':
    default:
      return <InfoCircleOutlined />;
  }
}
