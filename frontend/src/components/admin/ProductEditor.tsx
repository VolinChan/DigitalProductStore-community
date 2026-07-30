'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { Anchor, Button, Form, Input, Modal, Progress, Select, Space, Spin, Tag, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CloseCircleOutlined, ExclamationCircleOutlined, EyeOutlined, SaveOutlined, UploadOutlined, WarningOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api';
import type { Category, CategorySpecTemplateField, Product, PublishIssue, PublishProductResult, PublishValidationReport } from '@/types';
import ProductImageManager from '@/components/admin/ProductImageManager';
import SKUManager from '@/components/admin/SKUManager';
import RichDescriptionEditor from '@/components/admin/RichDescriptionEditor';
import SpecificationEditor from '@/components/admin/SpecificationEditor';
import VariantDimensionEditor from '@/components/admin/VariantDimensionEditor';

type EditorValues = {
  name: string;
  slug: string;
  short_description?: string;
  category_id?: number;
  brand?: string;
  model?: string;
  condition?: 'new' | 'used' | 'refurbished';
  warranty_text?: string;
  description?: string;
};

const sections = [
  { key: 'basic', label: '基本信息' },
  { key: 'media', label: '媒体' },
  { key: 'specifications', label: '规格参数' },
  { key: 'variants', label: '变体与库存' },
  { key: 'description', label: '描述' },
  { key: 'publishing', label: '发布设置' },
] as const;

function slugify(value: string) {
  return value.trim().toLocaleLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

export default function ProductEditor({ productId }: { productId?: number }) {
  const router = useRouter();
  const [form] = Form.useForm<EditorValues>();
  const watched = Form.useWatch([], form);
  const [categories, setCategories] = useState<Category[]>([]);
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(Boolean(productId));
  const [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [publishReport, setPublishReport] = useState<PublishValidationReport | null>(null);

  const load = useCallback(async () => {
    try {
      const categoryRequest = apiClient.get<{ data: { categories: Category[] } }>('/admin/categories');
      const productRequest = productId ? apiClient.get<{ data: Product }>(`/admin/products/${productId}`) : undefined;
      const [categoryResponse, productResponse] = await Promise.all([categoryRequest, productRequest]);
      setCategories(categoryResponse.data.data?.categories ?? []);
      if (productResponse) {
        const loadedProduct = productResponse.data.data;
        setProduct(loadedProduct);
        form.setFieldsValue({
          name: loadedProduct.name,
          slug: loadedProduct.slug,
          short_description: loadedProduct.short_description,
          category_id: loadedProduct.category_id,
          brand: loadedProduct.brand,
          model: loadedProduct.model,
          condition: loadedProduct.condition ?? 'new',
          warranty_text: loadedProduct.warranty_text,
          description: loadedProduct.description,
        });
      } else {
        form.setFieldsValue({ condition: 'new' });
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
    setPublishReport(null);
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

  const completion = useMemo(() => {
    const values = watched as EditorValues | undefined;
    const completed = {
      basic: Boolean(values?.name?.trim() && values?.slug?.trim() && values?.category_id),
      media: Boolean(product?.media?.some((item) => item.is_primary)),
      specifications: Boolean(product?.structured_specifications?.length),
      variants: Boolean(product?.skus?.length),
      description: Boolean(values?.description?.trim()),
      publishing: Boolean(product?.status),
    };
    const count = Object.values(completed).filter(Boolean).length;
    return { sections: completed, count, percent: Math.round(count * 100 / sections.length) };
  }, [product, watched]);

  const selectedCategory = categories.find((category) => category.id === (watched as EditorValues | undefined)?.category_id);
  const selectedSpecificationTemplate = useMemo(() => {
    if (!selectedCategory) return [] as CategorySpecTemplateField[];
    const chain: Category[] = [];
    const seen = new Set<number>();
    let category: Category | undefined = selectedCategory;
    while (category && !seen.has(category.id)) {
      seen.add(category.id);
      chain.unshift(category);
      category = category.parent_id ? categories.find((item) => item.id === category?.parent_id) : undefined;
    }
    const merged = new Map<string, CategorySpecTemplateField>();
    chain.forEach((item) => item.spec_template?.forEach((field) => {
      merged.set(`${field.group || 'General'}\u0000${field.key}`, field);
    }));
    return [...merged.values()].sort((a, b) => a.sort_order - b.sort_order);
  }, [categories, selectedCategory]);

  const applyFieldErrors = (error: unknown) => {
    if (!axios.isAxiosError<{ error?: { errors?: Array<{ path: string; message: string }> } }>(error)) return false;
    const errors = error.response?.data?.error?.errors;
    if (!errors?.length) return false;
    const fieldMap: Record<string, keyof EditorValues> = {
      'basic.name': 'name', 'basic.slug': 'slug', name: 'name', slug: 'slug', category_id: 'category_id',
    };
    form.setFields(errors.map((item) => ({ name: fieldMap[item.path] ?? item.path, errors: [item.message] })));
    return true;
  };

  const handleVersionConflict = (error: unknown) => {
    if (!axios.isAxiosError<{ error?: { code?: string } }>(error) || error.response?.data?.error?.code !== 'CATALOG_VERSION_CONFLICT') return false;
    Modal.confirm({
      title: '商品已被其他会话修改',
      content: '重新加载最新数据后再保存。',
      okText: '重新加载',
      cancelText: '保留当前内容',
      onOk: () => void load(),
    });
    return true;
  };

  const persistEditorFields = async (lifecycle: 'draft' | 'preserve') => {
    const values = await form.validateFields();
    const payload = {
      version: product?.version,
      name: values.name.trim(),
      slug: values.slug.trim(),
      short_description: values.short_description?.trim() ?? '',
      category_id: values.category_id,
      brand: values.brand?.trim() ?? '',
      model: values.model?.trim() ?? '',
      condition: values.condition,
      warranty_text: values.warranty_text?.trim() ?? '',
      description: values.description?.trim() ?? '',
      specifications: productId ? undefined : '{}',
      ...(lifecycle === 'draft' ? { status: 'draft', is_active: false } : {}),
    };
    if (productId) {
      await apiClient.put(`/admin/products/${productId}`, payload);
      await refreshProduct();
      setDirty(false);
      return;
    }
    const response = await apiClient.post<{ data: Product }>('/admin/products', payload);
    setDirty(false);
    router.replace(`/admin/products/${response.data.data.id}`);
    return response.data.data;
  };

  const saveDraft = async () => {
    try {
      setSaving(true);
      await persistEditorFields('draft');
      message.success('草稿已保存');
    } catch (error) {
      if (!handleVersionConflict(error) && !applyFieldErrors(error)) {
        message.error(error instanceof Error ? error.message : '保存失败，请检查标记的字段');
      }
    } finally {
      setSaving(false);
    }
  };

  const applyPublishIssues = (report: PublishValidationReport) => {
    const fieldMap: Record<string, keyof EditorValues> = {
      'basic.name': 'name',
      'basic.category_id': 'category_id',
    };
    const fields = report.errors.flatMap((issue) => fieldMap[issue.path]
      ? [{ name: fieldMap[issue.path], errors: [issue.message] }]
      : []);
    if (fields.length) form.setFields(fields);
  };

  const extractPublishReport = (error: unknown) => {
    if (!axios.isAxiosError<{ data?: PublishValidationReport }>(error)) return null;
    return error.response?.data?.data ?? null;
  };

  const runPublishValidation = async () => {
    if (!productId) return null;
    try {
      setChecking(true);
      await persistEditorFields('preserve');
      const response = await apiClient.post<{ data: PublishValidationReport }>(`/admin/products/${productId}/validate`);
      const report = response.data.data;
      setPublishReport(report);
      applyPublishIssues(report);
      return report;
    } catch (error) {
      if (!handleVersionConflict(error) && !applyFieldErrors(error)) message.error('发布检查失败');
      return null;
    } finally {
      setChecking(false);
    }
  };

  const publishValidatedProduct = async (report: PublishValidationReport, confirmWarnings: boolean) => {
    if (!productId) return;
    try {
      setSaving(true);
      const response = await apiClient.post<{ data: PublishProductResult }>(`/admin/products/${productId}/publish`, {
        version: report.version,
        confirm_warnings: confirmWarnings,
      });
      await refreshProduct();
      setPublishReport(response.data.data.validation);
      message.success('商品已发布');
    } catch (error) {
      const nextReport = extractPublishReport(error);
      if (nextReport) {
        setPublishReport(nextReport);
        applyPublishIssues(nextReport);
        scrollTo('publishing');
      }
      if (!handleVersionConflict(error)) message.error(nextReport ? '商品仍有未解决的发布问题' : '发布失败');
    } finally {
      setSaving(false);
    }
  };

  const checkAndPublish = async () => {
    const report = await runPublishValidation();
    if (!report) return;
    if (!report.can_publish) {
      scrollTo('publishing');
      message.error(`发布前需修正 ${report.errors.length} 个问题`);
      return;
    }
    if (report.requires_confirmation) {
      scrollTo('publishing');
      Modal.confirm({
        title: `确认 ${report.warnings.length} 个发布警告`,
        content: '这些警告不会阻止发布，但可能影响商品质量或可购买性。',
        okText: '确认并发布',
        cancelText: '返回修改',
        onOk: () => publishValidatedProduct(report, true),
      });
      return;
    }
    await publishValidatedProduct(report, false);
  };

  const openPreview = async () => {
    if (!productId) return;
    const previewWindow = window.open('about:blank', '_blank');
    if (previewWindow) previewWindow.opener = null;
    try {
      setPreviewing(true);
      const response = await apiClient.get<{ data: { token: string; expires_at: string } }>(`/admin/products/${productId}/preview-token`);
      const previewURL = `/es-CL/products/${productId}?preview_token=${encodeURIComponent(response.data.data.token)}`;
      if (previewWindow) previewWindow.location.replace(previewURL);
      else window.location.assign(previewURL);
    } catch {
      previewWindow?.close();
      message.error('无法创建商品预览');
    } finally {
      setPreviewing(false);
    }
  };

  const scrollTo = (key: string) => document.getElementById(key)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const goToIssue = (issue: PublishIssue) => {
    scrollTo(issue.section);
    const fieldMap: Record<string, keyof EditorValues> = { 'basic.name': 'name', 'basic.category_id': 'category_id' };
    const field = fieldMap[issue.path];
    if (field) window.setTimeout(() => form.focusField(field), 350);
  };
  const leave = () => {
    if (!dirty || window.confirm('当前修改尚未保存，确定离开？')) router.push('/admin/products');
  };

  if (loading) return <div className="flex min-h-64 items-center justify-center"><Spin size="large" /></div>;

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3 border-b pb-4">
        <div><Button type="link" className="px-0" icon={<ArrowLeftOutlined />} onClick={leave}>返回商品列表</Button><h2 className="m-0 text-xl font-semibold">{productId ? '编辑商品' : '新建商品'}</h2></div>
        <Space>
          <Button loading={saving} onClick={() => void saveDraft()} icon={<SaveOutlined />}>{product?.status === 'archived' ? '恢复为草稿' : '保存草稿'}</Button>
          <Button disabled={!productId} loading={previewing} onClick={() => void openPreview()} icon={<EyeOutlined />}>预览</Button>
          <Button type="primary" disabled={!productId || product?.status === 'archived'} loading={saving || checking} onClick={() => void checkAndPublish()} icon={<UploadOutlined />}>检查并发布</Button>
        </Space>
      </div>

      <div className="mb-4 flex gap-1 overflow-x-auto lg:hidden">
        {sections.map((section) => <Button key={section.key} size="small" onClick={() => scrollTo(section.key)}>{section.label}</Button>)}
      </div>

      <div className="grid gap-6 lg:grid-cols-[150px_minmax(0,1fr)_210px]">
        <aside className="hidden lg:block"><Anchor affix offsetTop={88} items={sections.map((section) => ({ key: section.key, href: `#${section.key}`, title: section.label }))} /></aside>

        <Form form={form} layout="vertical" onValuesChange={(changed) => {
          setDirty(true);
          if (changed.name && !productId && !form.isFieldTouched('slug')) form.setFieldValue('slug', slugify(changed.name));
        }}>
          <section id="basic" className="scroll-mt-24 border-b pb-6">
            <h3 className="mb-4 text-base font-semibold">基本信息</h3>
            <Form.Item name="name" label="商品标题（es-CL）" rules={[{ required: true, whitespace: true, message: '请输入商品标题' }]}><Input size="large" placeholder="Cable USB-C trenzado" /></Form.Item>
            <div className="grid gap-x-4 sm:grid-cols-2">
              <Form.Item name="slug" label="Slug" rules={[{ required: true, pattern: /^[a-z0-9]+(?:-[a-z0-9]+)*$/, message: '请使用小写字母、数字和连字符' }]}><Input /></Form.Item>
              <Form.Item name="category_id" label="分类"><Select allowClear showSearch optionFilterProp="label" options={categories.map((category) => ({ value: category.id, label: category.name }))} /></Form.Item>
              <Form.Item name="brand" label="品牌"><Input /></Form.Item>
              <Form.Item name="model" label="型号"><Input /></Form.Item>
              <Form.Item name="condition" label="商品成色" rules={[{ required: true }]}><Select options={[{ value: 'new', label: '新品' }, { value: 'used', label: '二手' }, { value: 'refurbished', label: '翻新' }]} /></Form.Item>
              <Form.Item name="warranty_text" label="保修说明"><Input /></Form.Item>
            </div>
            <Form.Item name="short_description" label="简短卖点（es-CL）"><Input.TextArea rows={3} maxLength={500} showCount /></Form.Item>
          </section>

          <section id="media" className="scroll-mt-24 border-b py-6">
            <h3 className="mb-4 text-base font-semibold">媒体</h3>
            {productId && product ? <ProductImageManager productId={productId} media={product.media ?? []} onChanged={refreshProduct} /> : <span className="text-gray-400">-</span>}
          </section>

          <section id="specifications" className="scroll-mt-24 border-b py-6">
            <h3 className="mb-4 text-base font-semibold">规格参数</h3>
            {productId ? <SpecificationEditor productId={productId} template={selectedSpecificationTemplate} onChanged={refreshProduct} /> : <span className="text-gray-400">请先保存商品，再编辑结构化规格。</span>}
          </section>

          <section id="variants" className="scroll-mt-24 border-b py-6">
            <h3 className="mb-4 text-base font-semibold">变体与库存</h3>
            {productId && product ? <div className="space-y-6">
              <VariantDimensionEditor
                productId={productId}
                dimensions={product.variant_dimensions ?? []}
                skus={product.skus ?? []}
                suggestions={selectedCategory?.variant_template ?? product.category?.variant_template ?? []}
                onChanged={refreshProduct}
              />
              <div className="border-t pt-5"><SKUManager productId={productId} skus={product.skus ?? []} dimensionManaged={Boolean(product.variant_dimensions?.length)} images={product.images ?? []} media={product.media ?? []} onChanged={refreshProduct} /></div>
            </div> : <span className="text-gray-400">请先保存商品，再配置变体。</span>}
          </section>

          <section id="description" className="scroll-mt-24 border-b py-6">
            <h3 className="mb-4 text-base font-semibold">描述</h3>
            <Form.Item name="description" label="商品描述（es-CL）" className="mb-0"><RichDescriptionEditor /></Form.Item>
          </section>

          <section id="publishing" className="scroll-mt-24 py-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <h3 className="m-0 text-base font-semibold">发布设置</h3>
                <Tag color={product?.status === 'published' ? 'green' : product?.status === 'archived' ? 'orange' : 'default'}>{product?.status === 'published' ? '已发布' : product?.status === 'archived' ? '已归档' : '草稿'}</Tag>
              </div>
              <Button disabled={!productId || product?.status === 'archived'} loading={checking} onClick={() => void runPublishValidation()} icon={<CheckCircleOutlined />}>运行发布检查</Button>
            </div>
            {publishReport && <div className="border-y">
              <div className="flex flex-wrap items-center gap-4 border-b py-3 text-sm">
                <strong>{publishReport.can_publish ? '可以发布' : '暂不可发布'}</strong>
                <span className={publishReport.errors.length ? 'text-red-600' : 'text-gray-500'}><CloseCircleOutlined /> {publishReport.errors.length} 个错误</span>
                <span className={publishReport.warnings.length ? 'text-amber-700' : 'text-gray-500'}><WarningOutlined /> {publishReport.warnings.length} 个警告</span>
                <span className="ml-auto text-gray-500">完成度 {publishReport.completion.percent}%</span>
              </div>
              {[...publishReport.errors, ...publishReport.warnings].map((issue, index) => {
                const isError = index < publishReport.errors.length;
                return <button type="button" key={`${issue.code}-${issue.path}-${index}`} onClick={() => goToIssue(issue)} className="flex w-full items-start gap-3 border-b px-0 py-3 text-left last:border-b-0">
                  {isError ? <CloseCircleOutlined className="mt-0.5 text-red-600" /> : <ExclamationCircleOutlined className="mt-0.5 text-amber-700" />}
                  <span className="min-w-0"><span className="block text-sm font-medium">{issue.message}</span><span className="block break-all text-xs text-gray-500">{issue.path}</span></span>
                </button>;
              })}
            </div>}
          </section>
        </Form>

        <aside className="hidden lg:block">
          <div className="sticky top-20 border-l pl-5">
            <div className="mb-3 flex items-center justify-between"><strong>完成度</strong><span>{publishReport ? `${publishReport.completion.completed}/${publishReport.completion.total}` : `${completion.count}/${sections.length}`}</span></div>
            <Progress percent={publishReport?.completion.percent ?? completion.percent} size="small" status={publishReport?.errors.length ? 'exception' : 'normal'} />
            <div className="mt-4 space-y-2">
              {sections.map((section) => <button type="button" key={section.key} onClick={() => scrollTo(section.key)} className="flex w-full items-center justify-between bg-transparent p-0 text-left text-sm">
                <span>{section.label}</span>{publishReport?.sections[section.key]?.errors
                  ? <span className="text-red-600">{publishReport.sections[section.key].errors}</span>
                  : publishReport?.sections[section.key]?.warnings
                    ? <span className="text-amber-700">{publishReport.sections[section.key].warnings}</span>
                    : completion.sections[section.key] ? <CheckCircleOutlined className="text-green-600" /> : <span className="text-gray-400">-</span>}
              </button>)}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
