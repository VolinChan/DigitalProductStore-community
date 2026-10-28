import Link from 'next/link';
import documents from '@/lib/legal/documents.json';
import englishDocuments from '@/lib/legal/documents.en.json';
import { supplierProfile } from '@/lib/legal/supplier';

export type LegalDocumentKey = keyof typeof documents.documents;
const translations: Partial<Record<LegalDocumentKey, { title: string; paragraphs: string[] }>> = englishDocuments.documents;

export function LegalParagraphs({ documentKey, locale = 'es-CL', companyDetailsId = 'supplier-company-details' }: { documentKey: LegalDocumentKey; locale?: string; companyDetailsId?: string }) {
  const document = (locale === 'en' && translations[documentKey]) || documents.documents[documentKey];
  const aboutHeadings = new Set(['Soluciones tecnológicas para tu día a día', 'Un catálogo pensado para distintas necesidades', 'Información clara para elegir mejor', 'Compra online y operación en Chile', 'Atención antes y después de tu compra', 'Atención presencial en nuestra bodega', 'Información de la empresa', 'Technology for everyday life', 'A catalog for different needs', 'Clear information to help you choose', 'Online shopping and operations in Chile', 'Support before and after your purchase', 'Visiting our warehouse', 'Company information']);
  const companyEnd = documentKey === 'supplier_identification' ? document.paragraphs.indexOf('2. Atención y horario') : -1;
  const companyFields = companyEnd > 0 ? document.paragraphs.slice(1, companyEnd) : [];
  const paragraphs = companyEnd > 0 ? document.paragraphs.slice(companyEnd) : document.paragraphs;
  return <div className="legal-copy mt-8 space-y-5 text-sm leading-7 text-[var(--sf-ink)]">
    {companyEnd > 0 && <section aria-labelledby={companyDetailsId}>
      <h2 id={companyDetailsId} className="pt-4 text-xl font-black">{document.paragraphs[0]}</h2>
      <dl className="mt-5 divide-y divide-[var(--sf-line)]">
        {companyFields.filter((_, index) => index % 2 === 0).map((label, index) => <div key={label} className="grid gap-1 py-3 sm:grid-cols-[11rem_minmax(0,1fr)] sm:gap-5">
          <dt className="font-semibold text-[var(--sf-subtle)]">{label}:</dt>
          <dd className="m-0 min-w-0 break-words">{companyFields[index * 2 + 1]}</dd>
        </div>)}
      </dl>
    </section>}
    {paragraphs.map((paragraph, index) => /^\d+\. /.test(paragraph) || (documentKey === 'about' && aboutHeadings.has(paragraph))
      ? <h2 key={index} className="pt-4 text-xl font-black">{paragraph}</h2>
      : <p key={index} className="whitespace-pre-line">{paragraph}</p>)}
  </div>;
}

export default function PublishedLegalDocument({ locale, documentKey, serverFallback = false }: { locale: string; documentKey: LegalDocumentKey; serverFallback?: boolean }) {
  const translated = locale === 'en' && translations[documentKey];
  const document = translated || documents.documents[documentKey];
  return <main className={`${serverFallback ? 'seo-server-content' : 'seo-interactive-content'} store-container`}><article className="mx-auto max-w-3xl rounded-[22px] bg-white p-6 sm:p-9">
    <Link href={`/${locale}/legal`} className="text-sm font-bold text-[var(--sf-accent)]">← {locale === 'en' ? 'Legal center' : 'Centro legal'}</Link>
    <h1 className="mt-5 text-3xl font-black">{document.title}</h1>
    {locale === 'en' && documentKey !== 'about' && <p className="mt-5 rounded-xl bg-[var(--sf-soft)] p-4 text-sm">The authoritative version is in Spanish. <Link href={documentKey === 'shipping' ? '/es-CL/help/shipping' : '/es-CL/legal'} className="font-bold underline">{documentKey === 'shipping' ? 'Read the Spanish shipping information' : 'Read the Spanish legal information'}</Link>.</p>}
    {documentKey !== 'about' && <p className="mt-4 text-sm text-[var(--sf-muted)]">{translated ? `Last updated: ${englishDocuments.updated}` : `Última actualización: ${documents.updated}`}</p>}
    {documentKey === 'shipping' && <aside aria-label={locale === 'en' ? 'Warehouse pickup' : 'Retiro en bodega'} className="mt-6 rounded-2xl bg-[var(--sf-soft-blue)] p-5 text-sm leading-6 text-[var(--sf-ink)]">
      <h2 className="text-lg font-extrabold text-[var(--sf-brand)]">{locale === 'en' ? 'Free warehouse pickup' : 'Retiro gratis en bodega'}</h2>
      <p className="mt-2">{locale === 'en' ? 'Choose warehouse pickup at checkout to pay no shipping fee. Arrange the date and time with us and confirm your order is ready before visiting.' : 'Elige retiro en bodega al pagar para no pagar despacho. Coordina con nosotros la fecha y hora y confirma que tu pedido esté listo antes de acudir.'}</p>
      <p className="mt-2 font-semibold">{supplierProfile.operationalAddress}</p>
    </aside>}
    <LegalParagraphs documentKey={documentKey} locale={locale} companyDetailsId={serverFallback ? 'server-supplier-company-details' : undefined} />
    {documentKey !== 'about' && <footer className="mt-10 border-t border-[var(--sf-line)] pt-5 text-xs text-[var(--sf-muted)]">{translated ? 'Version' : 'Versión'} {documents.version} · PLEXORIA</footer>}
  </article></main>;
}
