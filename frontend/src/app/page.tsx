'use client';

import React, { useEffect, useState } from 'react';
import { Spin, Empty, Typography } from 'antd';
import BannerCarousel from '@/components/home/BannerCarousel';
import AnnouncementBar from '@/components/home/AnnouncementBar';
import ProductCard from '@/components/product/ProductCard';
import apiClient from '@/lib/api';
import type { Product, Banner, Announcement, ApiResponse, PaginationMeta } from '@/types';

const { Title } = Typography;

interface ProductListResponse {
  data: {
    products: Product[];
    total: number;
    page: number;
    page_size: number;
  };
}

interface BannersResponse {
  data: { banners: Banner[] };
}

interface AnnouncementsResponse {
  data: { announcements: Announcement[] };
}

/**
 * Homepage component.
 * Displays banner carousel, announcements, and featured products grid.
 * Requirements: 5.1-5.6, 25.6-25.8, 26.5-26.7
 */
export default function Home() {
  const [banners, setBanners] = useState<Banner[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchHomeData() {
      setLoading(true);
      try {
        const [bannersRes, announcementsRes, productsRes] = await Promise.allSettled([
          apiClient.get<BannersResponse>('/banners'),
          apiClient.get<AnnouncementsResponse>('/announcements'),
          apiClient.get<ProductListResponse>('/products', {
            params: { page: 1, page_size: 12 },
          }),
        ]);

        if (bannersRes.status === 'fulfilled') {
          setBanners(bannersRes.value.data.data?.banners || []);
        }

        if (announcementsRes.status === 'fulfilled') {
          setAnnouncements(announcementsRes.value.data.data?.announcements || []);
        }

        if (productsRes.status === 'fulfilled') {
          setProducts(productsRes.value.data.data?.products || []);
        }
      } catch {
        // Errors are handled per-request via allSettled
      } finally {
        setLoading(false);
      }
    }

    fetchHomeData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spin size="large" tip="加载中..." />
      </div>
    );
  }

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
      {/* Announcements - high priority pinned to top (Requirement 26.5) */}
      {announcements.length > 0 && (
        <section className="mb-4 sm:mb-6" aria-label="系统公告">
          <AnnouncementBar announcements={announcements} />
        </section>
      )}

      {/* Banner Carousel (Requirement 25.6-25.8) */}
      {banners.length > 0 && (
        <section className="mb-6 sm:mb-8" aria-label="轮播图">
          <BannerCarousel banners={banners} />
        </section>
      )}

      {/* Featured Products Grid (Requirement 5.1, 5.5) */}
      <section aria-label="精选商品">
        <Title level={3} className="mb-4 sm:mb-6">
          精选商品
        </Title>

        {products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        ) : (
          <Empty
            description="暂无商品"
            className="py-12"
          />
        )}
      </section>
    </main>
  );
}
