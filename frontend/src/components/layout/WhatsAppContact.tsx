'use client';

import { CloseOutlined, WhatsAppOutlined } from '@ant-design/icons';
import { useLocale } from 'next-intl';
import { usePathname } from 'next/navigation';
import { createContext, useContext, useEffect, useId, useMemo, useRef, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';
import { supplierProfile } from '@/lib/legal/supplier';
import { isWithinSupportHours } from '@/lib/support-hours';

type ContactProduct = { pathname: string; publicPath: string; name: string };
const ContactContext = createContext<{
  product: ContactProduct | null;
  setProduct: Dispatch<SetStateAction<ContactProduct | null>>;
  siteOrigin: string;
} | null>(null);

export function WhatsAppContactProvider({ children, siteOrigin }: { children: ReactNode; siteOrigin: string }) {
  const [product, setProduct] = useState<ContactProduct | null>(null);
  const value = useMemo(() => ({ product, setProduct, siteOrigin }), [product, siteOrigin]);
  return <ContactContext.Provider value={value}>{children}</ContactContext.Provider>;
}

// Product data is published only after loading. Route ownership and cleanup
// keep an earlier product from leaking into a later page's contact message.
export function useWhatsAppProduct(product: { id: number; slug?: string; name: string } | null, productRef: string, disabled: boolean) {
  const setProduct = useContext(ContactContext)?.setProduct;
  const pathname = usePathname();
  const locale = useLocale();
  const id = product?.id;
  const slug = product?.slug;
  const name = product?.name;
  useEffect(() => {
    if (!setProduct || disabled || !pathname || !id || !name || (productRef !== String(id) && productRef !== slug)) return;
    const current = { pathname, name, publicPath: `/${locale}/products/${encodeURIComponent(slug || String(id))}` };
    setProduct(current);
    return () => setProduct((value) => value === current ? null : value);
  }, [setProduct, disabled, pathname, id, slug, name, productRef, locale]);
}

export default function WhatsAppContact() {
  const pathname = usePathname();
  return <WhatsAppContactForRoute key={pathname} />;
}

function WhatsAppContactForRoute() {
  const isSpanish = useLocale() !== 'en';
  const pathname = usePathname();
  const context = useContext(ContactContext);
  const [noticeOpen, setNoticeOpen] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [helpVisible, setHelpVisible] = useState(false);
  const widgetRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLAnchorElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const noticeId = useId();
  const closeNotice = () => {
    setNoticeOpen(false);
    triggerRef.current?.focus();
  };

  useEffect(() => {
    const mobile = window.matchMedia('(max-width: 639px)');
    let idleTimer: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => {
      if (!mobile.matches) return;
      setScrolling(true);
      clearTimeout(idleTimer);
      idleTimer = setTimeout(() => setScrolling(false), 700);
    };
    const onModeChange = () => {
      clearTimeout(idleTimer);
      setScrolling(false);
    };
    const help = document.querySelector('[data-shopping-help]');
    const observer = new IntersectionObserver(entries => {
      setHelpVisible(entries.some(entry => entry.isIntersecting));
    }, { threshold: 0.1 });
    if (help) observer.observe(help);
    window.addEventListener('scroll', onScroll, { passive: true });
    mobile.addEventListener('change', onModeChange);
    return () => {
      clearTimeout(idleTimer);
      observer.disconnect();
      window.removeEventListener('scroll', onScroll);
      mobile.removeEventListener('change', onModeChange);
    };
  }, []);

  useEffect(() => {
    if (!noticeOpen) return;
    closeRef.current?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !widgetRef.current?.contains(event.target)) setNoticeOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setNoticeOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [noticeOpen]);

  const product = context?.product?.pathname === pathname ? context.product : null;
  const productUrl = product && context ? new URL(product.publicPath, context.siteOrigin).href : null;
  const genericMessage = isSpanish
    ? 'Hola, tengo una consulta sobre PLEXORIA.'
    : 'Hello, I have a question about PLEXORIA.';
  const message = product && productUrl
    ? `${isSpanish ? `Hola, estoy viendo el producto «${product.name}» y tengo una consulta.` : `Hello, I am viewing “${product.name}” and have a question.`}\n${productUrl}`
    : genericMessage;
  const label = isSpanish ? 'Contactar por WhatsApp (abre una nueva pestaña)' : 'Contact us on WhatsApp (opens a new tab)';
  const href = `${supplierProfile.whatsappHref}?text=${encodeURIComponent(message)}`;

  return (
    <div ref={widgetRef} className="sf-whatsapp-widget" data-mobile-hidden={!noticeOpen && (scrolling || helpVisible) ? 'true' : undefined}>
      {noticeOpen && (
        <section className="sf-whatsapp-notice" role="dialog" aria-modal="false" id={noticeId} aria-labelledby={`${noticeId}-title`} aria-describedby={`${noticeId}-description`}>
          <div className="flex items-start gap-2">
            <h2 id={`${noticeId}-title`} className="pt-2 text-base font-bold leading-6 text-[var(--sf-brand)]">
              {isSpanish ? 'Estamos fuera de nuestro horario de atención.' : 'We are outside our service hours.'}
            </h2>
            <button ref={closeRef} type="button" onClick={closeNotice} className="sf-icon-button shrink-0" aria-label={isSpanish ? 'Cerrar aviso' : 'Close notice'}>
              <CloseOutlined aria-hidden="true" />
            </button>
          </div>
          <p id={`${noticeId}-description`} className="mt-2 text-sm leading-6 text-[var(--sf-subtle)]">
            {isSpanish ? 'Puedes dejarnos tu mensaje por WhatsApp. Te responderemos en nuestro próximo horario de atención.' : 'You can leave us a message on WhatsApp. We will reply during our next service hours.'}
          </p>
          <p className="mt-3 text-xs leading-5 text-[var(--sf-muted)]">{supplierProfile.serviceHours[isSpanish ? 'es-CL' : 'en']}</p>
          <a href={href} target="_blank" rel="noopener noreferrer" onClick={closeNotice} className="sf-button-primary mt-4 w-full">
            {isSpanish ? 'Abrir WhatsApp' : 'Open WhatsApp'}
          </a>
        </section>
      )}
      <a
        ref={triggerRef}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        aria-expanded={noticeOpen}
        aria-controls={noticeOpen ? noticeId : undefined}
        title={label}
        className="sf-whatsapp-contact"
        onClick={(event) => {
          if (isWithinSupportHours(new Date())) {
            setNoticeOpen(false);
            return;
          }
          event.preventDefault();
          setNoticeOpen((open) => !open);
        }}
      >
        <WhatsAppOutlined aria-hidden="true" style={{ fontSize: 26, color: '#167c49' }} />
        <span className="hidden text-sm font-bold sm:inline">WhatsApp</span>
      </a>
    </div>
  );
}
