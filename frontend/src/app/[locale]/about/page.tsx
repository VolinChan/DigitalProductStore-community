import PublishedLegalDocument from '@/components/legal/PublishedLegalDocument';

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <div className="seo-interactive-content"><PublishedLegalDocument locale={locale} documentKey="about" /></div>;
}
