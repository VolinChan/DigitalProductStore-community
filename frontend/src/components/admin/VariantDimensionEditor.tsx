'use client';

import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Alert, Button, Card, Input, Modal, Radio, Select, Space, Tag, message } from 'antd';
import { DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { CategoryVariantTemplate, ProductVariantDimension, SKU } from '@/types';

type DraftValue = { id?: number; value: string };
type DraftDimension = { id?: number; name: string; values: DraftValue[] };
type PreviewSKU = { id: number; has_order_references: boolean };
type VariantPreview = {
  kept: unknown[];
  created: unknown[];
  deactivated: PreviewSKU[];
  deletable: PreviewSKU[];
};

interface Props {
  productId: number;
  dimensions: ProductVariantDimension[];
  skus: SKU[];
  suggestions: CategoryVariantTemplate[];
  onChanged: () => Promise<void> | void;
}

const normalize = (value: string) => value.trim().toLocaleLowerCase();

export default function VariantDimensionEditor({ productId, dimensions, skus, suggestions, onChanged }: Props) {
  const [hasVariants, setHasVariants] = useState(dimensions.length > 0);
  const [drafts, setDrafts] = useState<DraftDimension[]>([]);
  const [preview, setPreview] = useState<VariantPreview | null>(null);
  const [previewError, setPreviewError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setHasVariants(dimensions.length > 0);
    setDrafts(dimensions.map((dimension) => ({
      id: dimension.id,
      name: dimension.name,
      values: (dimension.values ?? []).map((value) => ({ id: value.id, value: value.value })),
    })));
  }, [dimensions]);

  const validationError = useMemo(() => {
    if (!hasVariants) return '';
    if (!drafts.length) return '请至少添加一个变体维度';
    if (drafts.length > 3) return '每个商品最多使用 3 个变体维度';
    const names = drafts.map((item) => normalize(item.name));
    if (names.some((name) => !name)) return '维度名称不能为空';
    if (new Set(names).size !== names.length) return '维度名称不能重复';
    for (const dimension of drafts) {
      const values = dimension.values.map((item) => normalize(item.value));
      if (!values.length || values.some((value) => !value)) return `“${dimension.name || '未命名维度'}”至少需要一个非空值`;
      if (new Set(values).size !== values.length) return `“${dimension.name}”中存在重复值`;
    }
    const combinations = drafts.reduce((total, dimension) => total * dimension.values.length, 1);
    return combinations > 100 ? `当前会生成 ${combinations} 个组合，超过 100 个上限` : '';
  }, [drafts, hasVariants]);

  const payloadDimensions = useMemo(() => hasVariants ? drafts.map((dimension, index) => ({
    id: dimension.id,
    name: dimension.name.trim(),
    sort_order: index,
    values: dimension.values.map((value) => ({ id: value.id, value: value.value.trim() })),
  })) : [], [drafts, hasVariants]);

  const combinationCount = hasVariants && drafts.length
    ? drafts.reduce((total, dimension) => total * Math.max(dimension.values.length, 1), 1)
    : 1;

  useEffect(() => {
    if (validationError) {
      setPreview(null);
      setPreviewError('');
      return;
    }
    const timer = window.setTimeout(async () => {
      try {
        const response = await apiClient.post<{ data: VariantPreview }>(`/admin/products/${productId}/variants/preview`, { dimensions: payloadDimensions });
        const result = response.data.data;
        setPreview({
          kept: result?.kept ?? [],
          created: result?.created ?? [],
          deactivated: result?.deactivated ?? [],
          deletable: result?.deletable ?? [],
        });
        setPreviewError('');
      } catch (error) {
        setPreview(null);
        setPreviewError(axios.isAxiosError<{ error?: { message?: string } }>(error) ? error.response?.data?.error?.message ?? '无法预览变体变更' : '无法预览变体变更');
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [payloadDimensions, productId, validationError]);

  const addDimension = (name = '') => {
    if (drafts.length >= 3) return;
    setHasVariants(true);
    setDrafts((current) => [...current, { name, values: [] }]);
  };

  const save = async (confirmDeleteIDs: number[] = []) => {
    if (validationError) return;
    setSaving(true);
    try {
      await apiClient.put(`/admin/products/${productId}/variants`, {
        dimensions: payloadDimensions,
        skus: [],
        confirm_delete_ids: confirmDeleteIDs,
      });
      await onChanged();
      message.success(hasVariants ? '变体维度已保存' : '已切换为无变体商品并创建默认 SKU');
    } catch {
      message.error('保存变体维度失败');
    } finally {
      setSaving(false);
    }
  };

  const requestSave = () => {
    const deletable = preview?.deletable ?? [];
    if (!deletable.length) {
      void save();
      return;
    }
    Modal.confirm({
      title: `将删除 ${deletable.length} 个不再使用的 SKU`,
      content: '这些 SKU 没有订单引用，确认后会永久删除；有订单引用的 SKU 只会停用。',
      okText: '确认并保存',
      okButtonProps: { danger: true },
      cancelText: '取消',
      onOk: () => save(deletable.map((item) => item.id)),
    });
  };

  const suggestionOptions = suggestions
    .filter((suggestion) => !drafts.some((dimension) => normalize(dimension.name) === normalize(suggestion.name)))
    .sort((a, b) => a.sort_order - b.sort_order);

  return (
    <div className="space-y-4">
      <div>
        <div className="mb-2 font-medium">此商品是否有不同选项？</div>
        <Radio.Group value={hasVariants} onChange={(event) => setHasVariants(event.target.value)} optionType="button" buttonStyle="solid">
          <Radio.Button value={false}>没有，仅一个默认 SKU</Radio.Button>
          <Radio.Button value>有，例如颜色或容量</Radio.Button>
        </Radio.Group>
      </div>

      {hasVariants && <>
        {suggestionOptions.length > 0 && <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-gray-500">分类建议：</span>
          {suggestionOptions.map((suggestion) => <Button key={suggestion.name} size="small" onClick={() => addDimension(suggestion.name)}>+ {suggestion.name}</Button>)}
        </div>}

        <div className="space-y-3">
          {drafts.map((dimension, dimensionIndex) => <Card key={dimension.id ?? `new-${dimensionIndex}`} size="small">
            <div className="grid gap-3 md:grid-cols-[220px_minmax(0,1fr)_auto]">
              <Input
                aria-label={`维度 ${dimensionIndex + 1} 名称`}
                placeholder="维度名称，如颜色"
                value={dimension.name}
                onChange={(event) => setDrafts((current) => current.map((item, index) => index === dimensionIndex ? { ...item, name: event.target.value } : item))}
              />
              <Select
                aria-label={`${dimension.name || `维度 ${dimensionIndex + 1}`}的值`}
                mode="tags"
                tokenSeparators={[',', '，']}
                placeholder="输入值后按回车，如黑色、白色"
                value={dimension.values.map((value) => value.value)}
                onChange={(values) => setDrafts((current) => current.map((item, index) => index === dimensionIndex ? {
                  ...item,
                  values: values.map((value) => item.values.find((old) => old.value === value) ?? { value }),
                } : item))}
                options={dimension.values.map((value) => ({ value: value.value }))}
              />
              <Button danger type="text" aria-label={`删除维度 ${dimension.name}`} icon={<DeleteOutlined />} onClick={() => setDrafts((current) => current.filter((_, index) => index !== dimensionIndex))} />
            </div>
          </Card>)}
        </div>
        <Button type="dashed" icon={<PlusOutlined />} disabled={drafts.length >= 3} onClick={() => addDimension()}>添加维度（{drafts.length}/3）</Button>
      </>}

      {validationError && <Alert type="error" showIcon message={validationError} />}
      {previewError && <Alert type="error" showIcon message={previewError} />}
      {!validationError && <div className="flex flex-wrap gap-2 text-sm">
        <Tag color="blue">组合 {combinationCount}</Tag>
        {preview && <>
          <Tag color="green">保留 {preview.kept.length}</Tag>
          <Tag color="blue">新增 {preview.created.length}</Tag>
          <Tag color="orange">停用 {preview.deactivated.length}</Tag>
          <Tag color="red">可删除 {preview.deletable.length}</Tag>
        </>}
        {!hasVariants && skus.length > 0 && <span className="text-gray-500">现有 SKU 将合并为一个默认组合。</span>}
      </div>}

      <Space><Button type="primary" loading={saving} disabled={Boolean(validationError || previewError || !preview)} onClick={requestSave}>保存变体维度</Button></Space>
    </div>
  );
}
