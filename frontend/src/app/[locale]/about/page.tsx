'use client';

import React from 'react';
import { Typography } from 'antd';
import { useTranslations } from 'next-intl';

const { Title, Paragraph } = Typography;

export default function AboutPage() {
  const t = useTranslations();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>{t('layout.aboutPlexoria')}</Title>
      <Paragraph>{t('home.description')}</Paragraph>
      <Paragraph className="mt-4">{t('layout.contactUs')} +56 9 9509 6835</Paragraph>
    </main>
  );
}
