'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Form, Spin, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CreditCardOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import ShippingForm from '@/components/checkout/ShippingForm';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import OrderSummary from '@/components/checkout/OrderSummary';
import { useCartStore } from '@/store/useCartStore';
import { isBuyNowIntentValid, useCheckoutIntentStore } from '@/store/useCheckoutIntentStore';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import { getSKUImage } from '@/lib/catalog';
import type { CartItem, PaymentMethod, Product } from '@/types';

interface ProductDetailResponse { data: Product }

export default function CheckoutPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'buy_now' ? 'buy_now' : 'cart';
  const [form] = Form.useForm();
  const { items: cartItems, totalPrice: cartTotal, clearCart } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { buyNow, hydrated, clearBuyNow } = useCheckoutIntentStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('online');
  const [submitting, setSubmitting] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);
  const [buyNowLoading, setBuyNowLoading] = useState(mode === 'buy_now');
  const [buyNowInvalid, setBuyNowInvalid] = useState(false);
  const [buyNowSourceProductId, setBuyNowSourceProductId] = useState<number | undefined>(undefined);
  const trackedMode = useRef<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user) form.setFieldsValue({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '' });
  }, [form, isAuthenticated, user]);

  useEffect(() => {
    if (mode !== 'buy_now' || !hydrated) return;
    if (buyNow?.productId) setBuyNowSourceProductId(buyNow.productId);
    if (!isBuyNowIntentValid(buyNow)) {
      clearBuyNow();
      setBuyNowInvalid(true);
      setBuyNowLoading(false);
      return;
    }

    let active = true;
    apiClient.get<ProductDetailResponse>(`/products/${buyNow.productId}`)
      .then((response) => {
        const product = response.data.data;
        const sku = product.skus?.find((candidate) => candidate.id === buyNow.skuId && candidate.is_active);
        if (!sku || sku.inventory < buyNow.quantity) throw new Error('unavailable');
        if (active) setBuyNowItem({
          id: -sku.id,
          sku_id: sku.id,
          sku,
          sku_name: product.name,
          sku_code: sku.sku_code,
          image_url: getSKUImage(sku),
          attributes: sku.attributes,
          quantity: buyNow.quantity,
          unit_price: Number(sku.price),
          subtotal: Number(sku.price) * buyNow.quantity,
          available: true,
          max_quantity: sku.inventory,
        });
      })
      .catch(() => { if (active) { clearBuyNow(); setBuyNowInvalid(true); } })
      .finally(() => { if (active) setBuyNowLoading(false); });
    return () => { active = false; };
  }, [buyNow, clearBuyNow, hydrated, mode]);

  const checkoutItems = useMemo(() => mode === 'buy_now' ? (buyNowItem ? [buyNowItem] : []) : cartItems, [buyNowItem, cartItems, mode]);
  const totalPrice = useMemo(() => mode === 'buy_now' ? (buyNowItem?.subtotal || 0) : cartTotal, [buyNowItem, cartTotal, mode]);
  const sourceProductId = buyNow?.productId ?? buyNowSourceProductId;

  useEffect(() => {
    if (checkoutItems.length === 0 || trackedMode.current === mode) return;
    trackedMode.current = mode;
    apiClient.post('/analytics/track', {
      event_type: 'checkout_start',
      metadata: { mode, item_count: checkoutItems.length },
    }).catch(() => undefined);
  }, [checkoutItems.length, mode]);

  const handleSubmitOrder = async () => {
    try {
      const shippingInfo = await form.validateFields();
      if (checkoutItems.length === 0) return;
      setSubmitting(true);
      const response = await apiClient.post<{ data: { id: number; order_number: string; total_amount: number } }>('/orders', {
        guest_name: shippingInfo.full_name,
        guest_email: shippingInfo.email,
        guest_phone: shippingInfo.phone,
        shipping_address: shippingInfo.address,
        payment_method: paymentMethod,
        items: checkoutItems.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })),
      });
      const order = response.data.data;

      if (mode === 'cart') {
        clearCart().catch(() => message.warning(t('checkout.cartClearPending')));
      } else {
        clearBuyNow();
      }

      const destination = paymentMethod === 'online'
        ? `/${locale}/checkout/payment?order_id=${order.id}&order_number=${encodeURIComponent(order.order_number)}&method=online`
        : `/${locale}/checkout/payment?order_id=${order.id}&order_number=${encodeURIComponent(order.order_number)}&amount=${order.total_amount}&method=transfer`;
      router.push(destination);
    } catch (error: unknown) {
      if (error && typeof error === 'object' && 'errorFields' in error) return;
      const apiError = error as { response?: { data?: { error?: { message?: string } } } };
      message.error(apiError?.response?.data?.error?.message || t('checkout.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'buy_now' && (!hydrated || buyNowLoading)) return <CheckoutLoading />;

  if (buyNowInvalid) {
    const href = sourceProductId ? `/${locale}/products/${sourceProductId}` : `/${locale}/products`;
    return <main className="store-container"><div className="rounded-[22px] bg-white px-5 py-16 text-center"><h1 className="text-2xl font-black text-[var(--sf-ink)]">{t('checkout.buyNowExpired')}</h1><p className="mt-2 text-sm text-[var(--sf-muted)]">{t('checkout.buyNowExpiredDesc')}</p><Link href={href} className="sf-button-primary mt-6">{t('checkout.backToProduct')}</Link></div></main>;
  }

  if (checkoutItems.length === 0) {
    return <main className="store-container"><div className="rounded-[22px] bg-white px-5 py-16 text-center"><ShoppingCartOutlined className="text-4xl text-[var(--sf-accent)]" /><h1 className="mt-4 text-2xl font-black text-[var(--sf-ink)]">{t('checkout.emptyCart')}</h1><Link href={`/${locale}/products`} className="sf-button-primary mt-6">{t('checkout.goBrowse')}</Link></div></main>;
  }

  const backHref = mode === 'buy_now' && sourceProductId ? `/${locale}/products/${sourceProductId}` : `/${locale}/cart`;
  const backLabel = mode === 'buy_now' ? t('checkout.backToProduct') : t('checkout.backToCart');

  return (
    <main className="store-container">
      <header className="border-b border-[var(--sf-line)] pb-6">
        <Link href={backHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-bold text-[var(--sf-muted)] hover:text-[var(--sf-accent)]"><ArrowLeftOutlined />{backLabel}</Link>
        <h1 className="mt-3 text-3xl font-black text-[var(--sf-ink)] sm:text-4xl">{t('checkout.title')}</h1>
        <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-bold text-[var(--sf-muted)] sm:max-w-xl">
          <CheckoutStep icon={<ShoppingCartOutlined />} label={t('checkout.stepCart')} active />
          <CheckoutStep icon={<CheckCircleOutlined />} label={t('checkout.stepInfo')} active />
          <CheckoutStep icon={<CreditCardOutlined />} label={t('checkout.stepPayment')} />
        </div>
      </header>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-9">
          <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.shippingInfo')}</h2><div className="mt-5"><ShippingForm form={form} initialValues={isAuthenticated && user ? { full_name: user.full_name, email: user.email, phone: user.phone || '' } : undefined} /></div></section>
          <section className="border-t border-[var(--sf-line)] pt-8"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.paymentMethod')}</h2><div className="mt-5"><PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} /></div></section>
        </div>
        <aside className="lg:sticky lg:top-28 lg:h-fit"><div className="rounded-[22px] bg-white p-5 sm:p-6"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.orderSummary')}</h2><div className="mt-5"><OrderSummary items={checkoutItems} totalPrice={totalPrice} shippingFee={0} /></div><button type="button" onClick={handleSubmitOrder} disabled={submitting} className="sf-button-primary mt-6 w-full">{submitting ? t('checkout.submitting') : paymentMethod === 'online' ? t('checkout.submitAndPay') : t('checkout.submitOrder')}</button><p className="mt-3 text-center text-xs leading-5 text-[var(--sf-muted)]">{paymentMethod === 'online' ? t('checkout.submitOnline') : t('checkout.submitTransfer')}</p></div></aside>
      </div>
    </main>
  );
}

function CheckoutStep({ icon, label, active = false }: { icon: ReactNode; label: string; active?: boolean }) {
  return <div className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-[var(--sf-soft-blue)] text-[var(--sf-accent)]' : 'bg-[var(--sf-soft)] text-[var(--sf-muted)]'}`}>{icon}<span>{label}</span></div>;
}

function CheckoutLoading() {
  return <main className="store-container flex min-h-[400px] items-center justify-center"><Spin size="large" /></main>;
}
