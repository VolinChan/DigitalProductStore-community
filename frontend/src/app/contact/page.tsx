'use client';

import React from 'react';
import { Typography, Descriptions } from 'antd';

const { Title, Paragraph } = Typography;

export default function ContactPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>联系我们</Title>
      <Paragraph>如有任何疑问，欢迎通过以下方式联系我们。</Paragraph>
      <Descriptions column={1} bordered size="middle" className="mt-4">
        <Descriptions.Item label="客服邮箱">support@digitalstore.example</Descriptions.Item>
        <Descriptions.Item label="客服电话">400-000-0000</Descriptions.Item>
        <Descriptions.Item label="工作时间">周一至周日 09:00–21:00</Descriptions.Item>
      </Descriptions>
    </main>
  );
}
