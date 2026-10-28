import Link from 'next/link';
import SupplierDisclosure from '@/components/legal/SupplierDisclosure';

export default function LegalCenterContent({ locale, serverFallback = false }: { locale: string; serverFallback?: boolean }) {
  const es = locale !== 'en';
  const links = [
    ['terms', es ? 'Términos y condiciones' : 'Terms and conditions'],
    ['returns-withdrawal', es ? 'Cambios, devoluciones y retracto' : 'Returns and withdrawal'],
    ['legal-guarantee', es ? 'Garantía legal' : 'Legal guarantee'],
    ['../help/shipping', es ? 'Información de despacho' : 'Shipping information'],
    ['../privacy', es ? 'Política de privacidad' : 'Privacy policy'],
    ['cookies', es ? 'Política de cookies' : 'Cookie policy'],
    ['supplier', es ? 'Identificación del proveedor' : 'Supplier identification'],
    ['../privacy-request', es ? 'Solicitud sobre datos personales' : 'Personal data request'],
  ];
  return <main className={`${serverFallback ? 'seo-server-content' : 'seo-interactive-content'} store-container`}><div className="mx-auto max-w-4xl"><h1 className="text-4xl font-black">{es ? 'Información legal' : 'Legal information'}</h1><p className="mt-3 text-[var(--sf-muted)]">{es ? 'Documentos, derechos del consumidor e identificación de quien opera PLEXORIA.' : 'Documents, consumer rights, and identification of the company operating PLEXORIA.'}</p><div className="mt-8 grid gap-3 sm:grid-cols-2">{links.map(([path, label]) => <Link key={path} href={`/${locale}/legal/${path}`.replace('/legal/../', '/')} className="rounded-[18px] bg-white p-5 font-black hover:text-[var(--sf-accent)]">{label} →</Link>)}</div><div className="mt-8"><SupplierDisclosure locale={locale} legalOverview headingId={serverFallback ? 'server-legal-supplier-title' : undefined} /></div></div></main>;
}
