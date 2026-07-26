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
    <div className="flex items-center gap-0.5" role="group" aria-label="Language selector">
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
            className={`
              px-2 py-1 rounded text-xs font-semibold transition-colors min-h-[32px]
              ${isActive
                ? 'bg-accent/10 text-accent cursor-not-allowed opacity-60'
                : 'text-muted hover:text-foreground hover:bg-black/5 dark:hover:bg-white/10 cursor-pointer'
              }
            `}
          >
            {localeLabels[loc]}
          </button>
        );
      })}
    </div>
  );
}
