import Image from 'next/image';

export type PaymentOptionCode = 'mercadopago' | 'webpay_plus' | 'transfer' | 'stripe' | string;

interface PaymentBrandMarksProps {
  option: PaymentOptionCode;
  label: string;
  compact?: boolean;
  className?: string;
}

const cardBrands = [
  { src: '/payments/visa.svg', alt: 'Visa', width: 32, height: 20 },
  { src: '/payments/mastercard.svg', alt: 'Mastercard', width: 32, height: 20 },
  { src: '/payments/american-express.svg', alt: 'American Express', width: 24, height: 20 },
];

export default function PaymentBrandMarks({ option, label, compact = false, className = '' }: PaymentBrandMarksProps) {
  const cards = option === 'webpay_plus' ? cardBrands.slice(0, 2) : cardBrands;
  const primary = option === 'mercadopago'
    ? { src: '/payments/mercado-pago.svg', width: compact ? 30 : 38, height: compact ? 30 : 38 }
    : option === 'webpay_plus'
      ? { src: '/payments/webpay-plus.svg', width: compact ? 76 : 92, height: compact ? 24 : 30 }
      : option === 'transfer'
        ? { src: '/payments/bank-transfer.svg', width: compact ? 30 : 38, height: compact ? 30 : 38 }
        : { src: '/payments/credit-card.svg', width: compact ? 30 : 38, height: compact ? 30 : 38 };

  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <span className="inline-flex shrink-0 items-center justify-center rounded-md bg-white p-1 shadow-[inset_0_0_0_1px_rgba(15,35,55,0.09)]">
        <Image src={primary.src} alt={label} width={primary.width} height={primary.height} className="h-auto max-w-full" />
      </span>
      {option === 'transfer' ? (
        <span className="inline-flex items-center gap-1" role="group" aria-label={`${label} · Banco Santander · Mercado Pago`}>
          <span data-testid="santander-payment-mark" className="inline-flex h-6 w-6 items-center justify-center rounded bg-[#ec0000] p-1 shadow-[inset_0_0_0_1px_rgba(15,35,55,0.09)]">
            <Image src="/payments/santander.svg" alt="Banco Santander" width={compact ? 15 : 17} height={compact ? 15 : 17} className="h-auto w-auto" />
          </span>
          <span data-testid="mercado-pago-transfer-mark" className="inline-flex h-6 w-6 items-center justify-center rounded bg-white p-1 shadow-[inset_0_0_0_1px_rgba(15,35,55,0.09)]">
            <Image src="/payments/mercado-pago.svg" alt="Cuenta de transferencia Mercado Pago" width={compact ? 15 : 17} height={compact ? 15 : 17} className="h-auto w-auto" />
          </span>
          <span aria-hidden="true" className="rounded border border-emerald-700/20 bg-emerald-50 px-1.5 py-1 text-[9px] font-black leading-none text-emerald-800">CLP</span>
          <span aria-hidden="true" className="flex h-5 w-5 items-center justify-center rounded border border-emerald-700/20 bg-emerald-50 text-[11px] text-emerald-800">✓</span>
        </span>
      ) : (
        <span className="inline-flex items-center gap-1">
          {cards.map((card) => (
            <span key={card.alt} className="inline-flex h-6 items-center rounded bg-white px-1 shadow-[inset_0_0_0_1px_rgba(15,35,55,0.09)]">
              <Image src={card.src} alt={card.alt} width={compact ? Math.round(card.width * 0.8) : card.width} height={card.height} className="h-4 w-auto" />
            </span>
          ))}
        </span>
      )}
    </span>
  );
}
