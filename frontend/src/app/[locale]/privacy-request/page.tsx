'use client';

import { FormEvent, useState } from 'react';
import { useLocale } from 'next-intl';
import Link from 'next/link';
import apiClient from '@/lib/api';

type SubmittedRequest = { public_ref: string; status: string; due_at: string };

export default function PrivacyRequestPage() {
  const locale = useLocale(); const es = locale !== 'en';
  const [submitting, setSubmitting] = useState(false); const [result, setResult] = useState<SubmittedRequest | null>(null); const [error, setError] = useState('');
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault(); setSubmitting(true); setError('');
    const data = new FormData(event.currentTarget);
    try {
      const response = await apiClient.post<{ data: SubmittedRequest }>('/privacy-requests', { request_type: data.get('request_type'), requester_contact: data.get('requester_contact'), request_detail: data.get('request_detail') });
      setResult(response.data.data);
    } catch { setError(es ? 'No pudimos registrar la solicitud. Revisa los datos e inténtalo nuevamente.' : 'We could not register the request. Check the details and try again.'); }
    finally { setSubmitting(false); }
  };
  return <main className="store-container"><div className="mx-auto max-w-2xl rounded-[22px] bg-white p-6 sm:p-9">
    <Link href={`/${locale}/privacy`} className="text-sm font-bold text-[var(--sf-accent)]">← {es ? 'Política de privacidad' : 'Privacy policy'}</Link>
    <h1 className="mt-5 text-3xl font-black">{es ? 'Solicitud sobre datos personales' : 'Personal data request'}</h1>
    <p className="mt-3 text-sm leading-6 text-[var(--sf-muted)]">{es ? 'Usa este formulario para solicitar acceso, corrección, eliminación, oposición, portabilidad, bloqueo o retiro de marketing. Verificaremos tu identidad de forma proporcional antes de divulgar o modificar datos.' : 'Use this form to request access, correction, deletion, objection, portability, blocking, or marketing withdrawal. We will proportionately verify identity before disclosing or changing data.'}</p>
    {result ? <div role="status" className="mt-7 rounded-xl bg-[#e8f4ef] p-5 text-sm leading-6"><strong>{es ? 'Solicitud registrada.' : 'Request registered.'}</strong><p>{es ? 'Referencia' : 'Reference'}: <span className="font-mono">{result.public_ref}</span></p><p>{es ? 'Te contactaremos para verificar la identidad. Fecha objetivo inicial' : 'We will contact you to verify identity. Initial target date'}: {new Intl.DateTimeFormat(locale, { dateStyle: 'long' }).format(new Date(result.due_at))}.</p></div> : <form className="mt-7 space-y-5" onSubmit={submit}>
      <label className="block text-sm font-bold">{es ? 'Tipo de solicitud' : 'Request type'}<select name="request_type" required className="sf-input mt-2 w-full" defaultValue="access"><option value="access">{es ? 'Acceso' : 'Access'}</option><option value="correction">{es ? 'Corrección' : 'Correction'}</option><option value="deletion">{es ? 'Eliminación' : 'Deletion'}</option><option value="marketing_withdrawal">{es ? 'Retiro de consentimiento de marketing' : 'Marketing consent withdrawal'}</option><option value="opposition">{es ? 'Oposición' : 'Objection'}</option><option value="portability">{es ? 'Portabilidad' : 'Portability'}</option><option value="blocking">{es ? 'Bloqueo' : 'Blocking'}</option></select></label>
      <label className="block text-sm font-bold">Email<input name="requester_contact" type="email" required maxLength={320} autoComplete="email" className="sf-input mt-2 w-full" /></label>
      <label className="block text-sm font-bold">{es ? 'Detalle opcional' : 'Optional detail'}<textarea name="request_detail" maxLength={4000} className="sf-input mt-2 min-h-32 w-full" /></label>
      {error && <p role="alert" className="text-sm font-bold text-[#a33a32]">{error}</p>}
      <button type="submit" disabled={submitting} className="sf-button-primary w-full">{submitting ? (es ? 'Enviando…' : 'Submitting…') : (es ? 'Enviar solicitud' : 'Submit request')}</button>
    </form>}
  </div></main>;
}
