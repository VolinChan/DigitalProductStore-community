export interface AccessibilityPreferences {
  highContrast: boolean;
  reduceMotion: boolean;
}

export const accessibilityStorageKey = 'plexoria-accessibility:v1';
export const accessibilityChangedEvent = 'plexoria-accessibility-changed';
export const defaultAccessibilityPreferences: AccessibilityPreferences = { highContrast: false, reduceMotion: false };

export function normalizeAccessibilityPreferences(value: unknown): AccessibilityPreferences {
  const preferences = value && typeof value === 'object' ? value as Partial<AccessibilityPreferences> : {};
  return { highContrast: preferences.highContrast === true, reduceMotion: preferences.reduceMotion === true };
}

export function readAccessibilityPreferences(): AccessibilityPreferences {
  try {
    return normalizeAccessibilityPreferences(JSON.parse(window.localStorage.getItem(accessibilityStorageKey) || '{}'));
  } catch {
    return defaultAccessibilityPreferences;
  }
}

export function applyAccessibilityPreferences(preferences: AccessibilityPreferences) {
  document.documentElement.dataset.accessibilityContrast = preferences.highContrast ? 'high' : 'standard';
  document.documentElement.dataset.accessibilityMotion = preferences.reduceMotion ? 'reduce' : 'system';
}

// Apply saved preferences before the first paint, including when JavaScript
// hydration is still pending. Only boolean choices become DOM attributes.
export const accessibilityBootstrapScript = `try{var a=JSON.parse(localStorage.getItem('${accessibilityStorageKey}')||'{}');document.documentElement.dataset.accessibilityContrast=a&&a.highContrast===true?'high':'standard';document.documentElement.dataset.accessibilityMotion=a&&a.reduceMotion===true?'reduce':'system'}catch(e){}`;
