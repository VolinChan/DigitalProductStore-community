import { ThunderboltOutlined } from '@ant-design/icons';

interface BrandMarkProps {
  inverse?: boolean;
  className?: string;
}

export default function BrandMark({ inverse = false, className = '' }: BrandMarkProps) {
  return (
    <span
      aria-hidden="true"
      className={`relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-xl ${
        inverse ? 'bg-white text-[var(--sf-brand)]' : 'bg-[var(--sf-brand)] text-white'
      } ${className}`}
    >
      <span className="absolute -right-2 -top-2 h-5 w-5 rounded-full bg-[var(--sf-aqua)]" />
      <ThunderboltOutlined className="relative text-[18px]" />
    </span>
  );
}
