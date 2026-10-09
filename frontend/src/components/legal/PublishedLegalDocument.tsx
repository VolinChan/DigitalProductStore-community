import Link from 'next/link';
import documents from '@/lib/legal/documents.json';

export type LegalDocumentKey = keyof typeof documents.documents;

export function LegalParagraphs({ documentKey }: { documentKey: LegalDocumentKey }) {
  const document = documents.documents[documentKey];
  const aboutHeadings = new Set(['Soluciones tecnológicas para tu día a día', 'Un catálogo pensado para distintas necesidades', 'Información clara para elegir mejor', 'Compra online y operación en Chile', 'Atención antes y después de tu compra', 'Atención presencial en nuestra bodega', 'Información de la empresa']);
  const companyEnd = documentKey === 'supplier_identification' ? document.paragraphs.indexOf('2. Atención y horario') : -1;
  const companyFields = companyEnd > 0 ? document.paragraphs.slice(1, companyEnd) : [];
  const paragraphs = companyEnd > 0 ? document.paragraphs.slice(companyEnd) : document.paragraphs;
  return <div className="legal-copy mt-8 space-y-5 text-sm leading-7 text-[var(--sf-ink)]">
    {companyEnd > 0 && <section aria-labelledby="supplier-company-details">
      <h2 id="supplier-company-details" className="pt-4 text-xl font-black">{document.paragraphs[0]}</h2>
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

export default function PublishedLegalDocument({ locale, documentKey }: { locale: string; documentKey: LegalDocumentKey }) {
  const document = documents.documents[documentKey];
  return <main className="store-container"><article className="mx-auto max-w-3xl rounded-[22px] bg-white p-6 sm:p-9">
    <Link href={`/${locale}/legal`} className="text-sm font-bold text-[var(--sf-accent)]">← {locale === 'en' ? 'Legal center' : 'Centro legal'}</Link>
    <h1 className="mt-5 text-3xl font-black">{document.title}</h1>
    {locale === 'en' && <p className="mt-5 rounded-xl bg-[var(--sf-soft)] p-4 text-sm">The authoritative version is in Spanish. <Link href="/es-CL/legal" className="font-bold underline">Read the Spanish legal information</Link>.</p>}
    {documentKey !== 'about' && <p className="mt-4 text-sm text-[var(--sf-muted)]">Última actualización: {documents.updated}</p>}
    <LegalParagraphs documentKey={documentKey} />
    {documentKey !== 'about' && <footer className="mt-10 border-t border-[var(--sf-line)] pt-5 text-xs text-[var(--sf-muted)]">Versión {documents.version} · PLEXORIA</footer>}
  </article></main>;
}
