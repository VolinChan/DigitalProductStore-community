'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import apiClient from '@/lib/api';
import FooterBrandCard from './FooterBrandCard';

interface PaymentCapabilities {
  configured?: boolean;
  transfer_enabled?: boolean;
  providers?: Array<{ code: string; accepting_new: boolean }>;
}
interface TransferCapabilities { configured?: boolean; accounts?: unknown[] }

const brands = [
  { name: 'Mercado Pago', mark: 'mercadopago', src: '/payments/mercado-pago.svg', width: 24, height: 24 },
  { name: 'Visa', mark: 'visa', src: '/payments/visa.svg', width: 24, height: 24 },
  { name: 'Mastercard', mark: 'mastercard', src: '/payments/mastercard.svg', width: 64, height: 40 },
  { name: 'American Express', mark: 'amex', src: '/payments/american-express.svg', width: 24, height: 24 },
  { name: 'Banco Santander', mark: 'santander', src: '/payments/santander.svg', width: 24, height: 24 },
  { name: 'Webpay Plus', mark: 'webpay', src: '/payments/webpay-plus.svg', width: 150, height: 44 },
];

export default function FooterPaymentMarks() {
  const t = useTranslations();
  const [capabilities, setCapabilities] = useState<{ providers: string[]; transfer: boolean }>({ providers: [], transfer: false });
  useEffect(() => {
    const controller = new AbortController();
    void Promise.allSettled([
      apiClient.get<{ data: PaymentCapabilities }>('/store-config/online-payment', { signal: controller.signal }),
      apiClient.get<{ data: TransferCapabilities }>('/store-config/transfer-payment', { signal: controller.signal }),
    ]).then(([onlineResult, transferResult]) => {
      if (controller.signal.aborted) return;
      const online = onlineResult.status === 'fulfilled' ? onlineResult.value.data.data : undefined;
      const transfer = transferResult.status === 'fulfilled' ? transferResult.value.data.data : undefined;
      setCapabilities({
        providers: online?.configured === true && Array.isArray(online.providers)
          ? online.providers.filter((provider) => provider.accepting_new === true).map((provider) => provider.code) : [],
        transfer: typeof online?.configured === 'boolean' && online.transfer_enabled !== false
          && transfer?.configured === true && (!Array.isArray(transfer.accounts) || transfer.accounts.length > 0),
      });
    });
    return () => controller.abort();
  }, []);

  const hasMercadoPago = capabilities.providers.includes('mercadopago');
  const hasWebpay = capabilities.providers.includes('webpay_plus');
  const hasCardProvider = hasMercadoPago || capabilities.providers.includes('stripe');
  // Match existing checkout brand mappings; each network is rendered only once.
  const visible = brands.filter(({ mark }) => mark === 'mercadopago' ? hasMercadoPago
    : mark === 'santander' ? capabilities.transfer
      : mark === 'webpay' ? hasWebpay : mark === 'amex' ? hasCardProvider : hasCardProvider || hasWebpay);

  if (!visible.length) return null;
  return (
    <section aria-labelledby="footer-payments-title" className="sf-footer-payments">
      <h2 id="footer-payments-title" className="sf-footer-eyebrow">{t('layout.paymentMethods')}</h2>
      <ul className="sf-footer-payment-list" aria-label={t('layout.paymentMethods')}>
        {visible.map((brand) => (
          <li key={brand.mark} aria-label={brand.mark === 'santander' ? `${t('layout.bankTransfer')} · Banco Santander` : undefined}>
            <FooterBrandCard {...brand} variant={brand.mark === 'webpay' ? 'wide' : 'payment'} />
            {brand.mark === 'santander' && <span className="sr-only">{t('layout.bankTransfer')}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
