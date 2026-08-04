import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { isStorefrontLocale } from '@/lib/seo/policy';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return params.then(({ locale }) => isStorefrontLocale(locale) ? publicPageMetadata(locale, 'help/shipping', {
    'es-CL': { title: 'Información de envíos', description: 'Consulta cómo se calculan y presentan las opciones de envío disponibles en Plexoria.' },
    en: { title: 'Shipping information', description: 'Learn how available shipping options are calculated and presented at Plexoria.' },
  }) : {});
}

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
