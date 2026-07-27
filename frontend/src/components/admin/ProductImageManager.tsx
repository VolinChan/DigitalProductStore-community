'use client';

import { useState } from 'react';
import { Button, Empty, Popconfirm, Space, Tag, Tooltip, Upload, message } from 'antd';
import type { UploadProps } from 'antd';
import { ArrowLeftOutlined, ArrowRightOutlined, DeleteOutlined, StarFilled, StarOutlined, UploadOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api';
import ImageFallback from '@/components/ImageFallback';
import type { ProductImage } from '@/types';

interface ProductImageManagerProps {
  productId: number;
  images: ProductImage[];
  onChanged: () => Promise<void> | void;
}

export default function ProductImageManager({ productId, images, onChanged }: ProductImageManagerProps) {
  const [uploading, setUploading] = useState(false);
  const sortedImages = [...images].sort((a, b) => a.sort_order - b.sort_order || a.id - b.id);

  const uploadProps: UploadProps = {
    accept: 'image/jpeg,image/png,image/webp',
    showUploadList: false,
    multiple: true,
    customRequest: async ({ file, onError, onSuccess }) => {
      const formData = new FormData();
      formData.append('file', file as File);
      setUploading(true);
      try {
        await apiClient.post(`/admin/products/${productId}/images`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
        onSuccess?.({});
        await onChanged();
        message.success('图片上传成功');
      } catch (error) {
        onError?.(error as Error);
        message.error('图片上传失败，仅支持 JPG、PNG、WebP，单张不超过 5 MB');
      } finally {
        setUploading(false);
      }
    },
  };

  const setPrimary = async (imageId: number) => {
    try {
      await apiClient.put(`/admin/products/${productId}/images/${imageId}/primary`);
      await onChanged();
      message.success('主图已更新');
    } catch {
      message.error('设置主图失败');
    }
  };

  const remove = async (imageId: number) => {
    try {
      await apiClient.delete(`/admin/products/${productId}/images/${imageId}`);
      await onChanged();
      message.success('图片已删除');
    } catch {
      message.error('删除图片失败');
    }
  };

  const move = async (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sortedImages.length) return;
    const reordered = [...sortedImages];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    try {
      await apiClient.put(`/admin/products/${productId}/images/reorder`, {
        images: reordered.map((image, sortOrder) => ({ id: image.id, sort_order: sortOrder })),
      });
      await onChanged();
    } catch {
      message.error('图片排序失败');
    }
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-sm text-gray-500">第一张上传图片会自动成为主图；销售变体可从图库选择自己的图片。</p>
        <Upload {...uploadProps}>
          <Button icon={<UploadOutlined />} loading={uploading}>上传图片</Button>
        </Upload>
      </div>

      {sortedImages.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未上传商品图片" />
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {sortedImages.map((image, index) => (
            <div key={image.id} className="overflow-hidden rounded-md border bg-white">
              <div className="relative aspect-square bg-gray-50">
                <ImageFallback src={image.image_url} alt={`商品图片 ${index + 1}`} fill className="object-contain p-1" sizes="180px" />
                {image.is_primary && <Tag color="gold" className="absolute left-2 top-2 m-0">主图</Tag>}
              </div>
              <div className="flex items-center justify-between border-t p-2">
                <Space size={2}>
                  <Tooltip title="前移"><Button size="small" type="text" icon={<ArrowLeftOutlined />} disabled={index === 0} onClick={() => void move(index, -1)} /></Tooltip>
                  <Tooltip title="后移"><Button size="small" type="text" icon={<ArrowRightOutlined />} disabled={index === sortedImages.length - 1} onClick={() => void move(index, 1)} /></Tooltip>
                </Space>
                <Space size={2}>
                  <Tooltip title={image.is_primary ? '当前主图' : '设为主图'}>
                    <Button size="small" type="text" disabled={image.is_primary} icon={image.is_primary ? <StarFilled className="text-amber-500" /> : <StarOutlined />} onClick={() => void setPrimary(image.id)} />
                  </Tooltip>
                  <Popconfirm title="删除这张图片？" description="使用此图的 SKU 图片引用也会被清空。" onConfirm={() => void remove(image.id)}>
                    <Tooltip title="删除"><Button size="small" type="text" danger icon={<DeleteOutlined />} /></Tooltip>
                  </Popconfirm>
                </Space>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
