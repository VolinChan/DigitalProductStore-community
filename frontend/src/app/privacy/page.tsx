'use client';

import React from 'react';
import { Typography } from 'antd';

const { Title, Paragraph } = Typography;

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <Title level={2}>隐私政策</Title>
      <Paragraph>
        我们高度重视您的个人信息保护。本平台仅在完成订单、提供服务所必需的范围内收集您的信息。
      </Paragraph>
      <Paragraph>
        您的支付信息通过第三方支付网关（如 Stripe）进行处理，本平台不存储完整的支付卡数据。
      </Paragraph>
      <Paragraph>
        如需查询、修改或删除您的个人数据，请通过&ldquo;联系我们&rdquo;页面提供的方式与我们联系。
      </Paragraph>
    </main>
  );
}
