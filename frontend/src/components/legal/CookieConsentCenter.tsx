'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { consentChangedEvent, openConsentCenterEvent, readConsent, saveConsent, type ConsentReceipt } from '@/lib/legal/consent';

type OptionalChoices = Pick<ConsentReceipt, 'analytics' | 'marketing' | 'personalization'>;
const rejected: OptionalChoices = { analytics: false, marketing: false, personalization: false };
const accepted: OptionalChoices = { analytics: true, marketing: true, personalization: true };

export default function CookieConsentCenter() {
  const locale = useLocale();
  const es = locale !== 'en';
  const [receipt, setReceipt] = useState<ConsentReceipt | null>(null);
  const [visible, setVisible] = useState(false);
  const [customizing, setCustomizing] = useState(false);
  const [choices, setChoices] = useState<OptionalChoices>(rejected);

  useEffect(() => {
    const current = readConsent();
    setReceipt(current);
    setChoices(current || rejected);
    setVisible(!current);
    const open = () => { const latest = readConsent(); setChoices(latest || rejected); setCustomizing(true); setVisible(true); };
    const changed = (event: Event) => setReceipt((event as CustomEvent<ConsentReceipt>).detail);
    window.addEventListener(openConsentCenterEvent, open);
    window.addEventListener(consentChangedEvent, changed);
    return () => { window.removeEventListener(openConsentCenterEvent, open); window.removeEventListener(consentChangedEvent, changed); };
  }, []);

  const persist = (next: OptionalChoices) => {
    const saved = saveConsent(locale, next);
    setReceipt(saved); setChoices(next); setVisible(false); setCustomizing(false);
  };

  if (!visible) return null;
  return <div className="fixed inset-x-0 bottom-0 z-[120] p-3 sm:p-5" role="dialog" aria-modal="true" aria-labelledby="cookie-consent-title">
    <div className="mx-auto max-w-3xl rounded-[20px] border border-[var(--sf-line)] bg-white p-5 shadow-[0_20px_70px_rgba(21,48,66,0.25)] sm:p-6">
      <h2 id="cookie-consent-title" className="text-lg font-black text-[var(--sf-ink)]">{es ? 'Tus preferencias de privacidad' : 'Your privacy preferences'}</h2>
      <p className="mt-2 text-sm leading-6 text-[var(--sf-muted)]">{es ? 'Usamos almacenamiento necesario para carrito, sesión, seguridad e idioma. El análisis, marketing y personalización solo se activan si los autorizas.' : 'We use necessary storage for cart, session, security, and language. Analytics, marketing, and personalization activate only if you allow them.'} <Link href={`/${locale}/legal/cookies`} className="font-bold underline">{es ? 'Ver política' : 'View policy'}</Link>.</p>
      {customizing && <fieldset className="mt-4 grid gap-3 sm:grid-cols-2"><legend className="sr-only">{es ? 'Categorías de cookies' : 'Cookie categories'}</legend>
        <ConsentChoice label={es ? 'Necesarias (siempre activas)' : 'Necessary (always active)'} checked disabled onChange={() => undefined} />
        <ConsentChoice label={es ? 'Análisis' : 'Analytics'} checked={choices.analytics} onChange={(analytics) => setChoices((value) => ({ ...value, analytics }))} />
        <ConsentChoice label="Marketing" checked={choices.marketing} onChange={(marketing) => setChoices((value) => ({ ...value, marketing }))} />
        <ConsentChoice label={es ? 'Personalización' : 'Personalization'} checked={choices.personalization} onChange={(personalization) => setChoices((value) => ({ ...value, personalization }))} />
      </fieldset>}
      <div className="mt-5 grid gap-2 sm:grid-cols-3">
        <button type="button" className="sf-button-primary w-full" onClick={() => persist(accepted)}>{es ? 'Aceptar todas' : 'Accept all'}</button>
        <button type="button" className="sf-button-secondary w-full" onClick={() => persist(rejected)}>{es ? 'Rechazar no necesarias' : 'Reject nonessential'}</button>
        {customizing ? <button type="button" className="sf-button-secondary w-full" onClick={() => persist(choices)}>{es ? 'Guardar preferencias' : 'Save preferences'}</button> : <button type="button" className="sf-button-secondary w-full" onClick={() => setCustomizing(true)}>{es ? 'Personalizar' : 'Customize'}</button>}
      </div>
      {receipt && <button type="button" className="mt-3 min-h-11 text-sm font-bold underline" onClick={() => { setVisible(false); setCustomizing(false); }}>{es ? 'Cerrar sin cambios' : 'Close without changes'}</button>}
    </div>
  </div>;
}

function ConsentChoice({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--sf-line)] px-3 py-2 text-sm font-bold"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />{label}</label>;
}
