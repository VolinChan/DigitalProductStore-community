import Link from 'next/link';
import { supplierProfile, type LegalLocale } from '@/lib/legal/supplier';

export default function SupplierDisclosure({ locale, compact = false, showPhone = true, showHours = true, legalOverview = false, headingId = 'supplier-disclosure-title' }: { locale: string; compact?: boolean; showPhone?: boolean; showHours?: boolean; legalOverview?: boolean; headingId?: string }) {
  const language: LegalLocale = locale === 'en' ? 'en' : 'es-CL';
  return (
    <section aria-labelledby={headingId} className={compact ? 'text-sm leading-6' : 'rounded-[18px] bg-[var(--sf-soft)] p-5 text-sm leading-6'}>
      <h2 id={headingId} className="font-black">{language === 'es-CL' ? 'Identificación del proveedor' : 'Supplier identification'}</h2>
      <p className="mt-3"><strong>{supplierProfile.legalName} · RUT {supplierProfile.rut}</strong></p>
      {legalOverview ? <p className="mt-1 break-words"><strong>{language === 'es-CL' ? 'Sucursal y bodega: ' : 'Branch and warehouse: '}</strong><a href="https://www.google.com/maps/search/Av.+Marath%C3%B3n+2499" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Av. Marathón 2499</a>, <span className="whitespace-nowrap">Bodega 041</span>, Macul, Región Metropolitana, Chile.</p>
        : <p className="break-words">{compact ? supplierProfile.principalAddress : <>{language === 'es-CL' ? 'Sucursal y bodega: ' : 'Branch and warehouse: '}{supplierProfile.operationalAddress}.</>}</p>}
      {!compact && !legalOverview && <p>{language === 'es-CL' ? 'Domicilio legal: ' : 'Registered address: '}{supplierProfile.legalAddress}</p>}
      <p className={legalOverview ? 'mt-1 flex flex-wrap items-baseline gap-x-1 font-bold' : undefined}><a href={`mailto:${supplierProfile.supportEmail}`} className="underline">{supplierProfile.supportEmail}</a>{showPhone && <> · <a href={`tel:${supplierProfile.phoneHref}`} className="underline">{supplierProfile.phoneDisplay}</a></>}</p>
      {showHours && (legalOverview ? <p className="mt-4"><strong>{language === 'es-CL' ? 'Lunes a viernes: ' : 'Monday to Friday: '}</strong><span className="whitespace-nowrap">10:00–17:30</span> · <strong>{language === 'es-CL' ? 'Sábados: ' : 'Saturdays: '}</strong><span className="whitespace-nowrap">10:30–15:30</span>. {language === 'es-CL' ? 'Hora de Santiago de Chile, excepto festivos.' : 'Santiago, Chile time, excluding public holidays.'}</p> : <p>{supplierProfile.serviceHours[language]}</p>)}
      {!compact && <><p className={legalOverview ? 'mt-4' : 'mt-3 text-xs text-[var(--sf-muted)]'}>{legalOverview ? (language === 'es-CL' ? 'Atención presencial, retiros y devoluciones previa coordinación.' : 'Visits, pickups and returns by prior arrangement.') : supplierProfile.sourceNote[language]}</p><Link href={`/${locale}/legal/supplier`} className="mt-4 inline-block font-bold underline">{language === 'es-CL' ? 'Ver información completa' : 'View full information'}</Link></>}
    </section>
  );
}
