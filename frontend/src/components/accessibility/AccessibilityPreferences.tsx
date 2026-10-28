'use client';

import { useRef, useState } from 'react';
import { Modal } from 'antd';
import { useTranslations } from 'next-intl';
import { defaultAccessibilityPreferences } from '@/lib/accessibility/preferences';
import { useAccessibilityPreferences } from '@/lib/accessibility/useAccessibilityPreferences';

export default function AccessibilityPreferences() {
  const t = useTranslations('accessibility');
  const common = useTranslations('common');
  const [open, setOpen] = useState(false);
  const firstChoice = useRef<HTMLInputElement>(null);
  const { preferences, updatePreferences } = useAccessibilityPreferences();

  return <>
    <button type="button" className="border-0 bg-transparent p-0 text-inherit transition hover:text-white focus-visible:outline-white" onClick={() => setOpen(true)}>{t('label')}</button>
    <Modal title={t('label')} open={open} onCancel={() => setOpen(false)} className="storefront" aria-describedby="accessibility-description" afterOpenChange={visible => { if (visible) firstChoice.current?.focus(); }} footer={
      <div className="flex flex-wrap justify-end gap-3">
        <button type="button" className="sf-button-quiet" onClick={() => updatePreferences(defaultAccessibilityPreferences)}>{t('reset')}</button>
        <button type="button" className="sf-button-primary" onClick={() => setOpen(false)}>{common('close')}</button>
      </div>
    }>
      <p id="accessibility-description" className="text-sm leading-6 text-[var(--sf-subtle)]">{t('description')}</p>
      <div className="my-5 space-y-3">
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[var(--sf-line)] p-3">
          <input ref={firstChoice} type="checkbox" aria-labelledby="accessibility-contrast-label" aria-describedby="accessibility-contrast-hint" checked={preferences.highContrast} onChange={event => updatePreferences({ ...preferences, highContrast: event.target.checked })} className="h-6 w-6 shrink-0 accent-[var(--sf-brand)]" />
          <span><span id="accessibility-contrast-label" className="block text-sm font-bold text-[var(--sf-ink)]">{t('highContrast')}</span><span id="accessibility-contrast-hint" className="mt-1 block text-sm text-[var(--sf-muted)]">{t('highContrastHint')}</span></span>
        </label>
        <label className="flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border border-[var(--sf-line)] p-3">
          <input type="checkbox" aria-labelledby="accessibility-motion-label" aria-describedby="accessibility-motion-hint" checked={preferences.reduceMotion} onChange={event => updatePreferences({ ...preferences, reduceMotion: event.target.checked })} className="h-6 w-6 shrink-0 accent-[var(--sf-brand)]" />
          <span><span id="accessibility-motion-label" className="block text-sm font-bold text-[var(--sf-ink)]">{t('reduceMotion')}</span><span id="accessibility-motion-hint" className="mt-1 block text-sm text-[var(--sf-muted)]">{t('reduceMotionHint')}</span></span>
        </label>
      </div>
      <p className="text-xs leading-5 text-[var(--sf-muted)]">{t('systemHint')}</p>
    </Modal>
  </>;
}
