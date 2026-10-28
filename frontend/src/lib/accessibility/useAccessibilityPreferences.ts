'use client';

import { useCallback, useEffect, useState } from 'react';
import { accessibilityChangedEvent, accessibilityStorageKey, applyAccessibilityPreferences, defaultAccessibilityPreferences, normalizeAccessibilityPreferences, readAccessibilityPreferences, type AccessibilityPreferences } from './preferences';

export function useAccessibilityPreferences() {
  const [preferences, setPreferences] = useState(defaultAccessibilityPreferences);

  useEffect(() => {
    const apply = (next: AccessibilityPreferences) => {
      setPreferences(next);
      applyAccessibilityPreferences(next);
    };
    apply(readAccessibilityPreferences());
    const changed = (event: Event) => apply(normalizeAccessibilityPreferences((event as CustomEvent).detail));
    const stored = (event: StorageEvent) => {
      if (event.key === accessibilityStorageKey || event.key === null) apply(readAccessibilityPreferences());
    };
    window.addEventListener(accessibilityChangedEvent, changed);
    window.addEventListener('storage', stored);
    return () => {
      window.removeEventListener(accessibilityChangedEvent, changed);
      window.removeEventListener('storage', stored);
    };
  }, []);

  const updatePreferences = useCallback((next: AccessibilityPreferences) => {
    const normalized = normalizeAccessibilityPreferences(next);
    try { window.localStorage.setItem(accessibilityStorageKey, JSON.stringify(normalized)); } catch { /* Keep the choice usable for this session when storage is unavailable. */ }
    setPreferences(normalized);
    applyAccessibilityPreferences(normalized);
    window.dispatchEvent(new CustomEvent(accessibilityChangedEvent, { detail: normalized }));
  }, []);

  return { preferences, updatePreferences };
}
