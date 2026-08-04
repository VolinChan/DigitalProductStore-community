'use client';

import { useMemo, useState } from 'react';
import { Alert, Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Select, Space, Switch, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import apiClient from '@/lib/api';
import ImageFallback from '@/components/ImageFallback';
import type { ProductImage, ProductMedia, SKU } from '@/types';
import { getProductImageOptions } from '@/lib/catalog';

type AttributeRow = { name: string; value: string };
type SKUFormValues = {
  sku_code: string;
  gtin?: string;
  price: number;
  inventory: number;
  image_url?: string;
  is_active: boolean;
  attributes: AttributeRow[];
  media_asset_ids?: number[];
};

interface SKUManagerProps {
  productId: number;
  skus: SKU[];
  dimensionManaged?: boolean;
  images: ProductImage[];
  media?: ProductMedia[];
  onChanged: () => Promise<void> | void;
  promotedSkuId?: number;
}

export default function SKUManager({ productId, skus, dimensionManaged = false, images, media = [], onChanged, promotedSkuId }: SKUManagerProps) {
  const [form] = Form.useForm<SKUFormValues>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SKU | null>(null);
  const [saving, setSaving] = useState(false);
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [selectedIds, setSelectedIds] = useState<React.Key[]>([]);
  const [batchOpen, setBatchOpen] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchPrice, setBatchPrice] = useState<number | null>(null);
  const [batchInventory, setBatchInventory] = useState<number | null>(null);
  const [batchStatus, setBatchStatus] = useState<boolean | undefined>();
  const [batchImage, setBatchImage] = useState<string | undefined>();
  const [undoSnapshot, setUndoSnapshot] = useState<Map<number, Partial<SKU>> | null>(null);
  const imageOptions = useMemo(() => getProductImageOptions({ images, media }), [images, media]);
  const canCreate = !dimensionManaged && skus.length === 0;

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ sku_code: '', gtin: '', price: 0, inventory: 0, image_url: '', is_active: true, attributes: [], media_asset_ids: [] });
    setOpen(true);
  };

  const openEdit = (sku: SKU) => {
    setEditing(sku);
    form.setFieldsValue({
      sku_code: sku.sku_code,
      gtin: sku.gtin ?? '',
      price: sku.price,
      inventory: sku.inventory,
      image_url: sku.image_url || '',
      is_active: sku.is_active,
      attributes: sku.attributes?.length ? sku.attributes.map(({ name, value }) => ({ name, value })) : [],
      media_asset_ids: [...(sku.media ?? [])].sort((a, b) => Number(b.is_primary) - Number(a.is_primary) || a.sort_order - b.sort_order).map((item) => item.media_asset_id),
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        sku_code: values.sku_code.trim(),
        gtin: values.gtin?.trim() || '',
        image_url: values.image_url || '',
        attributes: (values.attributes ?? []).filter((attribute) => attribute.name.trim() && attribute.value.trim()).map((attribute) => ({ name: attribute.name.trim(), value: attribute.value.trim() })),
      };
		const { media_asset_ids: mediaAssetIDs = [], ...skuPayload } = payload;
      setSaving(true);
      if (editing) {
        await apiClient.put(`/admin/skus/${editing.id}`, skuPayload);
		await apiClient.put(`/admin/skus/${editing.id}/media`, { media: mediaAssetIDs.map((mediaAssetID, index) => ({ media_asset_id: mediaAssetID, sort_order: index, is_primary: index === 0 })) });
      } else {
		const response = await apiClient.post<{ data: SKU }>(`/admin/products/${productId}/skus`, skuPayload);
		if (mediaAssetIDs.length) await apiClient.put(`/admin/skus/${response.data.data.id}/media`, { media: mediaAssetIDs.map((mediaAssetID, index) => ({ media_asset_id: mediaAssetID, sort_order: index, is_primary: index === 0 })) });
      }
      setOpen(false);
      if (editing) setRowErrors((current) => { const next = { ...current }; delete next[editing.id]; return next; });
      await onChanged();
      message.success(editing ? '销售变体已更新' : '销售变体已创建');
    } catch (error) {
      if (error instanceof Error && 'errorFields' in error) return;
      if (editing) setRowErrors((current) => ({ ...current, [editing.id]: '保存失败：请检查编码、GTIN 和属性组合是否重复' }));
      message.error('保存销售变体失败，请检查编码和属性组合是否重复');
    } finally {
      setSaving(false);
    }
  };

  const setPromoted = async (skuId: number | null) => {
	try {
		await apiClient.put(`/admin/products/${productId}/promoted-sku`, { sku_id: skuId });
		await onChanged();
		message.success(skuId ? '主推 SKU 已更新' : '已清除主推 SKU');
	} catch { message.error('主推 SKU 必须已启用且有库存'); }
  };

  const remove = async (skuId: number) => {
    try {
      await apiClient.delete(`/admin/skus/${skuId}`);
      await onChanged();
      message.success('销售变体已删除');
    } catch {
      message.error('删除失败，可能已有未完成订单引用此 SKU');
    }
  };

  const columns: ColumnsType<SKU> = [
    { title: '组合', dataIndex: 'attributes', key: 'combination', width: 230, fixed: 'left', render: (attributes: SKU['attributes']) => attributes?.length ? attributes.map((attribute) => <Tag key={`${attribute.name}:${attribute.value}`}>{attribute.value}</Tag>) : <Tag>默认</Tag> },
    { title: 'SKU 编码', dataIndex: 'sku_code', key: 'sku_code', width: 180, render: (value: string, sku) => <Space>{value}{sku.id === promotedSkuId && <Tag color="gold">主推</Tag>}</Space> },
    { title: 'GTIN', dataIndex: 'gtin', key: 'gtin', width: 145, render: (value?: string) => value || '-' },
    { title: '价格（CLP）', dataIndex: 'price', key: 'price', width: 150, render: (value: number) => new Intl.NumberFormat('es-CL', { maximumFractionDigits: 0 }).format(value) },
    { title: '库存', dataIndex: 'inventory', key: 'inventory', width: 80 },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80, render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag> },
    { title: '校验', key: 'validation', width: 220, render: (_, sku) => rowErrors[sku.id] ? <span className="text-red-600">{rowErrors[sku.id]}</span> : <span className="text-green-600">正常</span> },
    {
      title: '操作', key: 'actions', width: 96, fixed: 'right', render: (_, sku) => <Space size={2}>
        <Button type="text" size="small" aria-label="编辑销售变体" icon={<EditOutlined />} onClick={() => openEdit(sku)} />
		<Button type="text" size="small" disabled={!sku.is_active || sku.inventory <= 0} onClick={() => void setPromoted(sku.id === promotedSkuId ? null : sku.id)}>{sku.id === promotedSkuId ? '取消主推' : '主推'}</Button>
        {!dimensionManaged && <Popconfirm title="删除此销售变体？" onConfirm={() => void remove(sku.id)}><Button type="text" size="small" danger aria-label="删除销售变体" icon={<DeleteOutlined />} /></Popconfirm>}
      </Space>,
    },
  ];

  const normalizedQuery = query.trim().toLocaleLowerCase();
  const filteredSKUs = skus.filter((sku) => {
    if (status === 'active' && !sku.is_active) return false;
    if (status === 'inactive' && sku.is_active) return false;
    if (!normalizedQuery) return true;
    return [sku.sku_code, sku.gtin ?? '', ...(sku.attributes ?? []).flatMap((attribute) => [attribute.name, attribute.value])]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });

  const applyPatches = async (patches: Map<number, Partial<SKU>>, remember = true) => {
    if (!patches.size) return;
    setBatchSaving(true);
    const snapshot = new Map<number, Partial<SKU>>();
    const errors: Record<number, string> = {};
    await Promise.all([...patches.entries()].map(async ([id, patch]) => {
      const current = skus.find((sku) => sku.id === id);
      if (!current) return;
      snapshot.set(id, Object.fromEntries(Object.keys(patch).map((key) => [key, current[key as keyof SKU]])) as Partial<SKU>);
      try {
        await apiClient.put(`/admin/skus/${id}`, patch);
      } catch {
        errors[id] = '批量保存失败，请检查该行数据';
      }
    }));
    setRowErrors((current) => ({ ...current, ...errors }));
    if (remember && snapshot.size) setUndoSnapshot(snapshot);
    await onChanged();
    setBatchSaving(false);
    if (Object.keys(errors).length) message.warning(`${Object.keys(errors).length} 行保存失败，其余行已更新`);
    else message.success(`${patches.size} 个 SKU 已更新`);
  };

  const applyBatch = async () => {
    const patch: Partial<SKU> = {};
    if (batchPrice !== null) patch.price = batchPrice;
    if (batchInventory !== null) patch.inventory = batchInventory;
    if (batchStatus !== undefined) patch.is_active = batchStatus;
    if (batchImage !== undefined) patch.image_url = batchImage;
    if (!Object.keys(patch).length) {
      message.warning('请至少填写一个要批量修改的字段');
      return;
    }
    await applyPatches(new Map(selectedIds.map((id) => [Number(id), patch])));
    setBatchOpen(false);
  };

  const fillDown = () => {
    const selected = skus.filter((sku) => selectedIds.includes(sku.id));
    if (selected.length < 2) return message.warning('请按表格顺序至少选择两行');
    const source = selected[0];
    void applyPatches(new Map(selected.slice(1).map((sku) => [sku.id, { price: source.price, inventory: source.inventory, is_active: source.is_active, image_url: source.image_url ?? '' }])));
  };

  const copyPrevious = () => {
    const patches = new Map<number, Partial<SKU>>();
    skus.forEach((sku, index) => {
      if (!selectedIds.includes(sku.id) || index === 0) return;
      const previous = skus[index - 1];
      patches.set(sku.id, { price: previous.price, inventory: previous.inventory, is_active: previous.is_active, image_url: previous.image_url ?? '' });
    });
    if (!patches.size) return message.warning('请选择至少一个非首行 SKU');
    void applyPatches(patches);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-gray-500">销售属性用于区分顾客可选择的颜色、容量、长度等，并分别维护价格和库存。</p>
        {canCreate && <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加变体</Button>}
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Input.Search allowClear className="max-w-sm" placeholder="搜索组合、SKU 编码或 GTIN" value={query} onChange={(event) => setQuery(event.target.value)} />
        <Select value={status} onChange={setStatus} className="w-32" options={[{ value: 'all', label: '全部状态' }, { value: 'active', label: '启用' }, { value: 'inactive', label: '停用' }]} />
        <Button disabled={!selectedIds.length} onClick={() => setBatchOpen(true)}>统一填充（{selectedIds.length}）</Button>
        <Button disabled={selectedIds.length < 2 || batchSaving} onClick={fillDown}>向下填充</Button>
        <Button disabled={!selectedIds.length || batchSaving} onClick={copyPrevious}>复制上一行</Button>
        <Button disabled={!undoSnapshot || batchSaving} onClick={() => {
          if (!undoSnapshot) return;
          const snapshot = undoSnapshot;
          setUndoSnapshot(null);
          void applyPatches(snapshot, false);
        }}>撤销上次批量修改</Button>
      </div>
      {Object.keys(rowErrors).length > 0 && <Alert className="mb-3" type="error" showIcon message="部分 SKU 保存失败，请按行修正后重试" />}
      {skus.length ? <Table virtual rowSelection={{ selectedRowKeys: selectedIds, onChange: setSelectedIds, preserveSelectedRowKeys: true }} columns={columns} dataSource={filteredSKUs} rowKey="id" size="small" pagination={{ pageSize: 20, showSizeChanger: true, pageSizeOptions: [20, 50, 100], showTotal: (total) => `共 ${total} 个 SKU` }} scroll={{ x: 1150, y: 520 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加销售变体" />}

      <Modal title={`统一填充 ${selectedIds.length} 个 SKU`} open={batchOpen} onCancel={() => setBatchOpen(false)} onOk={() => void applyBatch()} confirmLoading={batchSaving} okText="应用" cancelText="取消">
        <div className="grid grid-cols-2 gap-3 pt-3">
          <div><div className="mb-1 text-sm">价格（CLP，留空不修改）</div><InputNumber min={0} precision={0} className="w-full" value={batchPrice} onChange={setBatchPrice} /></div>
          <div><div className="mb-1 text-sm">库存（留空不修改）</div><InputNumber min={0} precision={0} className="w-full" value={batchInventory} onChange={setBatchInventory} /></div>
          <div><div className="mb-1 text-sm">状态</div><Select allowClear placeholder="不修改" className="w-full" value={batchStatus} onChange={setBatchStatus} options={[{ value: true, label: '启用' }, { value: false, label: '停用' }]} /></div>
          <div><div className="mb-1 text-sm">图片</div><Select allowClear placeholder="不修改" className="w-full" value={batchImage} onChange={setBatchImage} options={[{ value: '', label: '使用商品主图' }, ...imageOptions.map((image, index) => ({ value: image.url, label: `商品图片 ${index + 1}` }))]} /></div>
        </div>
      </Modal>

      <Modal title={editing ? `编辑变体 ${editing.sku_code}` : '添加销售变体'} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} confirmLoading={saving} okText="保存" cancelText="取消" width={720} destroyOnHidden>
        <Form form={form} layout="vertical" className="pt-3">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <Form.Item name="sku_code" label="SKU 编码" rules={[{ required: true, whitespace: true, message: '请输入 SKU 编码' }]}><Input placeholder="例如 CABLE-BLACK-1M" /></Form.Item>
            <Form.Item name="gtin" label="GTIN" rules={[{ max: 14, message: 'GTIN 最多 14 位' }, { pattern: /^\d*$/, message: 'GTIN 只能包含数字' }]}><Input inputMode="numeric" placeholder="可选，最多 14 位" /></Form.Item>
            <Form.Item name="price" label="价格（CLP）" rules={[{ required: true, message: '请输入价格' }]}><InputNumber min={1} precision={0} className="w-full" /></Form.Item>
            <Form.Item name="inventory" label="库存" rules={[{ required: true, message: '请输入库存' }]}><InputNumber min={0} precision={0} className="w-full" /></Form.Item>
          </div>

		{dimensionManaged && <><div className="mb-2 flex items-center justify-between"><span className="font-medium">销售属性</span></div>
          <Form.List name="attributes">{(fields) => <>
            {fields.map(({ key, ...field }) => <div key={key} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Form.Item {...field} name={[field.name, 'name']} className="mb-0" rules={[{ required: true, whitespace: true, message: '请输入属性名' }]}><Input disabled={dimensionManaged} placeholder="属性名，如 color" /></Form.Item>
              <Form.Item {...field} name={[field.name, 'value']} className="mb-0" rules={[{ required: true, whitespace: true, message: '请输入属性值' }]}><Input disabled={dimensionManaged} placeholder="属性值，如 black" /></Form.Item>
			  <span />
            </div>)}
		  </>}</Form.List></>}

		<Form.Item name="media_asset_ids" label="SKU 图集（顺序中的第一张为主图）">
		  <Select mode="multiple" optionFilterProp="label" placeholder="未设置时回退到商品图库" options={(media ?? []).filter((item) => item.media_asset?.kind === 'image').map((item, index) => ({ value: item.media_asset_id, label: item.media_asset?.alt_text || `商品图片 ${index + 1}` }))} />
		</Form.Item>

          <Form.Item name="image_url" label="变体图片" className="mt-5">
            <Radio.Group className="w-full">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Radio.Button value="" className="sku-image-option text-center"><span>使用主图</span></Radio.Button>
                {imageOptions.map((image) => (
                  <Radio.Button key={image.id} value={image.url} className="sku-image-option overflow-hidden">
                    <span className="relative block h-full w-full">
                      <ImageFallback src={image.url} alt="变体图片选项" fill className="object-contain p-1" sizes="100px" />
                    </span>
                  </Radio.Button>
                ))}
              </div>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="is_active" label="状态" valuePropName="checked"><Switch checkedChildren="启用" unCheckedChildren="停用" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
