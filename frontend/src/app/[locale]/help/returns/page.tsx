'use client';

import { Typography } from 'antd';
import { useTranslations } from 'next-intl';

const { Title, Paragraph } = Typography;

export default function ReturnsPage() {
  const t = useTranslations('help.returns');
  return <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
    <Title level={2}>{t('title')}</Title>
    <Title level={4}>{t('period')}</Title><Paragraph>{t('periodDesc')}</Paragraph>
    <Title level={4}>{t('conditions')}</Title><Paragraph>{t('conditionsDesc')}</Paragraph>
    <Title level={4}>{t('process')}</Title><Paragraph>{t('processDesc')}</Paragraph>
  </main>;
}
