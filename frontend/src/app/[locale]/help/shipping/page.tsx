'use client';

import { Typography } from 'antd';
import { useTranslations } from 'next-intl';

const { Title, Paragraph } = Typography;

export default function ShippingPage() {
  const t = useTranslations('help.shipping');
  return <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Title level={2}>{t('title')}</Title>
    <Title level={4}>{t('processingTime')}</Title><Paragraph>{t('processingDesc')}</Paragraph>
    <Title level={4}>{t('deliveryTime')}</Title><Paragraph>{t('deliveryDesc')}</Paragraph>
    <Title level={4}>{t('cost')}</Title><Paragraph>{t('costDesc')}</Paragraph>
  </main>;
}
