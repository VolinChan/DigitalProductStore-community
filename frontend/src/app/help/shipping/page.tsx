'use client';

import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function ShippingPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>配送说明</Title>
      <Paragraph>下单成功后，我们将在 1–3 个工作日内发货。发货后会通过邮件通知您物流单号。</Paragraph>
      <Paragraph>目前仅支持中国大陆地区配送。偏远地区可能需要额外 1–3 个工作日。</Paragraph>
    </main>
  );
}
