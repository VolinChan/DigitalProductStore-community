'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button, Card, Form, Input, Select, Space, Spin, Switch, message } from 'antd';
import { ArrowLeftOutlined, DeleteOutlined, PlusOutlined, SaveOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import type { Category, Product } from '@/types';
import ProductImageManager from '@/components/admin/ProductImageManager';
import SKUManager from '@/components/admin/SKUManager';

type SpecificationRow = { key: string; value: string };
type EditorValues = {
  name: string;
  category_id?: number;
  description?: string;
  specifications?: SpecificationRow[];
  is_active: boolean;
};

function readSpecifications(value: string): SpecificationRow[] {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') return [];
    return Object.entries(parsed as Record<string, unknown>).map(([key, item]) => ({ key, value: String(item ?? '') }));
  } catch {
    return [];
  }
}

function serializeSpecifications(rows: SpecificationRow[] = []) {
  const specification: Record<string, string> = {};
  for (const row of rows) {
    const key = row.key?.trim();
    const value = row.value?.trim();
    if (!key && !value) continue;
    if (!key) throw new Error('每条规格都需要参数名称');
    if (specification[key] !== undefined) throw new Error(`规格“${key}”重复`);
    specification[key] = value;
  }
  return JSON.stringify(specification);
}

export default function ProductEditor({ productId }: { productId?: number }) {
  const router = useRouter();
  const [form] = Form.useForm<EditorValues>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const title = productId ? '编辑商品' : '新建商品';
  const categoryOptions = useMemo(() => categories.map((category) => ({ value: category.id, label: category.name })), [categories]);

  const load = useCallback(async () => {
    try {
      const categoryRequest = apiClient.get<{ data: { categories: Category[] } }>('/admin/categories');
      const productRequest = productId ? apiClient.get<{ data: Product }>(`/admin/products/${productId}`) : undefined;
      const [categoryResponse, productResponse] = await Promise.all([categoryRequest, productRequest]);
      setCategories(categoryResponse.data.data?.categories ?? []);
      if (productResponse) {
        const product = productResponse.data.data;
        setProduct(product);
        form.setFieldsValue({
          name: product.name,
          category_id: product.category_id,
          description: product.description,
          specifications: readSpecifications(product.specifications),
          is_active: product.is_active,
        });
      } else {
        form.setFieldsValue({ is_active: false, specifications: [] });
      }
      setDirty(false);
    } catch {
      message.error('无法加载商品编辑数据');
    } finally {
      setLoading(false);
    }
  }, [form, productId]);

  const refreshProduct = useCallback(async () => {
    if (!productId) return;
    const response = await apiClient.get<{ data: Product }>(`/admin/products/${productId}`);
    setProduct(response.data.data);
  }, [productId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  const save = async (publish: boolean) => {
    try {
      const values = await form.validateFields();
      const payload = {
        name: values.name.trim(),
        category_id: values.category_id,
        description: values.description?.trim() ?? '',
        specifications: serializeSpecifications(values.specifications),
        // Compatibility model: an inactive product behaves as a draft.
        is_active: publish,
      };
      setSaving(true);
      if (productId) {
        await apiClient.put(`/admin/products/${productId}`, payload);
        await refreshProduct();
      } else {
        const response = await apiClient.post<{ data: Product }>('/admin/products', payload);
        router.replace(`/admin/products/${response.data.data.id}`);
      }
      form.setFieldValue('is_active', publish);
      setDirty(false);
      message.success(publish ? '商品已保存并上架' : '草稿已保存');
    } catch (error) {
      message.error(error instanceof Error ? error.message : '保存失败，请检查标记的字段');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Spin size="large" /></div>;

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <div><Button type="link" className="px-0" icon={<ArrowLeftOutlined />} onClick={() => router.push('/admin/products')}>返回商品列表</Button><h2 className="mb-0 text-xl font-semibold">{title}</h2></div>
        <Space>
          <Button loading={saving} onClick={() => void save(false)} icon={<SaveOutlined />}>保存草稿</Button>
          <Button type="primary" loading={saving} onClick={() => void save(true)}>保存并上架</Button>
        </Space>
      </div>
      <Form form={form} layout="vertical" onValuesChange={() => setDirty(true)}>
        <Card title="基本信息" className="mb-4">
          <Form.Item name="name" label="商品名称（西班牙语）" rules={[{ required: true, whitespace: true, message: '请输入商品名称' }]}><Input size="large" placeholder="例如：Cable USB-C trenzado" /></Form.Item>
          <Form.Item name="category_id" label="分类" rules={[{ required: true, message: '请选择分类' }]}><Select showSearch optionFilterProp="label" options={categoryOptions} placeholder="选择分类" /></Form.Item>
          <Form.Item name="description" label="商品描述"><Input.TextArea rows={7} placeholder="先使用纯文本描述；富媒体编辑器将在下一阶段接入。" /></Form.Item>
        </Card>
        <Card title="规格参数" className="mb-4" extra="保存时兼容转换为现有 JSON 数据">
          <Form.List name="specifications">{(fields, { add, remove }) => <>
            {fields.map((field) => <Space key={field.key} className="mb-2 flex w-full" align="baseline">
              <Form.Item {...field} name={[field.name, 'key']} rules={[{ required: true, whitespace: true, message: '参数名不能为空' }]} className="mb-0 flex-1"><Input placeholder="参数名，如 Conector" /></Form.Item>
              <Form.Item {...field} name={[field.name, 'value']} className="mb-0 flex-1"><Input placeholder="参数值，如 USB-C" /></Form.Item>
              <Button aria-label="删除规格" icon={<DeleteOutlined />} onClick={() => remove(field.name)} />
            </Space>)}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ key: '', value: '' })}>添加规格</Button>
          </>}</Form.List>
        </Card>
        {productId && product && (
          <Card title="商品图库" className="mb-4">
            <ProductImageManager productId={productId} images={product.images ?? []} onChanged={refreshProduct} />
          </Card>
        )}
        {productId && product && (
          <Card title="销售变体（SKU）" className="mb-4">
            <SKUManager productId={productId} skus={product.skus ?? []} images={product.images ?? []} onChanged={refreshProduct} />
          </Card>
        )}
        <Card title="发布设置">
          <Form.Item name="is_active" valuePropName="checked" className="mb-0"><Switch checkedChildren="已上架" unCheckedChildren="草稿" disabled /></Form.Item>
          <p className="mb-0 mt-2 text-sm text-gray-500">规格参数是所有变体共享的说明；销售变体用于分别维护顾客可选项、价格、库存和图片。</p>
        </Card>
      </Form>
    </div>
  );
}
