import type { Metadata } from 'next';
import { publicPageMetadata } from '@/lib/seo/metadata';
import { isStorefrontLocale } from '@/lib/seo/policy';

export function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  return params.then(({ locale }) => isStorefrontLocale(locale) ? publicPageMetadata(locale, 'contact', {
    'es-CL': { title: 'Contacto', description: 'Contacta al equipo de soporte de Plexoria por teléfono, WhatsApp o correo electrónico.' },
    en: { title: 'Contact', description: 'Contact Plexoria support by phone, WhatsApp, or email.' },
  }) : {});
}

export default function Layout({ children }: { children: React.ReactNode }) { return children; }
