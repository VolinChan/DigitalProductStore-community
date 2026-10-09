export const supplierProfile = {
  version: '2026-10-09',
  legalName: 'PLEXORIA SpA',
  rut: '78.236.393-K',
  principalAddress: 'Av. Marathón 2499, Macul, Región Metropolitana, Chile.',
  legalAddress: 'Santiago, Chile',
  operationalAddress: 'Av. Marathón 2499, Bodega 041, Macul, Región Metropolitana, Chile',
  supportEmail: 'soporte@plexoria.cl',
  phoneDisplay: '+56 9 9509 6835',
  phoneHref: '+56995096835',
  whatsappHref: 'https://wa.me/56995096835',
  serviceHours: {
    'es-CL': 'Lunes a viernes, 10:00–17:30 · Sábados, 10:30–15:30. Hora de Santiago de Chile, excepto festivos.',
    en: 'Monday to Friday, 10:00–17:30 · Saturdays, 10:30–15:30. Santiago, Chile time, excluding public holidays.',
  },
  sourceNote: {
    'es-CL': 'Bodega y dirección operativa. Atención presencial, retiros y devoluciones previa coordinación.',
    en: 'Warehouse and operational address. Visits, pickups and returns by prior arrangement.',
  },
} as const;

export type LegalLocale = keyof typeof supplierProfile.serviceHours;
