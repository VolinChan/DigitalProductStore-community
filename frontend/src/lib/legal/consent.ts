import apiClient from '@/lib/api';

export const consentPolicyVersion = '0.1-draft';
export const consentStorageKey = 'plexoria-cookie-consent:v1';
export const consentChangedEvent = 'plexoria:consent-changed';
export const openConsentCenterEvent = 'plexoria:open-consent-center';
const consentSubjectKey = 'plexoria-consent-subject:v1';
const analyticsSessionKey = 'plexoria-analytics-session:v1';

export type ConsentChoices = {
  necessary: true;
  analytics: boolean;
  marketing: boolean;
  personalization: boolean;
};

export type ConsentReceipt = ConsentChoices & {
  policy_version: string;
  locale: string;
  recorded_at: string;
};

export function readConsent(): ConsentReceipt | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = JSON.parse(window.localStorage.getItem(consentStorageKey) || 'null') as Partial<ConsentReceipt> | null;
    if (!value || value.policy_version !== consentPolicyVersion || value.necessary !== true) return null;
    return {
      policy_version: value.policy_version,
      locale: typeof value.locale === 'string' ? value.locale : 'es-CL',
      recorded_at: typeof value.recorded_at === 'string' ? value.recorded_at : '',
      necessary: true,
      analytics: value.analytics === true,
      marketing: value.marketing === true,
      personalization: value.personalization === true,
    };
  } catch {
    return null;
  }
}

export function saveConsent(locale: string, choices: Omit<ConsentChoices, 'necessary'>): ConsentReceipt {
	const previousAnalytics = readConsent()?.analytics === true;
  const receipt: ConsentReceipt = {
    policy_version: consentPolicyVersion,
    locale,
    recorded_at: new Date().toISOString(),
    necessary: true,
    analytics: choices.analytics,
    marketing: choices.marketing,
    personalization: choices.personalization,
  };
  window.localStorage.setItem(consentStorageKey, JSON.stringify(receipt));
	if (!choices.analytics) {
		window.localStorage.removeItem(analyticsSessionKey);
	} else if (!previousAnalytics || !window.localStorage.getItem(analyticsSessionKey)) {
		const sessionID = window.crypto.randomUUID();
		window.localStorage.setItem(analyticsSessionKey, sessionID);
		void apiClient.post('/analytics/track', { event_type: 'session_start', session_id: sessionID }).catch(() => undefined);
	}
  window.dispatchEvent(new CustomEvent(consentChangedEvent, { detail: receipt }));
  let subjectRef = window.localStorage.getItem(consentSubjectKey);
  if (!subjectRef) { subjectRef = window.crypto.randomUUID(); window.localStorage.setItem(consentSubjectKey, subjectRef); }
  void apiClient.post('/consents', { ...receipt, subject_ref: subjectRef }).catch(() => undefined);
  return receipt;
}

export function analyticsAllowed(): boolean {
  return readConsent()?.analytics === true;
}

export function getAnalyticsSessionID(): string | null {
	if (typeof window === 'undefined' || !analyticsAllowed()) return null;
	let sessionID = window.localStorage.getItem(analyticsSessionKey);
	if (!sessionID) {
		sessionID = window.crypto.randomUUID();
		window.localStorage.setItem(analyticsSessionKey, sessionID);
		void apiClient.post('/analytics/track', { event_type: 'session_start', session_id: sessionID }).catch(() => undefined);
	}
	return sessionID;
}

export function trackStorefrontEvent(payload: Record<string, unknown>): void {
	const sessionID = getAnalyticsSessionID();
	if (!sessionID) return;
	void apiClient.post('/analytics/track', { ...payload, session_id: sessionID }).catch(() => undefined);
}
