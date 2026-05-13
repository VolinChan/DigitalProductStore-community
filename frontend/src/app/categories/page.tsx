'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, Col, Row, Spin, Empty, Typography } from 'antd';
import apiClient from '@/lib/api';
import type { Category } from '@/types';

const { Title, Paragraph } = Typography;

interface CategoriesResponse {
  data: { categories: Category[] };
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiClient.get<CategoriesResponse>('/categories');
        setCategories(res.data.data?.categories || []);
      } catch {
        setCategories([]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
      <Title level={2} className="!mb-6">商品分类</Title>

      {loading ? (
        <div className="flex items-center justify-center min-h-[300px]">
          <Spin size="large" />
        </div>
      ) : categories.length === 0 ? (
        <Empty description="暂无分类" />
      ) : (
        <Row gutter={[16, 16]}>
          {categories.map((c) => (
            <Col key={c.id} xs={12} sm={8} md={6} lg={4}>
              <Link href={`/products?category_id=${c.id}`}>
                <Card hoverable className="text-center">
                  <Paragraph strong className="!mb-0">{c.name}</Paragraph>
                </Card>
              </Link>
            </Col>
          ))}
        </Row>
      )}
    </main>
  );
}
