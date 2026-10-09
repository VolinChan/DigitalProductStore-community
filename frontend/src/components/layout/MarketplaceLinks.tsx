import { useLocale } from 'next-intl';
import FooterBrandCard from './FooterBrandCard';

const marketplaces = [
  { name: 'Mercado Libre', mark: 'mercadolibre', href: 'https://www.mercadolibre.cl/pagina/plexoria', src: '/marketplaces/mercado-libre.svg', width: 64, height: 64 },
  { name: 'Falabella', mark: 'falabella', href: 'https://www.falabella.com/falabella-cl/seller/PLEXORIA', src: '/marketplaces/falabella.svg', width: 187, height: 28 },
];

export default function MarketplaceLinks() {
  const isSpanish = useLocale() !== 'en';
  return <nav aria-label="PLEXORIA marketplaces" className="sf-footer-marketplaces">
    <h3 className="sf-footer-eyebrow">{isSpanish ? 'También en' : 'Also on'}</h3>
    <div className="sf-footer-marketplace-list">
      {marketplaces.map((marketplace) => <FooterBrandCard key={marketplace.name} {...marketplace} variant="channel" label={`PLEXORIA ${isSpanish ? 'en' : 'on'} ${marketplace.name}`} />)}
    </div>
  </nav>;
}
