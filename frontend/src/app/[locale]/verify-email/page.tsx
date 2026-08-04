'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { CheckCircleFilled, CloseCircleFilled, LoadingOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
import { useSearchParams } from 'next/navigation';
import apiClient from '@/lib/api';

function VerifyEmailContent() {
  const locale = useLocale();
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'failed'>('loading');
  useEffect(() => {
    const token = params.get('token');
    if (!token) { setStatus('failed'); return; }
    void apiClient.post('/auth/email-verification/confirm', { token }).then(() => setStatus('success')).catch(() => setStatus('failed'));
  }, [params]);
  return <main className="store-container flex min-h-[55vh] items-center justify-center"><section className="max-w-xl text-center">{status === 'loading' ? <LoadingOutlined spin className="text-4xl text-[var(--sf-accent)]" /> : status === 'success' ? <CheckCircleFilled className="text-5xl text-[#24723f]" /> : <CloseCircleFilled className="text-5xl text-[#a33a32]" />}<h1 className="mt-5 text-3xl font-black">{status === 'loading' ? 'Verificando…' : status === 'success' ? 'Correo verificado' : 'El enlace no es válido o expiró'}</h1><Link href={`/${locale}/profile`} className="sf-button-primary mt-7">Volver a mi cuenta</Link></section></main>;
}

export default function VerifyEmailPage() { return <Suspense><VerifyEmailContent /></Suspense>; }
