'use client';

import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export default function OrderTrackingLink({ orderNumber, className, children }: { orderNumber?: string; className?: string; children?: ReactNode }) {
  const locale = useLocale();
  const t = useTranslations();
  const query = orderNumber ? `?order_number=${encodeURIComponent(orderNumber)}` : '';
  return <Link href={`/${locale}/orders/track${query}`} className={className}>{children ?? t('orders.tracking')}</Link>;
}
