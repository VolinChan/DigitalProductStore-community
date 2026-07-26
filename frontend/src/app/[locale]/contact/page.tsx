'use client';

import React from 'react';
import { Typography, Descriptions } from 'antd';
import { useTranslations } from 'next-intl';

const { Title, Paragraph } = Typography;

export default function ContactPage() {
  const t = useTranslations();

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>{t('layout.contactUs')}</Title>
      <Paragraph>{t('contact.desc')}</Paragraph>
      <Descriptions column={1} bordered size="medium" className="mt-4">
        <Descriptions.Item label={t('contact.email')}>
          <a href="mailto:support@plexoria.cl" className="text-accent hover:text-accent/80">support@plexoria.cl</a>
        </Descriptions.Item>
        <Descriptions.Item label={t('contact.phone')}>
          <a href="tel:+56995096835" className="text-accent hover:text-accent/80">+56 9 9509 6835</a>
        </Descriptions.Item>
        <Descriptions.Item label={t('contact.hours')}>{t('contact.hoursText')}</Descriptions.Item>
      </Descriptions>
    </main>
  );
}
