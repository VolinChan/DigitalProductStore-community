'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  Table, Button, Space, Modal, Form, Input, InputNumber, Select,
  Switch, message, Popconfirm, Tag, Tabs, Image,
} from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ReloadOutlined } from '@ant-design/icons';
import apiClient from '@/lib/api';
import type { Product, Category, SKU } from '@/types';
import type { ColumnsType } from 'antd/es/table';

const { TextArea } = Input;
const { Option } = Select;

export default function AdminProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [skuModalOpen, setSkuModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [skus, setSkus] = useState<SKU[]>([]);
  const [form] = Form.useForm();
  const [skuForm] = Form.useForm();

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      // Admin uses the public products endpoint for listing; admin-only
      // endpoints are create/update/delete. Pass is_active=false so we
      // surface disabled products to administrators too.
      const res = await apiClient.get<{
        data: {
          products: Product[];
          total: number;
          page: number;
          page_size: number;
        };
      }>('/products', {
        params: { page, page_size: pageSize },
      });
      setProducts(res.data.data?.products || []);
      setTotal(res.data.data?.total || 0);
    } catch {
      message.error('获取商品列表失败');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiClient.get<{ data: { categories: Category[] } }>('/categories');
      setCategories(res.data.data?.categories || []);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, [fetchProducts, fetchCategories]);

  const handleCreate = () => {
    setEditingProduct(null);
    form.resetFields();
    setModalOpen(true);
  };

  const handleEdit = (record: Product) => {
    setEditingProduct(record);
    form.setFieldsValue({
      name: record.name,
      description: record.description,
      category_id: record.category_id,
      specifications: record.specifications,
      is_active: record.is_active,
    });
    setModalOpen(true);
  };

  const handleDelete = async (id: number) => {
    try {
      await apiClient.delete(`/admin/products/${id}`);
      message.success('删除成功');
      fetchProducts();
    } catch {
      message.error('删除失败，可能存在关联订单');
    }
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingProduct) {
        await apiClient.put(`/admin/products/${editingProduct.id}`, values);
        message.success('更新成功');
      } else {
        await apiClient.post('/admin/products', values);
        message.success('创建成功');
      }
      setModalOpen(false);
      fetchProducts();
    } catch {
      message.error('操作失败');
    }
  };

  const handleManageSKUs = async (product: Product) => {
    setSelectedProduct(product);
    try {
      const res = await apiClient.get<{ data: Product }>(`/products/${product.id}`);
      setSkus(res.data.data?.skus || []);
    } catch {
      setSkus([]);
    }
    setSkuModalOpen(true);
  };

  const handleAddSKU = async () => {
    try {
      const values = await skuForm.validateFields();
      await apiClient.post(`/admin/products/${selectedProduct?.id}/skus`, {
        ...values,
        attributes: values.attributes ? JSON.parse(values.attributes) : [],
      });
      message.success('SKU 创建成功');
      skuForm.resetFields();
      // Refresh SKUs
      const res = await apiClient.get(`/products/${selectedProduct?.id}`);
      setSkus(res.data.data?.skus || []);
    } catch {
      message.error('SKU 创建失败');
    }
  };

  const handleDeleteSKU = async (skuId: number) => {
    try {
      await apiClient.delete(`/admin/skus/${skuId}`);
      message.success('SKU 删除成功');
      const res = await apiClient.get(`/products/${selectedProduct?.id}`);
      setSkus(res.data.data?.skus || []);
    } catch {
      message.error('SKU 删除失败');
    }
  };

  const columns: ColumnsType<Product> = [
    { title: 'ID', dataIndex: 'id', key: 'id', width: 60 },
    { title: '商品名称', dataIndex: 'name', key: 'name', ellipsis: true },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (cat: Category) => cat?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'is_active',
      key: 'is_active',
      render: (active: boolean) => (
        <Tag color={active ? 'green' : 'red'}>{active ? '上架' : '下架'}</Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (val: string) => new Date(val).toLocaleDateString(),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Space>
          <Button size="small" icon={<EditOutlined />} onClick={() => handleEdit(record)}>
            编辑
          </Button>
          <Button size="small" onClick={() => handleManageSKUs(record)}>
            SKU
          </Button>
          <Popconfirm title="确定删除？" onConfirm={() => handleDelete(record.id)}>
            <Button size="small" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const skuColumns: ColumnsType<SKU> = [
    { title: 'SKU 编码', dataIndex: 'sku_code', key: 'sku_code' },
    { title: '价格', dataIndex: 'price', key: 'price', render: (v: number) => `¥${v}` },
    { title: '库存', dataIndex: 'inventory', key: 'inventory' },
    {
      title: '属性',
      dataIndex: 'attributes',
      key: 'attributes',
      render: (attrs: SKU['attributes']) =>
        attrs?.map((a) => `${a.name}: ${a.value}`).join(', ') || '-',
    },
    {
      title: '操作',
      key: 'actions',
      render: (_, record) => (
        <Popconfirm title="确定删除此 SKU？" onConfirm={() => handleDeleteSKU(record.id)}>
          <Button size="small" danger icon={<DeleteOutlined />} />
        </Popconfirm>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-semibold">商品管理</h2>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={fetchProducts}>
            刷新
          </Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={handleCreate}>
            新增商品
          </Button>
        </Space>
      </div>

      <Table
        columns={columns}
        dataSource={products}
        rowKey="id"
        loading={loading}
        pagination={{
          current: page,
          pageSize,
          total,
          onChange: (p) => setPage(p),
        }}
      />

      {/* Product Create/Edit Modal */}
      <Modal
        title={editingProduct ? '编辑商品' : '新增商品'}
        open={modalOpen}
        onOk={handleSubmit}
        onCancel={() => setModalOpen(false)}
        width={600}
      >
        <Form form={form} layout="vertical">
          <Form.Item name="name" label="商品名称" rules={[{ required: true, message: '请输入商品名称' }]}>
            <Input placeholder="请输入商品名称" />
          </Form.Item>
          <Form.Item name="category_id" label="分类" rules={[{ required: true, message: '请选择分类' }]}>
            <Select placeholder="请选择分类">
              {categories.map((cat) => (
                <Option key={cat.id} value={cat.id}>{cat.name}</Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item name="description" label="描述">
            <TextArea rows={3} placeholder="请输入商品描述" />
          </Form.Item>
          <Form.Item name="specifications" label="规格参数 (JSON)">
            <TextArea rows={3} placeholder='{"cpu": "M2", "ram": "16GB"}' />
          </Form.Item>
          <Form.Item name="is_active" label="上架状态" valuePropName="checked" initialValue={true}>
            <Switch checkedChildren="上架" unCheckedChildren="下架" />
          </Form.Item>
        </Form>
      </Modal>

      {/* SKU Management Modal */}
      <Modal
        title={`SKU 管理 - ${selectedProduct?.name || ''}`}
        open={skuModalOpen}
        onCancel={() => setSkuModalOpen(false)}
        footer={null}
        width={800}
      >
        <Table columns={skuColumns} dataSource={skus} rowKey="id" size="small" pagination={false} />
        <div className="mt-4 p-4 bg-gray-50 rounded">
          <h4 className="font-medium mb-2">添加 SKU</h4>
          <Form form={skuForm} layout="inline" className="flex flex-wrap gap-2">
            <Form.Item name="sku_code" rules={[{ required: true, message: '必填' }]}>
              <Input placeholder="SKU 编码" style={{ width: 120 }} />
            </Form.Item>
            <Form.Item name="price" rules={[{ required: true, message: '必填' }]}>
              <InputNumber placeholder="价格" min={0} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="inventory" rules={[{ required: true, message: '必填' }]}>
              <InputNumber placeholder="库存" min={0} style={{ width: 100 }} />
            </Form.Item>
            <Form.Item name="attributes">
              <Input placeholder='[{"name":"颜色","value":"黑色"}]' style={{ width: 220 }} />
            </Form.Item>
            <Button type="primary" onClick={handleAddSKU}>
              添加
            </Button>
          </Form>
        </div>
      </Modal>
    </div>
  );
}
