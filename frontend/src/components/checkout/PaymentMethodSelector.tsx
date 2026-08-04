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
}

export default function PaymentMethodSelector({ value, onChange, transferAvailable = true, transferLoading = false, onlineAvailable = false }: PaymentMethodSelectorProps) {
  const t = useTranslations();
  const options: Array<{ value: PaymentMethod; icon: ReactNode; title: string; description: string; disabled?: boolean }> = [
    ...(onlineAvailable ? [{ value: 'online' as PaymentMethod, icon: <CreditCardOutlined />, title: t('payment.online'), description: t('payment.onlineDesc') }] : []),
    { value: 'transfer', icon: <BankOutlined />, title: t('payment.transfer'), description: transferLoading ? t('payment.transferChecking') : transferAvailable ? t('payment.transferDesc') : t('payment.transferUnavailable'), disabled: transferLoading || !transferAvailable },
  ];
  return <fieldset><legend className="sr-only">{t('checkout.paymentMethod')}</legend><div className="grid gap-3 sm:grid-cols-2">{options.map((option) => <label key={option.value} aria-disabled={option.disabled} className={`relative flex min-h-28 items-start gap-3 rounded-[18px] border p-4 text-left transition focus-within:outline-none focus-within:ring-2 focus-within:ring-[var(--sf-accent)] focus-within:ring-offset-2 ${option.disabled ? 'cursor-not-allowed border-[var(--sf-line)] bg-[var(--sf-soft)] opacity-65' : 'cursor-pointer'} ${value === option.value ? 'border-[var(--sf-accent)] bg-[var(--sf-soft-blue)] ring-1 ring-[var(--sf-accent)]/20' : option.disabled ? '' : 'border-[var(--sf-line)] bg-white hover:border-[var(--sf-accent)]/50'}`}><input type="radio" name="payment_method" value={option.value} checked={value === option.value} disabled={option.disabled} onChange={() => onChange(option.value)} className={`absolute inset-0 z-10 h-full w-full opacity-0 ${option.disabled ? 'cursor-not-allowed' : 'cursor-pointer'}`} /><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xl ${option.value === 'online' ? 'bg-white text-[var(--sf-accent)]' : 'bg-[#e8f4ef] text-[var(--sf-success)]'}`}>{option.icon}</span><span><span className="block text-sm font-black text-[var(--sf-ink)]">{option.title}</span><span className="mt-1 block text-xs leading-5 text-[var(--sf-muted)]">{option.description}</span></span></label>)}</div></fieldset>;
}
