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
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <Title level={2} className="!mb-6">{t('categories.title')}</Title>
      {loading ? <div className="flex items-center justify-center min-h-[300px]"><Spin size="large" /></div>
        : categories.length === 0 ? <Empty description={t('categories.empty')} />
          : <Row gutter={[16, 16]}>{categories.map((category) => (
            <Col key={category.id} xs={12} sm={8} md={6} lg={4}>
              <Link href={`/${locale}/products?category_id=${category.id}`}>
                <Card hoverable className="text-center"><Paragraph strong className="!mb-0">{category.name}</Paragraph></Card>
              </Link>
            </Col>
          ))}</Row>}
    </main>
  );
}
