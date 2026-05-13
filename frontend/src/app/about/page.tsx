'use client';

import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function AboutPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>关于数码商城</Title>
      <Paragraph>
        数码商城是一个专注于数码产品在线销售的平台，提供优质的商品和购物体验。
      </Paragraph>
      <Paragraph>
        我们致力于为用户提供最新、最全的数码产品，并保证良好的售前售后服务。
      </Paragraph>
    </main>
  );
}
