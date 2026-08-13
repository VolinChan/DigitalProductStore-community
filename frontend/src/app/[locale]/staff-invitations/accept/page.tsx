'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { CheckCircleFilled, LockOutlined } from '@ant-design/icons';
import { Form, Input } from 'antd';

import apiClient from '@/lib/api';

const copy = {
  'zh-CN': {
    title: '接受员工邀请', intro: '设置安全密码后，你的后台职责会立即生效。', password: '密码', confirm: '确认密码', submit: '接受邀请',
    policy: '8–72 个字符，并包含大写字母、小写字母、数字和特殊字符。', mismatch: '两次输入的密码不一致', success: '员工账号已启用', login: '登录并进入后台',
    invalid: '邀请链接无效、已使用或已过期。请联系超级管理员重新发送。', missing: '邀请链接缺少令牌。', working: '正在接受…',
  },
  'es-CL': {
    title: 'Aceptar invitación al equipo', intro: 'Define una contraseña segura para activar de inmediato tus responsabilidades administrativas.', password: 'Contraseña', confirm: 'Confirmar contraseña', submit: 'Aceptar invitación',
    policy: 'Entre 8 y 72 caracteres, con mayúscula, minúscula, número y símbolo.', mismatch: 'Las contraseñas no coinciden', success: 'La cuenta del personal quedó activa', login: 'Iniciar sesión e ir a administración',
    invalid: 'La invitación es inválida, ya fue usada o venció. Pide a un superadministrador que la reenvíe.', missing: 'El enlace no contiene el token de invitación.', working: 'Aceptando…',
  },
} as const;

function InvitationAcceptance() {
  const params = useParams<{ locale: string }>();
  const search = useSearchParams();
  const locale = params.locale === 'zh-CN' ? 'zh-CN' : 'es-CL';
  const text = copy[locale];
  const token = search.get('token') || '';
  const [status, setStatus] = useState<'form' | 'success' | 'error'>(token ? 'form' : 'error');
  const [submitting, setSubmitting] = useState(false);
  const passwordPattern = useMemo(() => /^(?=.*\p{Lu})(?=.*\p{Ll})(?=.*\p{N})(?=.*[\p{P}\p{S}]).{8,72}$/u, []);

  const accept = async (values: { password: string }) => {
    setSubmitting(true);
    try { await apiClient.post('/auth/staff-invitations/accept', { token, password: values.password }); setStatus('success'); }
    catch { setStatus('error'); }
    finally { setSubmitting(false); }
  };

  return <main className="store-container flex min-h-[65vh] items-center justify-center">
    <section className="w-full max-w-lg rounded-[24px] bg-white p-6 shadow-[0_14px_50px_rgba(23,63,103,0.10)] sm:p-9">
      {status === 'success' ? <div className="text-center"><CheckCircleFilled className="text-5xl text-[#24723f]" /><h1 className="mt-5 text-3xl font-black">{text.success}</h1><Link href={`/${locale}/login?redirect=${encodeURIComponent('/admin')}`} className="sf-button-primary mt-7">{text.login}</Link></div>
        : status === 'error' ? <div className="text-center"><h1 className="text-3xl font-black">{text.title}</h1><p className="mt-4 text-sm leading-6 text-[var(--sf-muted)]">{token ? text.invalid : text.missing}</p></div>
          : <><h1 className="text-3xl font-black">{text.title}</h1><p className="mt-3 text-sm leading-6 text-[var(--sf-muted)]">{text.intro}</p><Form layout="vertical" className="mt-7" onFinish={accept}>
            <Form.Item name="password" label={text.password} rules={[{ required: true }, { pattern: passwordPattern, message: text.policy }]}><Input.Password prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item>
            <Form.Item name="confirm" label={text.confirm} dependencies={['password']} rules={[{ required: true }, ({ getFieldValue }) => ({ validator(_, value) { return value === getFieldValue('password') ? Promise.resolve() : Promise.reject(new Error(text.mismatch)); } })]}><Input.Password prefix={<LockOutlined />} autoComplete="new-password" /></Form.Item>
            <p className="mb-5 text-xs text-[var(--sf-muted)]">{text.policy}</p><button type="submit" disabled={submitting} className="sf-button-primary w-full">{submitting ? text.working : text.submit}</button>
          </Form></>}
    </section>
  </main>;
}

export default function StaffInvitationAcceptPage() {
  return <Suspense><InvitationAcceptance /></Suspense>;
}
