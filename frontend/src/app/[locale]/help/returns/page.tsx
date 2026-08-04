import { redirect } from 'next/navigation';

export default async function ReturnsRedirect({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  redirect(`/${locale}/legal/returns-withdrawal`);
}
