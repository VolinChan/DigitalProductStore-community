'use client';

import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Spin, Button, InputNumber, message, Tag, Divider, Typography, Breadcrumb } from 'antd';
import { ShoppingCartOutlined, HomeOutlined } from '@ant-design/icons';
import Link from 'next/link';
import apiClient from '@/lib/api';
import { useCartStore } from '@/store/useCartStore';
import ImageGallery from '@/components/product/ImageGallery';
import SKUSelector from '@/components/product/SKUSelector';
import type { Product, SKU } from '@/types';

const { Title, Paragraph, Text } = Typography;

interface ProductDetailResponse {
  data: Product;
}

/**
 * Product detail page.
 * Displays product information, SKU selector, and add to cart functionality.
 *
 * Requirements:
 * - 4.1: Display all available SKU attribute options
 * - 4.2: Allow selecting attribute values to identify a specific SKU
 * - 4.3: Display SKU-specific price, inventory status, and images
 * - 4.4: Disable add to cart and show "out of stock" when inventory is zero
 * - 4.5: Update price and images dynamically when SKU selection changes
 * - 28.4: Track product view events
 */
export default function ProductDetailPage() {
  const params = useParams();
  const productId = params.id as string;

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedAttributes, setSelectedAttributes] = useState<Record<string, string>>({});
  const [quantity, setQuantity] = useState(1);
  const [addingToCart, setAddingToCart] = useState(false);

  const addToCart = useCartStore((state) => state.addToCart);

  // Fetch product detail
  useEffect(() => {
    async function fetchProduct() {
      setLoading(true);
      setError(null);
      try {
        const response = await apiClient.get<ProductDetailResponse>(`/products/${productId}`);
        setProduct(response.data.data);
      } catch {
        setError('商品加载失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    }

    if (productId) {
      fetchProduct();
    }
  }, [productId]);

  // Track product view event (Requirement 28.4)
  useEffect(() => {
    if (!product) return;

    async function trackView() {
      try {
        await apiClient.post('/analytics/track', {
          event_type: 'product_view',
          product_id: product!.id,
          metadata: {
            product_name: product!.name,
            category_id: product!.category_id,
          },
        });
      } catch {
        // Silently fail - analytics should not block user experience
      }
    }

    trackView();
  }, [product]);

  // Find the selected SKU based on attribute selections
  const selectedSku = useMemo((): SKU | null => {
    if (!product?.skus || product.skus.length === 0) return null;

    const activeSKUs = product.skus.filter((sku) => sku.is_active);
    if (activeSKUs.length === 0) return null;

    // All attribute types must be selected to identify a specific SKU
    const attributeNames = new Set<string>();
    activeSKUs.forEach((sku) => {
      sku.attributes.forEach((attr) => attributeNames.add(attr.name));
    });

    // Check if all attributes are selected
    const allSelected = Array.from(attributeNames).every(
      (name) => selectedAttributes[name] && selectedAttributes[name] !== ''
    );
    if (!allSelected) return null;

    // Find the matching SKU
    return (
      activeSKUs.find((sku) =>
        sku.attributes.every(
          (attr) => selectedAttributes[attr.name] === attr.value
        )
      ) || null
    );
  }, [product, selectedAttributes]);

  // Display price: SKU-specific or range
  const displayPrice = useMemo(() => {
    if (selectedSku) {
      return { type: 'exact' as const, price: selectedSku.price };
    }

    if (!product?.skus || product.skus.length === 0) {
      return { type: 'none' as const, price: 0 };
    }

    const activeSKUs = product.skus.filter((sku) => sku.is_active);
    if (activeSKUs.length === 0) {
      return { type: 'none' as const, price: 0 };
    }

    const prices = activeSKUs.map((sku) => sku.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);

    if (min === max) {
      return { type: 'exact' as const, price: min };
    }

    return { type: 'range' as const, min, max };
  }, [product, selectedSku]);

  // Inventory status
  const inventoryStatus = useMemo(() => {
    if (!selectedSku) {
      // Check if all SKUs are out of stock
      if (product?.skus && product.skus.every((sku) => sku.inventory <= 0)) {
        return { available: false, count: 0, label: '已售罄' };
      }
      return { available: true, count: -1, label: '请选择规格' };
    }

    if (selectedSku.inventory <= 0) {
      return { available: false, count: 0, label: '已售罄' };
    }

    return {
      available: true,
      count: selectedSku.inventory,
      label: `有货 (库存: ${selectedSku.inventory})`,
    };
  }, [selectedSku, product]);

  // Handle attribute selection change
  const handleAttributeChange = useCallback((name: string, value: string) => {
    setSelectedAttributes((prev) => {
      const next = { ...prev };
      if (value === '') {
        delete next[name];
      } else {
        next[name] = value;
      }
      return next;
    });
    // Reset quantity when selection changes
    setQuantity(1);
  }, []);

  // Handle add to cart
  const handleAddToCart = async () => {
    if (!selectedSku) {
      message.warning('请先选择商品规格');
      return;
    }

    if (!inventoryStatus.available) {
      message.error('该商品已售罄');
      return;
    }

    if (quantity > selectedSku.inventory) {
      message.warning(`库存不足，最多可购买 ${selectedSku.inventory} 件`);
      return;
    }

    setAddingToCart(true);
    try {
      await addToCart(selectedSku, quantity);
      message.success('已加入购物车');
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : '加入购物车失败';
      message.error(errorMessage);
    } finally {
      setAddingToCart(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  // Error state
  if (error || !product) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="text-center py-16">
          <Text type="danger" className="text-lg">
            {error || '商品不存在'}
          </Text>
          <div className="mt-4">
            <Link href="/products">
              <Button type="primary">返回商品列表</Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const activeSKUs = product.skus?.filter((sku) => sku.is_active) || [];

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Breadcrumb */}
      <Breadcrumb
        className="mb-4"
        items={[
          { title: <Link href="/"><HomeOutlined /> 首页</Link> },
          { title: <Link href="/products">商品列表</Link> },
          { title: product.name },
        ]}
      />

      {/* Product Detail Layout */}
      <div className="flex flex-col lg:flex-row gap-6 lg:gap-10">
        {/* Left: Image Gallery */}
        <div className="w-full lg:w-1/2 lg:max-w-[500px]">
          <ImageGallery
            images={product.images || []}
            skuImageUrl={selectedSku?.image_url}
            productName={product.name}
          />
        </div>

        {/* Right: Product Info */}
        <div className="flex-1 min-w-0">
          {/* Product Name */}
          <Title level={2} className="!mb-2 !text-xl sm:!text-2xl">
            {product.name}
          </Title>

          {/* Category */}
          {product.category && (
            <Tag color="blue" className="mb-3">
              {product.category.name}
            </Tag>
          )}

          {/* Price Display (Requirement 4.3, 4.5) */}
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="flex items-baseline gap-1">
              <span className="text-sm text-gray-500">价格</span>
              {displayPrice.type === 'exact' && (
                <>
                  <span className="text-sm text-red-500 ml-2">¥</span>
                  <span className="text-2xl sm:text-3xl font-bold text-red-500">
                    {displayPrice.price.toFixed(2)}
                  </span>
                </>
              )}
              {displayPrice.type === 'range' && (
                <>
                  <span className="text-sm text-red-500 ml-2">¥</span>
                  <span className="text-2xl sm:text-3xl font-bold text-red-500">
                    {displayPrice.min.toFixed(2)}
                  </span>
                  <span className="text-sm text-gray-500 mx-1">~</span>
                  <span className="text-sm text-red-500">¥</span>
                  <span className="text-xl font-bold text-red-500">
                    {displayPrice.max.toFixed(2)}
                  </span>
                </>
              )}
              {displayPrice.type === 'none' && (
                <span className="text-gray-400 ml-2">暂无价格</span>
              )}
            </div>

            {/* Inventory Status */}
            <div className="mt-2">
              {inventoryStatus.available ? (
                <Text type="success" className="text-sm">
                  {inventoryStatus.label}
                </Text>
              ) : (
                <Text type="danger" className="text-sm font-medium">
                  {inventoryStatus.label}
                </Text>
              )}
            </div>
          </div>

          <Divider className="!my-4" />

          {/* SKU Selector (Requirements 4.1, 4.2) */}
          {activeSKUs.length > 0 && (
            <div className="mb-6">
              <SKUSelector
                skus={activeSKUs}
                selectedSku={selectedSku}
                selectedAttributes={selectedAttributes}
                onAttributeChange={handleAttributeChange}
              />
            </div>
          )}

          <Divider className="!my-4" />

          {/* Quantity Selector */}
          <div className="flex items-center gap-4 mb-6">
            <label className="text-sm font-medium text-gray-700">数量</label>
            <InputNumber
              min={1}
              max={selectedSku ? selectedSku.inventory : 99}
              value={quantity}
              onChange={(val) => setQuantity(val || 1)}
              disabled={!inventoryStatus.available || !selectedSku}
              className="w-32"
            />
            {selectedSku && selectedSku.inventory > 0 && (
              <Text type="secondary" className="text-xs">
                最多 {selectedSku.inventory} 件
              </Text>
            )}
          </div>

          {/* Add to Cart Button (Requirement 4.4) */}
          <div className="flex gap-3">
            <Button
              type="primary"
              size="large"
              icon={<ShoppingCartOutlined />}
              onClick={handleAddToCart}
              loading={addingToCart}
              disabled={!selectedSku || !inventoryStatus.available}
              className="min-w-[180px] h-12 text-base"
            >
              {!inventoryStatus.available && selectedSku
                ? '已售罄'
                : !selectedSku
                  ? '请选择规格'
                  : '加入购物车'}
            </Button>
          </div>

          {/* SKU Code */}
          {selectedSku && (
            <div className="mt-4">
              <Text type="secondary" className="text-xs">
                SKU: {selectedSku.sku_code}
              </Text>
            </div>
          )}
        </div>
      </div>

      {/* Product Description & Specifications */}
      <div className="mt-8 lg:mt-12">
        <Divider />

        {/* Description */}
        {product.description && (
          <section className="mb-8">
            <Title level={4} className="!mb-3">
              商品描述
            </Title>
            <Paragraph className="text-gray-600 whitespace-pre-wrap">
              {product.description}
            </Paragraph>
          </section>
        )}

        {/* Specifications */}
        {product.specifications && (
          <section>
            <Title level={4} className="!mb-3">
              商品规格
            </Title>
            <SpecificationsTable specifications={product.specifications} />
          </section>
        )}
      </div>
    </main>
  );
}

/**
 * Renders product specifications.
 * Specifications are stored as JSON string or plain text.
 */
function SpecificationsTable({ specifications }: { specifications: string }) {
  // Try to parse as JSON object
  try {
    const parsed = JSON.parse(specifications);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      if (entries.length > 0) {
        return (
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                {entries.map(([key, value], index) => (
                  <tr
                    key={key}
                    className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}
                  >
                    <td className="px-4 py-3 font-medium text-gray-700 w-1/3 border-r border-gray-200">
                      {key}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {String(value)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        );
      }
    }
  } catch {
    // Not valid JSON, render as plain text
  }

  // Fallback: render as plain text
  return (
    <Paragraph className="text-gray-600 whitespace-pre-wrap">
      {specifications}
    </Paragraph>
  );
}
