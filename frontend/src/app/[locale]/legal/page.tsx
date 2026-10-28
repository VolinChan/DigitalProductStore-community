import LegalCenterContent from '@/components/legal/LegalCenterContent';

export default async function LegalCenter({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  return <LegalCenterContent locale={locale} />;
}
