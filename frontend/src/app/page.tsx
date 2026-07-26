'use client';

import React, { useEffect, useState } from 'react';
import { Spin, Empty, Typography } from 'antd';
import BannerCarousel from '@/components/home/BannerCarousel';
import AnnouncementBar from '@/components/home/AnnouncementBar';
import ProductCard from '@/components/product/ProductCard';
import { PageSkeleton } from '@/components/Skeleton';
import EmptyState from '@/components/EmptyState';
import apiClient from '@/lib/api';
import type { Product, Banner, Announcement } from '@/types';

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
 * Homepage — modern storefront entry point.
 * Displays announcement bar, hero banner carousel, category highlights,
 * and featured products grid.
 * Requirements: 5.1-5.6, 25.6-25.8, 26.5-26.7, 42.1-42.2
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
        // Errors handled per-request via allSettled
      } finally {
        setLoading(false);
      }
    }

    fetchHomeData();
  }, []);

  if (loading) {
    return (
      <main className="store-container" id="main-content">
        <div className="animate-fade-in-up">
          {/* Hero skeleton */}
          <div className="rounded-xl overflow-hidden mb-8">
            <PageSkeleton />
          </div>
          {/* Products skeleton */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="store-container" id="main-content">
      <div className="animate-fade-in-up space-y-8 sm:space-y-10">
        {/* Announcement bar */}
        {announcements.length > 0 && (
          <section aria-label="系统公告">
            <AnnouncementBar announcements={announcements} />
          </section>
        )}

        {/* Hero Banner Carousel */}
        {banners.length > 0 ? (
          <section aria-label="轮播图" className="rounded-xl overflow-hidden shadow-card hover:shadow-card-hover transition-shadow duration-300">
            <BannerCarousel banners={banners} />
          </section>
        ) : (
          /* Hero CTA when no banners */
          <section className="rounded-xl bg-gradient-to-br from-primary/5 via-accent/5 to-transparent p-8 sm:p-12 text-center border">
            <Title level={2} className="!mb-3 !text-h3 sm:!text-h2 font-bold tracking-tight">
              发现优质数码产品
            </Title>
            <p className="text-muted text-sm sm:text-base max-w-lg mx-auto mb-6">
              精选最新科技好物，从手机到电脑，从配件到外设，满足你的所有需求
            </p>
            <a href="/products">
              <button className="store-btn-primary !px-8 !py-3 !text-base">
                浏览商品
              </button>
            </a>
          </section>
        )}

        {/* Featured Products */}
        <section aria-label="精选商品">
          <div className="flex items-center justify-between mb-6">
            <Title level={3} className="!mb-0 store-section-title">
              精选商品
            </Title>
            <a href="/products">
              <span className="text-sm text-accent hover:underline cursor-pointer">查看全部 →</span>
            </a>
          </div>

          {products.length > 0 ? (
            <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-5">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <EmptyState
              title="暂无商品"
              description="商品即将上架，敬请期待"
            />
          )}
        </section>

        {/* Trust signals */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-6 border-t">
          {[
            { icon: '🛡️', title: '正品保障', desc: '100% 正品保证' },
            { icon: '🚚', title: '快速发货', desc: '下单后 24h 内发货' },
            { icon: '↩️', title: '无忧退换', desc: '7 天无理由退换' },
            { icon: '💬', title: '在线客服', desc: '全天候在线支持' },
          ].map((item) => (
            <div key={item.title} className="text-center p-4 rounded-xl bg-card border shadow-sm">
              <div className="text-2xl mb-2">{item.icon}</div>
              <p className="text-sm font-semibold text-foreground">{item.title}</p>
              <p className="text-xs text-muted mt-0.5">{item.desc}</p>
            </div>
          ))}
        </section>
      </div>
    </main>
  );
}

/** Single product card skeleton */
function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border bg-card p-3 shadow-sm">
      <div className="aspect-square w-full rounded-lg bg-gray-200 dark:bg-gray-700 animate-pulse" />
      <div className="mt-3 space-y-2">
        <div className="h-4 w-3/4 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-3 w-1/2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
        <div className="h-5 w-1/3 mt-2 rounded bg-gray-200 dark:bg-gray-700 animate-pulse" />
      </div>
    </div>
  );
}
