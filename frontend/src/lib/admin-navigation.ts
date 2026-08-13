import type { PermissionCode, User } from '@/types';

export const DEFAULT_ADMIN_STOREFRONT_LOCALE = 'es-CL' as const;

export function hasPermission(user: User | null | undefined, permission: PermissionCode): boolean {
  return user?.permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(user: User | null | undefined, permissions: PermissionCode[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function hasAdminAccess(user: User | null | undefined): boolean {
  return Boolean(user?.permissions?.length);
}

export function sanitizeLocalRedirect(value: string | null | undefined, fallback: string): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || value.includes('\\')) return fallback;
  try {
    const parsed = new URL(value, 'https://local.plexoria.invalid');
    if (parsed.origin !== 'https://local.plexoria.invalid') return fallback;
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return fallback;
  }
}

export function safeAdminRedirect(value: string | null | undefined): string {
  const redirect = sanitizeLocalRedirect(value, '/admin');
  return redirect === '/admin' || redirect.startsWith('/admin/') || redirect.startsWith('/admin?')
    ? redirect
    : '/admin';
}
