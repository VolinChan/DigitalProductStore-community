'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Col, Row, Spin, Empty, Typography } from 'antd';
import { useLocale, useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import type { Category } from '@/types';

const { Title, Paragraph } = Typography;
interface CategoriesResponse { data: { categories: Category[] } }

export default function CategoriesPage() {
  const t = useTranslations();
  const locale = useLocale();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiClient.get<CategoriesResponse>('/categories')
      .then((res) => setCategories(res.data.data?.categories || []))
      .catch(() => setCategories([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <main className="store-container" id="main-content">
      <Title level={2} className="!mb-6">{t('categories.title')}</Title>
      {loading ? <div className="flex items-center justify-center min-h-[300px]"><Spin size="large" /></div>
        : categories.length === 0 ? <Empty description={t('categories.empty')} />
          : <Row gutter={[16, 16]}>{categories.map((category) => (
            <Col key={category.id} xs={12} sm={8} md={6} lg={4} className="flex">
              <Link href={`/${locale}/products?category_id=${category.id}`} className="block h-full w-full">
                <Card hoverable className="h-full w-full text-center" styles={{ body: { minHeight: 88, height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' } }}>
                  <Paragraph strong className="!mb-0 w-full whitespace-normal break-words !leading-5">{category.name}</Paragraph>
                </Card>
              </Link>
            </Col>
          ))}</Row>}
    </main>
  );
}
