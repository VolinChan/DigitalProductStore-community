'use client';

import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function ReturnsPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>退换政策</Title>
      <Paragraph>
        自收到商品之日起 7 日内，非人为损坏、未拆封的商品可申请退货。
      </Paragraph>
      <Paragraph>
        如商品存在质量问题，请保留购买凭证与包装并联系客服，我们将安排换货或退款。
      </Paragraph>
    </main>
  );
}
