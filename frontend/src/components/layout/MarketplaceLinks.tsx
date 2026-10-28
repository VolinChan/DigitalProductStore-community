import { useLocale } from 'next-intl';
import FooterBrandCard from './FooterBrandCard';

import { marketplaces } from '@/lib/brand/marketplaces';

export default function MarketplaceLinks() {
  const isSpanish = useLocale() !== 'en';
  return <nav aria-label="PLEXORIA marketplaces" className="sf-footer-marketplaces">
    <h3 className="sf-footer-eyebrow">{isSpanish ? 'También en' : 'Also on'}</h3>
    <div className="sf-footer-marketplace-list">
      {marketplaces.map((marketplace) => <FooterBrandCard key={marketplace.name} {...marketplace} variant="channel" label={`PLEXORIA ${isSpanish ? 'en' : 'on'} ${marketplace.name}`} />)}
    </div>
  </nav>;
}
