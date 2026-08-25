'use client';

import type { ReactNode } from 'react';
import { BankOutlined, CreditCardOutlined } from '@ant-design/icons';
import { useTranslations } from 'next-intl';
import type { PaymentMethod } from '@/types';

interface PaymentMethodSelectorProps {
  value: PaymentMethod;
  onChange: (method: PaymentMethod) => void;
  transferAvailable?: boolean;
  transferLoading?: boolean;
  onlineAvailable?: boolean;
  onlineProvider?: string;
  onlineProviders?: Array<{ code: string; accepting_new: boolean; environment?: string }>;
  onOnlineProviderChange?: (provider: string) => void;
}

export default function PaymentMethodSelector({ value, onChange, transferAvailable = true, transferLoading = false, onlineAvailable = false, onlineProvider, onlineProviders = [], onOnlineProviderChange }: PaymentMethodSelectorProps) {
  const t = useTranslations();
  const providerCopy = (provider: { code: string; environment?: string }) => {
    if (provider.code === 'webpay_plus' && provider.environment === 'integration') return { title: t('payment.webpayPlusTest'), description: t('payment.webpayPlusTestDesc'), warning: true };
    if (provider.code === 'webpay_plus') return { title: t('payment.webpayPlus'), description: t('payment.webpayPlusDesc') };
    if (provider.code === 'mercadopago') return { title: t('payment.mercadoPago'), description: t('payment.mercadoPagoDesc') };
    return { title: t('payment.online'), description: t('payment.onlineDesc') };
  };
  const acceptingProviders = onlineProviders.filter((provider) => provider.accepting_new);
  const effectiveProviders = acceptingProviders.length > 0
    ? acceptingProviders
    : onlineAvailable && onlineProvider ? [{ code: onlineProvider, accepting_new: true }] : [];
  const options: Array<{ key: string; value: PaymentMethod; provider?: string; icon: ReactNode; title: string; description: string; disabled?: boolean; warning?: boolean }> = [
    ...effectiveProviders.map((provider) => ({ key: `online:${provider.code}`, value: 'online' as PaymentMethod, provider: provider.code, icon: <CreditCardOutlined />, ...providerCopy(provider) })),
    { key: 'transfer', value: 'transfer', icon: <BankOutlined />, title: t('payment.transfer'), description: transferLoading ? t('payment.transferChecking') : transferAvailable ? t('payment.transferDesc') : t('payment.transferUnavailable'), disabled: transferLoading || !transferAvailable },
  ];
  return <fieldset><legend className="sr-only">{t('checkout.paymentMethod')}</legend><div className="grid gap-3 sm:grid-cols-2">{options.map((option) => {
    const selected = option.value === 'online' ? value === 'online' && onlineProvider === option.provider : value === option.value;
    return <label key={option.key} aria-disabled={option.disabled} className={`relative flex min-h-28 items-start gap-3 rounded-[18px] border p-4 text-left transition focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--sf-accent)] focus-within:ring-offset-2 ${option.disabled ? 'cursor-not-allowed border-[var(--sf-line)] bg-[var(--sf-soft)] opacity-65' : 'cursor-pointer'} ${option.warning ? 'border-amber-500 bg-amber-50' : selected ? 'border-[var(--sf-accent)] bg-[var(--sf-soft-blue)] ring-1 ring-[var(--sf-accent)]/20' : option.disabled ? '' : 'border-[var(--sf-line)] bg-white hover:border-[var(--sf-accent)]/50'}`}><input type="radio" name="payment_method" value={option.key} checked={selected} disabled={option.disabled} onChange={() => { if (option.provider) onOnlineProviderChange?.(option.provider); onChange(option.value); }} className={`absolute inset-0 z-10 h-full w-full opacity-0 ${option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} /><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${option.warning ? 'bg-amber-100 text-amber-700' : option.value === 'online' ? 'bg-white text-[var(--sf-accent)]' : 'bg-[#e8f4ef] text-[var(--sf-success)]'}`}>{option.icon}</span><span><span className={`block text-sm font-black ${option.warning ? 'text-amber-900' : 'text-[var(--sf-ink)]'}`}>{option.title}</span><span className={`mt-1 block text-xs font-semibold leading-5 ${option.warning ? 'text-amber-800' : 'text-[var(--sf-muted)]'}`}>{option.description}</span></span></label>;
  })}</div></fieldset>;
}
