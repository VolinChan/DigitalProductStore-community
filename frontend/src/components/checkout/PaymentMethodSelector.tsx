'use client';

import { useTranslations } from 'next-intl';
import PaymentBrandMarks from '@/components/payment/PaymentBrandMarks';
import type { PaymentMethod } from '@/types';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  transferAvailable?: boolean;
  transferEnabled?: boolean;
  paymentOptionOrder?: string[];
  transferLoading?: boolean;
  onlineAvailable?: boolean;
  onlineProvider?: string;
  onlineProviders?: Array<{ code: string; display_name?: string; accepting_new: boolean; environment?: string }>;
  defaultPaymentOption?: string;
  onOnlineProviderChange?: (provider: string) => void;
}

export default function PaymentMethodSelector({ value, onChange, transferAvailable = true, transferEnabled = true, paymentOptionOrder, transferLoading = false, onlineAvailable = false, onlineProvider, onlineProviders = [], defaultPaymentOption, onOnlineProviderChange }: PaymentMethodSelectorProps) {
  const t = useTranslations();
  const providerCopy = (provider: { code: string; display_name?: string; environment?: string }) => {
    if (provider.code === 'webpay_plus' && provider.environment === 'integration') return { title: t('payment.webpayPlusTest'), description: t('payment.webpayPlusTestDesc'), warning: true };
    if (provider.code === 'webpay_plus') return { title: t('payment.webpayPlus'), description: t('payment.webpayPlusDesc') };
    if (provider.code === 'mercadopago') return { title: t('payment.mercadoPago'), description: t('payment.mercadoPagoDesc') };
    return { title: provider.display_name || t('payment.online'), description: t('payment.onlineDesc') };
  };
  const acceptingProviders = onlineProviders.filter((provider) => provider.accepting_new);
  const effectiveProviders = acceptingProviders.length > 0
    ? acceptingProviders
    : onlineAvailable && onlineProvider ? [{ code: onlineProvider, accepting_new: true }] : [];
  const options: Array<{ key: string; value: PaymentMethod; provider?: string; title: string; description: string; disabled?: boolean; warning?: boolean }> = [
    ...effectiveProviders.map((provider) => ({ key: `online:${provider.code}`, value: 'online' as PaymentMethod, provider: provider.code, ...providerCopy(provider) })),
    ...(transferEnabled ? [{ key: 'transfer', value: 'transfer' as PaymentMethod, title: t('payment.transfer'), description: transferLoading ? t('payment.transferChecking') : transferAvailable ? t('payment.transferDesc') : t('payment.transferUnavailable'), disabled: transferLoading || !transferAvailable }] : []),
  ];
  const orderedOptions = paymentOptionOrder
    ? [...options].sort((left, right) => {
      const rank = (code: string) => { const index = paymentOptionOrder.indexOf(code); return index < 0 ? paymentOptionOrder.length : index; };
      return rank(left.provider || left.value) - rank(right.provider || right.value);
    })
    : defaultPaymentOption
    ? [...options].sort((left, right) => Number((right.provider || right.value) === defaultPaymentOption) - Number((left.provider || left.value) === defaultPaymentOption))
    : options;
  return <fieldset><legend className="sr-only !w-px">{t('checkout.paymentMethod')}</legend><div className="grid gap-3 sm:grid-cols-2">{orderedOptions.map((option) => {
    const selected = option.value === 'online' ? value === 'online' && onlineProvider === option.provider : value === option.value;
    return <label key={option.key} aria-disabled={option.disabled} className={`relative flex min-h-32 flex-col items-start gap-3 rounded-[18px] border p-4 text-left transition focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--sf-accent)] focus-within:ring-offset-2 ${option.disabled ? 'cursor-not-allowed border-[var(--sf-line)] bg-[var(--sf-soft)] opacity-65' : 'cursor-pointer'} ${option.warning ? 'border-amber-500 bg-amber-50' : selected ? 'border-[var(--sf-accent)] bg-[var(--sf-soft-blue)] ring-1 ring-[var(--sf-accent)]/20' : option.disabled ? '' : 'border-[var(--sf-line)] bg-white hover:border-[var(--sf-accent)]/50'}`}><input type="radio" name="payment_method" value={option.key} aria-label={option.title} checked={selected} disabled={option.disabled} onChange={() => { if (option.provider) onOnlineProviderChange?.(option.provider); onChange(option.value); }} className={`absolute inset-0 z-10 h-full w-full opacity-0 ${option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} /><PaymentBrandMarks option={option.provider || 'transfer'} label={option.title} /><span><span className={`block text-sm font-black ${option.warning ? 'text-amber-900' : 'text-[var(--sf-ink)]'}`}>{option.title}</span><span className={`mt-1 block text-xs font-semibold leading-5 ${option.warning ? 'text-amber-800' : 'text-[var(--sf-muted)]'}`}>{option.description}</span></span></label>;
  })}</div></fieldset>;
}
