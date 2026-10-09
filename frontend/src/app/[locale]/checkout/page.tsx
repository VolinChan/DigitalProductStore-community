'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Form, Spin, message } from 'antd';
import { ArrowLeftOutlined, CheckCircleOutlined, CreditCardOutlined, ShoppingCartOutlined } from '@ant-design/icons';
import { useRouter, useSearchParams } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import ShippingForm, { persistGuestAddress, type ShippingInfo } from '@/components/checkout/ShippingForm';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import FiscalDocumentSelector, { type FiscalDocumentIntent, type FiscalTaxFormValues } from '@/components/checkout/FiscalDocumentSelector';
import OrderSummary from '@/components/checkout/OrderSummary';
import { useCartStore } from '@/store/useCartStore';
import { isBuyNowIntentValid, useCheckoutIntentStore } from '@/store/useCheckoutIntentStore';
import { useAuthStore } from '@/store/useAuthStore';
import apiClient from '@/lib/api';
import SupplierDisclosure from '@/components/legal/SupplierDisclosure';
import legalDocuments from '@/lib/legal/documents.json';
import { getSKUImage } from '@/lib/catalog';
import type { Cart, CartItem, CheckoutValidation, Order, PaymentMethod, Product, ShippingQuote, TransferPaymentConfig } from '@/types';
import { getAnalyticsSessionID, trackStorefrontEvent } from '@/lib/legal/consent';

interface ProductDetailResponse { data: Product }
interface OnlinePaymentProvider { code: string; display_name?: string; display_name_key: string; redirect_method: string; accepting_new: boolean; environment?: string }
interface OnlinePaymentCapability { configured: boolean; transfer_enabled?: boolean; payment_option_order?: string[]; provider?: string; default_provider?: string; default_payment_option?: string; providers?: OnlinePaymentProvider[] }

const legacyTransferAvailable = Boolean(
  process.env.NEXT_PUBLIC_TRANSFER_BANK_NAME?.trim()
  && process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_NAME?.trim()
  && process.env.NEXT_PUBLIC_TRANSFER_ACCOUNT_NUMBER?.trim(),
);
const legacyOnlinePaymentAvailable = process.env.NEXT_PUBLIC_ONLINE_PAYMENT_ENABLED === 'true';

export default function CheckoutPage() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const searchParams = useSearchParams();
  const mode = searchParams.get('mode') === 'buy_now' ? 'buy_now' : 'cart';
  const [form] = Form.useForm();
  const { cart, items: cartItems, clearCart, hydrationStatus } = useCartStore();
  const { user, isAuthenticated } = useAuthStore();
  const { buyNow, hydrated, clearBuyNow } = useCheckoutIntentStore();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(legacyOnlinePaymentAvailable ? 'online' : 'transfer');
  const [fiscalDocumentIntent, setFiscalDocumentIntent] = useState<FiscalDocumentIntent>('boleta');
  const [onlinePaymentAvailable, setOnlinePaymentAvailable] = useState(legacyOnlinePaymentAvailable);
  const [onlinePaymentProvider, setOnlinePaymentProvider] = useState<string>(legacyOnlinePaymentAvailable ? 'stripe' : '');
  const [onlinePaymentProviders, setOnlinePaymentProviders] = useState<OnlinePaymentProvider[]>([]);
  const [defaultPaymentOption, setDefaultPaymentOption] = useState(legacyOnlinePaymentAvailable ? 'stripe' : 'transfer');
  const [transferAvailable, setTransferAvailable] = useState(false);
  const [transferEnabled, setTransferEnabled] = useState(true);
  const [paymentOptionOrder, setPaymentOptionOrder] = useState<string[]>();
  const [transferLoading, setTransferLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [buyNowItem, setBuyNowItem] = useState<CartItem | null>(null);
  const [buyNowLoading, setBuyNowLoading] = useState(mode === 'buy_now');
  const [buyNowInvalid, setBuyNowInvalid] = useState(false);
  const [buyNowSourceProductSlug, setBuyNowSourceProductSlug] = useState<string | undefined>(undefined);
  const [validation, setValidation] = useState<CheckoutValidation | null>(null);
  const [validationLoading, setValidationLoading] = useState(true);
  const [legalAccepted, setLegalAccepted] = useState(false);
  const trackedMode = useRef<string | null>(null);
	const [shippingQuote, setShippingQuote] = useState<ShippingQuote | null>(null);
	const [shippingQuoteLoading, setShippingQuoteLoading] = useState(false);
	const [shippingRestriction, setShippingRestriction] = useState('');
	const regionID = Form.useWatch('region_id', form);
	const communeID = Form.useWatch('commune_id', form);

  useEffect(() => {
    if (isAuthenticated && user) form.setFieldsValue({ full_name: user.full_name || '', email: user.email || '', phone: user.phone || '' });
  }, [form, isAuthenticated, user]);

  useEffect(() => {
    let active = true;
    void Promise.allSettled([
      apiClient.get<{ data: TransferPaymentConfig }>('/store-config/transfer-payment'),
      apiClient.get<{ data: OnlinePaymentCapability }>('/store-config/online-payment'),
    ]).then(([transferResult, onlineResult]) => {
      if (!active) return;
      const transferPayload = transferResult.status === 'fulfilled' ? transferResult.value.data.data : undefined;
      const transferConfig = typeof transferPayload?.configured === 'boolean' || Array.isArray(transferPayload?.accounts) ? transferPayload : undefined;
      const hasTransfer = transferConfig
        ? (Array.isArray(transferConfig.accounts) ? transferConfig.configured && transferConfig.accounts.length > 0 : transferConfig.configured === true || legacyTransferAvailable)
        : legacyTransferAvailable;
      const capabilityPayload = onlineResult.status === 'fulfilled' ? onlineResult.value.data.data : undefined;
      const capability = typeof capabilityPayload?.configured === 'boolean' ? capabilityPayload : undefined;
      const providers = capability && Array.isArray(capability.providers)
        ? capability.providers.filter((provider) => provider.accepting_new)
        : legacyOnlinePaymentAvailable ? [{ code: 'stripe', display_name_key: 'payment.online', redirect_method: 'GET', accepting_new: true }] : [];
      const hasOnline = capability ? capability.configured && providers.length > 0 : legacyOnlinePaymentAvailable;
      const requestedDefault = capability?.default_payment_option || capability?.default_provider || capability?.provider || providers[0]?.code || 'transfer';
      const requestedProvider = providers.find((provider) => provider.code === requestedDefault)?.code;
      const fallbackProvider = requestedProvider || providers[0]?.code || '';

      setTransferAvailable(hasTransfer && capability?.transfer_enabled !== false);
      setTransferEnabled(capability?.transfer_enabled !== false);
      setPaymentOptionOrder(capability?.payment_option_order);
      setOnlinePaymentAvailable(hasOnline);
      setOnlinePaymentProviders(providers);
      setOnlinePaymentProvider(fallbackProvider);
      if (requestedDefault === 'transfer' && hasTransfer && capability?.transfer_enabled !== false) {
        setDefaultPaymentOption('transfer');
        setPaymentMethod('transfer');
      } else if (hasOnline && fallbackProvider) {
        setDefaultPaymentOption(fallbackProvider);
        setPaymentMethod('online');
      } else {
        setDefaultPaymentOption('transfer');
        setPaymentMethod('transfer');
      }
    }).finally(() => { if (active) setTransferLoading(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (mode !== 'buy_now' || !hydrated) return;
    if (buyNow?.productId) setBuyNowSourceProductSlug(buyNow.productSlug || String(buyNow.productId));
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

  const inputItems = useMemo(() => mode === 'buy_now' ? (buyNowItem ? [buyNowItem] : []) : cartItems, [buyNowItem, cartItems, mode]);
  const validationInputKey = useMemo(() => inputItems.map((item) => `${item.sku_id}:${item.quantity}`).join('|'), [inputItems]);
  useEffect(() => {
    if (mode === 'cart' && hydrationStatus !== 'ready') return;
    if (inputItems.length === 0) { setValidation(null); setValidationLoading(false); return; }
    let active = true;
    setValidationLoading(true);
    void apiClient.post<{ data: CheckoutValidation }>('/checkout/validate', {
      mode, locale, cart_revision: mode === 'cart' ? cart?.revision : undefined,
      items: mode === 'buy_now' ? inputItems.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })) : undefined,
	  fiscal_document_intent: 'boleta',
    }).then((response) => { if (active) setValidation(response.data.data); })
      .catch(() => { if (active) setValidation(null); })
      .finally(() => { if (active) setValidationLoading(false); });
    return () => { active = false; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cart?.revision, hydrationStatus, locale, mode, validationInputKey]);
  const checkoutItems = useMemo(() => validation?.summary.items || [], [validation]);
  const totalPrice = validation?.summary.subtotal || 0;
  const sourceProductSlug = buyNow?.productSlug ?? buyNowSourceProductSlug;
	const quoteItemsKey = useMemo(() => checkoutItems.map((item) => `${item.sku_id}:${item.quantity}`).sort().join('|'), [checkoutItems]);

	useEffect(() => {
	  if (!regionID || !communeID || checkoutItems.length === 0) { setShippingQuote(null); setShippingRestriction(''); return; }
	  let active = true;
	  // A quote and its tax split are authoritative only for the exact current
	  // location and cart. Clear both immediately while the replacement quote
	  // is being resolved so the buyer never sees stale numeric amounts.
	  setShippingQuote(null);
	  setValidation((current) => current ? { ...current, tax: undefined } : current);
	  setShippingQuoteLoading(true);
	  const timer = window.setTimeout(() => {
	    setShippingRestriction('');
	    void apiClient.post('/shipping/quote', { region_id: regionID, commune_id: communeID, subtotal: Math.round(totalPrice), items: checkoutItems.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })) })
	      .then((response) => { const quote = response.data.data as ShippingQuote; if (active) setShippingQuote(quote?.quote_version ? quote : null); })
	      .catch((error) => { if (active) { setShippingQuote(null); setShippingRestriction(error?.response?.data?.error?.message || t('shipping.undeliverable')); } })
	      .finally(() => { if (active) setShippingQuoteLoading(false); });
	  }, 250);
	  return () => { active = false; window.clearTimeout(timer); };
	// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [regionID, communeID, quoteItemsKey, totalPrice]);

	useEffect(() => {
	  if (!shippingQuote || !regionID || !communeID || inputItems.length === 0) return;
	  let active = true;
	  setValidation((current) => current ? { ...current, tax: undefined } : current);
	  void apiClient.post<{ data: CheckoutValidation }>('/checkout/validate', {
		mode,
		locale,
		cart_revision: mode === 'cart' ? cart?.revision : undefined,
		items: mode === 'buy_now' ? inputItems.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })) : undefined,
		fiscal_document_intent: 'boleta',
		shipping_region_id: Number(regionID),
		shipping_commune_id: Number(communeID),
		shipping_quote_version: shippingQuote.quote_version,
		shipping_payable_amount: shippingQuote.payable_shipping,
	  }).then((response) => {
		if (active) setValidation(response.data.data);
	  }).catch(() => {
		// The numeric split stays cleared until a fresh authoritative validation
		// succeeds; the summary renders the conservative non-numeric tax copy.
	  });
	  return () => { active = false; };
	}, [cart?.revision, communeID, inputItems, locale, mode, regionID, shippingQuote]);

  useEffect(() => {
    if (checkoutItems.length === 0 || trackedMode.current === mode) return;
    trackedMode.current = mode;
    trackStorefrontEvent({
      event_type: 'checkout_start',
      metadata: { mode, item_count: checkoutItems.length },
    });
  }, [checkoutItems.length, mode]);

  const handleSubmitOrder = async () => {
    try {
      if (!legalAccepted) { message.warning(t('checkout.legalAcceptanceRequired')); return; }
      if (!(paymentMethod === 'transfer' ? transferAvailable : onlinePaymentAvailable)) { message.warning(t('checkout.paymentUnavailable')); return; }
      const shippingInfo = await form.validateFields() as ShippingInfo & FiscalTaxFormValues;
      if (checkoutItems.length === 0) return;
	  if (!shippingQuote) { message.warning(shippingRestriction || t('shipping.quoteRequired')); return; }
      setSubmitting(true);
	  const taxProfile = fiscalDocumentIntent === 'factura' ? {
		rut: shippingInfo.tax_rut,
		legal_name: shippingInfo.tax_legal_name,
		business_activity: shippingInfo.tax_business_activity,
		fiscal_address: shippingInfo.tax_fiscal_address,
		address_same_as_shipping: shippingInfo.tax_address_same_as_shipping === true,
		region_id: Number(shippingInfo.tax_region_id),
		commune_id: Number(shippingInfo.tax_commune_id),
		tax_email: shippingInfo.tax_email,
	  } : undefined;
	  // Refresh the authoritative validation after fiscal fields are final so
	  // the order consumes a server-bound cart + Boleta/Factura selection.
	  const validationResponse = await apiClient.post<{ data: CheckoutValidation }>('/checkout/validate', {
		mode,
		locale,
		cart_revision: mode === 'cart' ? cart?.revision : undefined,
		items: mode === 'buy_now' ? inputItems.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })) : undefined,
		fiscal_document_intent: fiscalDocumentIntent,
		tax_profile: taxProfile,
		shipping_region_id: Number(shippingInfo.region_id),
		shipping_commune_id: Number(shippingInfo.commune_id),
		shipping_quote_version: shippingQuote.quote_version,
		shipping_payable_amount: shippingQuote.payable_shipping,
	  });
	  const finalValidation = validationResponse.data.data;
	  if (!finalValidation.valid || !finalValidation.checkout_validation_id) {
		setValidation(finalValidation);
		message.warning(t('checkout.revalidationRequired'));
		return;
	  }
	  setValidation(finalValidation);
      const response = await apiClient.post<{ data: Order }>('/orders', {
		legal_accepted: legalAccepted,
		legal_version: legalDocuments.version,
		checkout_validation_id: finalValidation.checkout_validation_id,
		analytics_session_id: getAnalyticsSessionID() || undefined,
        guest_name: shippingInfo.full_name,
        guest_email: shippingInfo.email,
        guest_phone: shippingInfo.phone,
		address_source: shippingInfo.address_source || 'new',
		address_id: shippingInfo.address_source === 'existing' ? shippingInfo.address_id : undefined,
		address: shippingInfo.address_source === 'existing' ? undefined : { recipient: shippingInfo.full_name, phone: shippingInfo.phone, region_id: shippingInfo.region_id, commune_id: shippingInfo.commune_id, street: shippingInfo.street, street_number: shippingInfo.street_number, complement: shippingInfo.complement || '', reference: shippingInfo.reference || '' },
		shipping_quote_version: shippingQuote.quote_version,
		shipping_payable_amount: shippingQuote.payable_shipping,
		shipping_region_id: Number(shippingInfo.region_id),
		shipping_commune_id: Number(shippingInfo.commune_id),
        payment_method: paymentMethod,
        payment_provider: paymentMethod === 'online' ? onlinePaymentProvider : undefined,
        fiscal_document_intent: fiscalDocumentIntent,
		tax_profile: taxProfile,
        locale,
		items: finalValidation.summary.items.map((item) => ({ sku_id: item.sku_id, quantity: item.quantity })),
      });
      const order = response.data.data;
	  if (order.payment_access_token) {
		sessionStorage.setItem(`payment-access:${order.id}`, order.payment_access_token);
	  }
	  if (!isAuthenticated) persistGuestAddress(shippingInfo);

      if (paymentMethod === 'transfer') {
        sessionStorage.setItem(`transfer-accounts:${order.id}`, JSON.stringify(order.transfer_account_snapshot || []));
		sessionStorage.setItem(`transfer-email:${order.id}`, shippingInfo.email);
      }

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
		const apiError = error as { response?: { data?: { error?: { code?: string; message?: string }; data?: { quote?: ShippingQuote; summary?: Cart; tax?: CheckoutValidation['tax'] }; quote?: ShippingQuote } } };
	  if (apiError?.response?.data?.error?.code === 'CHECKOUT_REVALIDATION_REQUIRED') {
		const summary = apiError.response.data.data?.summary;
		if (summary) setValidation((current) => current ? { ...current, valid: (summary.issues || []).length === 0, summary, tax: apiError.response?.data?.data?.tax } : current);
		message.warning(t('checkout.revalidationRequired'));
		return;
	  }
	  if (apiError?.response?.data?.error?.code === 'SHIPPING_QUOTE_STALE') {
		const quote = apiError.response.data.data?.quote || apiError.response.data.quote;
		if (quote) setShippingQuote(quote);
		message.warning(t('shipping.quoteChanged'));
		return;
	  }
      message.error(apiError?.response?.data?.error?.message || t('checkout.createFailed'));
    } finally {
      setSubmitting(false);
    }
  };

  if ((mode === 'buy_now' && (!hydrated || buyNowLoading)) || validationLoading) return <CheckoutLoading />;

  if (buyNowInvalid) {
    const href = sourceProductSlug ? `/${locale}/products/${encodeURIComponent(sourceProductSlug)}` : `/${locale}/products`;
    return <main className="store-container"><div className="rounded-[22px] bg-white px-5 py-16 text-center"><h1 className="text-2xl font-black text-[var(--sf-ink)]">{t('checkout.buyNowExpired')}</h1><p className="mt-2 text-sm text-[var(--sf-muted)]">{t('checkout.buyNowExpiredDesc')}</p><Link href={href} className="sf-button-primary mt-6">{t('checkout.backToProduct')}</Link></div></main>;
  }

  if (!validation?.valid || checkoutItems.length === 0) {
    return <main className="store-container"><div className="rounded-[22px] bg-white px-5 py-16 text-center"><ShoppingCartOutlined className="text-4xl text-[var(--sf-accent)]" /><h1 className="mt-4 text-2xl font-black text-[var(--sf-ink)]">{t('checkout.emptyCart')}</h1><Link href={`/${locale}/products`} className="sf-button-primary mt-6">{t('checkout.goBrowse')}</Link></div></main>;
  }

  const backHref = mode === 'buy_now' && sourceProductSlug ? `/${locale}/products/${encodeURIComponent(sourceProductSlug)}` : `/${locale}/cart`;
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

      <Form form={form} layout="vertical" initialValues={{ address_source: 'new', tax_address_same_as_shipping: true }} requiredMark={false} className="sf-checkout-form mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-9">
          <section><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.shippingInfo')}</h2><div className="mt-5"><ShippingForm form={form} authenticated={isAuthenticated} /></div>{shippingQuoteLoading && <p className="text-sm text-[var(--sf-muted)]">{t('shipping.quoting')}</p>}{shippingRestriction && <p role="alert" className="text-sm font-bold text-[#a33a32]">{shippingRestriction}</p>}</section>
          <section className="border-t border-[var(--sf-line)] pt-8"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.paymentMethod')}</h2><div className="mt-5"><PaymentMethodSelector value={paymentMethod} onChange={setPaymentMethod} transferAvailable={transferAvailable} transferEnabled={transferEnabled} paymentOptionOrder={paymentOptionOrder} transferLoading={transferLoading} onlineAvailable={onlinePaymentAvailable} onlineProvider={onlinePaymentProvider} onlineProviders={onlinePaymentProviders} defaultPaymentOption={defaultPaymentOption} onOnlineProviderChange={setOnlinePaymentProvider} /></div></section>
          <section className="border-t border-[var(--sf-line)] pt-8"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.fiscal.title')}</h2><div className="mt-5"><FiscalDocumentSelector form={form} value={fiscalDocumentIntent} onChange={(next) => { setFiscalDocumentIntent(next); if (next === 'factura' && form.getFieldValue('tax_address_same_as_shipping') === undefined) form.setFieldValue('tax_address_same_as_shipping', true); }} /></div></section>
          <section className="border-t border-[var(--sf-line)] pt-8"><SupplierDisclosure locale={locale} /><label className="mt-5 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--sf-line)] bg-white p-4 text-sm leading-6"><input type="checkbox" checked={legalAccepted} onChange={(event) => setLegalAccepted(event.target.checked)} className="mt-1 h-4 w-4" /><span>{t.rich('checkout.legalAcceptance', { terms: (chunks) => <Link className="font-bold underline" href={`/${locale}/legal/terms`} target="_blank">{chunks}</Link>, returns: (chunks) => <Link className="font-bold underline" href={`/${locale}/legal/returns-withdrawal`} target="_blank">{chunks}</Link> })}</span></label></section>
        </div>
        <aside className="lg:sticky lg:top-28 lg:h-fit"><div className="rounded-[22px] bg-white p-5 sm:p-6"><h2 className="text-xl font-black text-[var(--sf-ink)]">{t('checkout.orderSummary')}</h2><div className="mt-5"><OrderSummary items={checkoutItems} totalPrice={totalPrice} shippingQuote={shippingQuote} tax={validation?.tax} /></div><button type="button" onClick={handleSubmitOrder} disabled={submitting || shippingQuoteLoading || !shippingQuote || !legalAccepted || !(paymentMethod === 'transfer' ? transferAvailable : onlinePaymentAvailable)} className="sf-button-primary mt-6 w-full">{submitting ? t('checkout.submitting') : paymentMethod === 'online' ? t('checkout.submitAndPay') : t('checkout.submitOrder')}</button><p className="mt-3 text-center text-xs leading-5 text-[var(--sf-muted)]">{paymentMethod === 'online' ? t('checkout.submitOnline') : t('checkout.submitTransfer')}</p></div></aside>
      </Form>
    </main>
  );
}

function CheckoutStep({ icon, label, active = false }: { icon: ReactNode; label: string; active?: boolean }) {
  return <div className={`flex min-h-11 items-center justify-center gap-1.5 rounded-xl ${active ? 'bg-[var(--sf-soft-blue)] text-[var(--sf-accent)]' : 'bg-[var(--sf-soft)] text-[var(--sf-muted)]'}`}>{icon}<span>{label}</span></div>;
}

function CheckoutLoading() {
  return <main className="store-container flex min-h-[400px] items-center justify-center"><Spin size="large" /></main>;
}
