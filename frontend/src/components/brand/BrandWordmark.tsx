import Image from 'next/image';
import './brand-wordmark.css';

interface BrandWordmarkProps {
  alt?: string;
  className?: string;
  priority?: boolean;
}

export default function BrandWordmark({ alt = 'PLEXORIA', className, priority = false }: BrandWordmarkProps) {
  return <Image src="/plexoria-wordmark.svg" alt={alt} width={224} height={44} className={className} priority={priority} unoptimized />;
}
