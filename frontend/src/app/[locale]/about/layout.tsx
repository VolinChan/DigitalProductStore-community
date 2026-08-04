import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { isStorefrontLocale } from '@/lib/seo/policy';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return params.then(({ locale }) => isStorefrontLocale(locale) ? publicPageMetadata(locale, 'about', {
    'es-CL': { title: 'Acerca de Plexoria', description: 'Conoce la propuesta de Plexoria para comprar tecnología y accesorios con información clara.' },
    en: { title: 'About Plexoria', description: 'Learn about Plexoria and our approach to clear technology and accessory shopping.' },
  }) : {});
}

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
