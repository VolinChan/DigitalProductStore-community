'use client';

import { useState } from 'react';
import { Button, Empty, Form, Input, InputNumber, Modal, Popconfirm, Radio, Space, Switch, Table, Tag, message } from 'antd';
import { DeleteOutlined, EditOutlined, PlusOutlined } from '@ant-design/icons';
import type { ColumnsType } from 'antd/es/table';
import apiClient from '@/lib/api';
import ImageFallback from '@/components/ImageFallback';
import type { ProductImage, SKU } from '@/types';

type AttributeRow = { name: string; value: string };
type SKUFormValues = {
  sku_code: string;
  price: number;
  inventory: number;
  image_url?: string;
  is_active: boolean;
  attributes: AttributeRow[];
};

interface SKUManagerProps {
  productId: number;
  skus: SKU[];
  images: ProductImage[];
  onChanged: () => Promise<void> | void;
}

export default function SKUManager({ productId, skus, images, onChanged }: SKUManagerProps) {
  const [form] = Form.useForm<SKUFormValues>();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<SKU | null>(null);
  const [saving, setSaving] = useState(false);

  const openCreate = () => {
    setEditing(null);
    form.setFieldsValue({ sku_code: '', price: 0, inventory: 0, image_url: '', is_active: true, attributes: [{ name: '', value: '' }] });
    setOpen(true);
  };

  const openEdit = (sku: SKU) => {
    setEditing(sku);
    form.setFieldsValue({
      sku_code: sku.sku_code,
      price: sku.price,
      inventory: sku.inventory,
      image_url: sku.image_url || '',
      is_active: sku.is_active,
      attributes: sku.attributes?.length ? sku.attributes.map(({ name, value }) => ({ name, value })) : [{ name: '', value: '' }],
    });
    setOpen(true);
  };

  const save = async () => {
    try {
      const values = await form.validateFields();
      const payload = {
        ...values,
        sku_code: values.sku_code.trim(),
        image_url: values.image_url || '',
        attributes: values.attributes.map((attribute) => ({ name: attribute.name.trim(), value: attribute.value.trim() })),
      };
      setSaving(true);
      if (editing) {
        await apiClient.put(`/admin/skus/${editing.id}`, payload);
      } else {
        await apiClient.post(`/admin/products/${productId}/skus`, payload);
      }
      setOpen(false);
      await onChanged();
      message.success(editing ? '销售变体已更新' : '销售变体已创建');
    } catch (error) {
      if (error instanceof Error && 'errorFields' in error) return;
      message.error('保存销售变体失败，请检查编码和属性组合是否重复');
    } finally {
      setSaving(false);
    }
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
    { title: 'SKU 编码', dataIndex: 'sku_code', key: 'sku_code' },
    { title: '价格', dataIndex: 'price', key: 'price', render: (value: number) => new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value) },
    { title: '库存', dataIndex: 'inventory', key: 'inventory', width: 80 },
    { title: '销售属性', dataIndex: 'attributes', key: 'attributes', render: (attributes: SKU['attributes']) => attributes?.length ? attributes.map((attribute) => <Tag key={`${attribute.name}:${attribute.value}`}>{attribute.name}: {attribute.value}</Tag>) : <span className="text-amber-600">待补充</span> },
    { title: '状态', dataIndex: 'is_active', key: 'is_active', width: 80, render: (active: boolean) => <Tag color={active ? 'green' : 'default'}>{active ? '启用' : '停用'}</Tag> },
    {
      title: '操作', key: 'actions', width: 96, render: (_, sku) => <Space size={2}>
        <Button type="text" size="small" aria-label="编辑销售变体" icon={<EditOutlined />} onClick={() => openEdit(sku)} />
        <Popconfirm title="删除此销售变体？" onConfirm={() => void remove(sku.id)}><Button type="text" size="small" danger aria-label="删除销售变体" icon={<DeleteOutlined />} /></Popconfirm>
      </Space>,
    },
  ];

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="m-0 text-sm text-gray-500">销售属性用于区分顾客可选择的颜色、容量、长度等，并分别维护价格和库存。</p>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>添加变体</Button>
      </div>
      {skus.length ? <Table columns={columns} dataSource={skus} rowKey="id" size="small" pagination={false} scroll={{ x: 760 }} /> : <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="尚未添加销售变体" />}

      <Modal title={editing ? `编辑变体 ${editing.sku_code}` : '添加销售变体'} open={open} onCancel={() => setOpen(false)} onOk={() => void save()} confirmLoading={saving} okText="保存" cancelText="取消" width={720} destroyOnHidden>
        <Form form={form} layout="vertical" className="pt-3">
          <div className="grid grid-cols-1 gap-x-4 sm:grid-cols-3">
            <Form.Item name="sku_code" label="SKU 编码" rules={[{ required: true, whitespace: true, message: '请输入 SKU 编码' }]}><Input placeholder="例如 CABLE-BLACK-1M" /></Form.Item>
            <Form.Item name="price" label="价格（CLP）" rules={[{ required: true, message: '请输入价格' }]}><InputNumber min={1} precision={0} className="w-full" /></Form.Item>
            <Form.Item name="inventory" label="库存" rules={[{ required: true, message: '请输入库存' }]}><InputNumber min={0} precision={0} className="w-full" /></Form.Item>
          </div>

          <div className="mb-2 flex items-center justify-between"><span className="font-medium">销售属性</span></div>
          <Form.List name="attributes">{(fields, { add, remove: removeAttribute }) => <>
            {fields.map((field) => <div key={field.key} className="mb-2 grid grid-cols-[1fr_1fr_auto] gap-2">
              <Form.Item {...field} name={[field.name, 'name']} className="mb-0" rules={[{ required: true, whitespace: true, message: '请输入属性名' }]}><Input placeholder="属性名，如 color" /></Form.Item>
              <Form.Item {...field} name={[field.name, 'value']} className="mb-0" rules={[{ required: true, whitespace: true, message: '请输入属性值' }]}><Input placeholder="属性值，如 black" /></Form.Item>
              <Button aria-label="删除销售属性" icon={<DeleteOutlined />} disabled={fields.length === 1} onClick={() => removeAttribute(field.name)} />
            </div>)}
            <Button type="dashed" icon={<PlusOutlined />} onClick={() => add({ name: '', value: '' })}>添加属性</Button>
          </>}</Form.List>

          <Form.Item name="image_url" label="变体图片" className="mt-5">
            <Radio.Group className="w-full">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                <Radio.Button value="" className="sku-image-option text-center"><span>使用主图</span></Radio.Button>
                {[...images].sort((a, b) => a.sort_order - b.sort_order).map((image) => (
                  <Radio.Button key={image.id} value={image.image_url} className="sku-image-option overflow-hidden">
                    <span className="relative block h-full w-full">
                      <ImageFallback src={image.image_url} alt="变体图片选项" fill className="object-contain p-1" sizes="100px" />
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
