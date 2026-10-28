'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLocale } from 'next-intl';
import { consentChangedEvent, openConsentCenterEvent, readConsent, saveConsent, type ConsentReceipt } from '@/lib/legal/consent';
import styles from './CookieConsentCenter.module.css';

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
  return <div data-cookie-consent className={styles.container} role="dialog" aria-modal="false" aria-labelledby="cookie-consent-title" aria-describedby="cookie-consent-description">
    <div className={`${styles.panel} ${customizing ? styles.customizing : ''}`}>
      <div className={styles.copy}>
        <h2 id="cookie-consent-title" className="text-base font-black text-[var(--sf-ink)]">{es ? 'Tus preferencias de privacidad' : 'Your privacy preferences'}</h2>
        <p id="cookie-consent-description" className="mt-1 text-xs leading-5 text-[var(--sf-muted)]">{es ? 'Usamos almacenamiento necesario para tu carrito y sesión. Tú decides sobre análisis, marketing y personalización opcionales.' : 'Necessary storage keeps your cart and session working. You choose whether to allow optional analytics, marketing and personalization.'} <Link href={`/${locale}/legal/cookies`} className="font-bold underline">{es ? 'Ver política' : 'View policy'}</Link>.</p>
        {customizing && <p className="mt-2 text-xs leading-5 text-[var(--sf-muted)]">{es ? 'El análisis requiere tu autorización. Las preferencias de marketing y personalización no implican que esas herramientas estén actualmente activas.' : 'Analytics requires your consent. Marketing and personalization preferences do not mean those tools are currently active.'}</p>}
      </div>
      {customizing && <fieldset className="mt-4 grid gap-3 sm:grid-cols-2"><legend className="sr-only">{es ? 'Categorías de cookies' : 'Cookie categories'}</legend>
        <ConsentChoice label={es ? 'Necesarias (siempre activas)' : 'Necessary (always active)'} checked disabled onChange={() => undefined} />
        <ConsentChoice label={es ? 'Análisis' : 'Analytics'} checked={choices.analytics} onChange={(analytics) => setChoices((value) => ({ ...value, analytics }))} />
        <ConsentChoice label="Marketing" checked={choices.marketing} onChange={(marketing) => setChoices((value) => ({ ...value, marketing }))} />
        <ConsentChoice label={es ? 'Personalización' : 'Personalization'} checked={choices.personalization} onChange={(personalization) => setChoices((value) => ({ ...value, personalization }))} />
      </fieldset>}
      <div className={styles.actions}>
        <button type="button" className="sf-button-primary w-full" onClick={() => persist(accepted)}>{es ? 'Aceptar todas' : 'Accept all'}</button>
        <button type="button" className="sf-button-secondary w-full" onClick={() => persist(rejected)}>{es ? 'Rechazar no necesarias' : 'Reject nonessential'}</button>
        {customizing ? <button type="button" className="sf-button-secondary w-full" onClick={() => persist(choices)}>{es ? 'Guardar preferencias' : 'Save preferences'}</button> : <button type="button" className="sf-button-secondary w-full" onClick={() => setCustomizing(true)}>{es ? 'Personalizar' : 'Customize'}</button>}
      </div>
      {receipt && <button type="button" className="sf-button-secondary mt-3 w-full sm:w-auto" onClick={() => { setVisible(false); setCustomizing(false); }}>{es ? 'Cerrar sin cambios' : 'Close without changes'}</button>}
    </div>
  </div>;
}

function ConsentChoice({ label, checked, disabled = false, onChange }: { label: string; checked: boolean; disabled?: boolean; onChange: (value: boolean) => void }) {
  return <label className="flex min-h-11 items-center gap-3 rounded-xl border border-[var(--sf-line)] px-3 py-2 text-sm font-bold"><input type="checkbox" checked={checked} disabled={disabled} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4" />{label}</label>;
}
