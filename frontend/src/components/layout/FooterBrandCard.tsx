import Image from 'next/image';

interface FooterBrandCardProps {
  name: string;
  src: string;
  width: number;
  height: number;
  variant?: 'payment' | 'wide' | 'channel';
  mark: string;
  href?: string;
  label?: string;
}

export default function FooterBrandCard({ name, src, width, height, variant = 'payment', mark, href, label }: FooterBrandCardProps) {
  const className = `sf-footer-brand-card sf-footer-brand-card--${variant} sf-footer-mark--${mark}`;
  const image = <Image src={src} alt={name} width={width} height={height} className="sf-footer-brand-image" />;
  return href
    ? <a href={href} target="_blank" rel="noopener noreferrer" aria-label={label} className={className}>{image}</a>
    : <span className={className}>{image}</span>;
}
