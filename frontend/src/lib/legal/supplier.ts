export const supplierProfile = {
  version: '0.1-owner-confirmed',
  legalName: 'Plexoria SpA',
  rut: '78.236.393-K',
  principalAddress: 'Alameda 2963, Santiago, Región Metropolitana, Chile',
  supportEmail: 'support@plexoria.cl',
  phoneDisplay: '+56 9 9509 6835',
  phoneHref: '+56995096835',
  whatsappHref: 'https://wa.me/56995096835',
  serviceHours: {
    'es-CL': 'Lunes a Viernes, 09:00–18:00',
    en: 'Monday to Friday, 09:00–18:00',
  },
  sourceNote: {
    'es-CL': 'Identidad y contacto proporcionados por PLEXORIA. Dirección pendiente de verificación formal antes de la aprobación jurídica final.',
    en: 'Identity and contact information supplied by PLEXORIA. Address pending formal verification before final legal approval.',
  },
} as const;

export type LegalLocale = keyof typeof supplierProfile.serviceHours;
