import Link from 'next/link';
import { supplierProfile, type LegalLocale } from '@/lib/legal/supplier';

export default function SupplierDisclosure({ locale, compact = false }: { locale: string; compact?: boolean }) {
  const language: LegalLocale = locale === 'en' ? 'en' : 'es-CL';
  return (
    <section aria-labelledby="supplier-disclosure-title" className={compact ? 'text-sm leading-6' : 'rounded-[18px] bg-[var(--sf-soft)] p-5 text-sm leading-6'}>
      <h2 id="supplier-disclosure-title" className="font-black">{language === 'es-CL' ? 'Identificación del proveedor' : 'Supplier identification'}</h2>
      <p className="mt-2"><strong>{supplierProfile.legalName}</strong> · RUT {supplierProfile.rut}</p>
      <p>{supplierProfile.principalAddress}</p>
      <p><a href={`mailto:${supplierProfile.supportEmail}`} className="underline">{supplierProfile.supportEmail}</a> · <a href={`tel:${supplierProfile.phoneHref}`} className="underline">{supplierProfile.phoneDisplay}</a></p>
      <p>{supplierProfile.serviceHours[language]}</p>
      {!compact && <><p className="mt-3 text-xs text-[var(--sf-muted)]">{supplierProfile.sourceNote[language]}</p><Link href={`/${locale}/legal/supplier`} className="mt-3 inline-block font-bold underline">{language === 'es-CL' ? 'Ver información completa' : 'View full information'}</Link></>}
    </section>
  );
}
