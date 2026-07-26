import { redirect } from 'next/navigation';
import { cookies } from 'next/headers';

export default async function IndexPage() {
  const locale = (await cookies()).get('plexoria_locale')?.value;
  redirect(locale === 'en' ? '/en' : '/es-CL');
}
