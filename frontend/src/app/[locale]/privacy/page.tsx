'use client';

import React from 'react';
import { Typography } from 'antd';
import { useTranslations } from 'next-intl';

const { Title, Paragraph } = Typography;

export default function PrivacyPage() {
  const t = useTranslations();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>{t('layout.privacyPolicy')}</Title>
      <Paragraph>{t('privacy.policyDesc', { defaultValue: 'We respect your privacy. Your personal information will be handled in accordance with applicable laws.' })}</Paragraph>
    </main>
  );
}
