import React from 'react';
import Skeleton from 'antd/es/skeleton';
import SkeletonImage from 'antd/es/skeleton/Image';

export default function Loading() {
  return (
    <div className="container mx-auto p-4 md:p-8 space-y-8 animate-pulse">
      <Skeleton active paragraph={{ rows: 2 }} />
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {[...Array(8)].map((_, i) => (
          <div key={i} className="border border-gray-200 dark:border-gray-800 rounded-lg p-4">
            <SkeletonImage active className="!w-full !h-48 mb-4 rounded-md" />
            <Skeleton active title={false} paragraph={{ rows: 3 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
