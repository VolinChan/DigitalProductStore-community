'use client';

import { usePathname, useRouter, useSearchParams } from 'next/navigation';

const localeLabels = { 'es-CL': 'ES', 'en': 'EN' as const };
const locales = ['es-CL' as const, 'en' as const] as const;

type Locale = typeof locales[number];

export default function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleChange = (newLocale: Locale) => {
    // Keep the choice available when the visitor returns to the storefront.
    // The root entry point reads this first-party cookie before redirecting.
    document.cookie = `plexoria_locale=${newLocale}; path=/; max-age=31536000; SameSite=Lax`;
    // Get the full pathname without the leading slash and first segment (locale)
    const parts = (pathname || '/').split('/').slice(1);
    parts.shift(); // Remove the current locale part
    const remainingPath = parts.join('/'); // e.g., "cart" or "products"

    // Build new URL with new locale + remaining path
    const newPath = remainingPath
      ? `/${newLocale}/${remainingPath}`
      : `/${newLocale}`;

    const query = searchParams.toString();
    router.push(query ? `${newPath}?${query}` : newPath);
  };

  return (
    <div className="inline-flex min-h-11 items-center gap-0.5" role="group" aria-label="Language selector">
      {locales.map((loc) => {
        const isActive = loc === (pathname || '/').split('/')[1];

        return (
          <button
            key={loc}
            type="button"
            onClick={() => handleChange(loc)}
            disabled={isActive}
            aria-label={`Switch to ${localeLabels[loc]}`}
            aria-pressed={isActive}
            className={`min-h-11 min-w-11 rounded-lg px-2.5 text-xs tracking-wide transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--sf-accent)] ${isActive
              ? 'cursor-default bg-[var(--sf-soft-blue)] font-black text-[var(--sf-brand)]'
              : 'cursor-pointer font-semibold text-[var(--sf-subtle)] hover:bg-[var(--sf-soft)] hover:text-[var(--sf-brand)]'
            }`}
          >
            {localeLabels[loc]}
          </button>
        );
      })}
    </div>
  );
}
