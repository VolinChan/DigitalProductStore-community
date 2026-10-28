'use client';

import type { ComponentProps, FocusEventHandler } from 'react';
import Link from 'next/link';
import { CategoryIcon } from './CategoryIcon';
import styles from './CategoryTile.module.css';

type CategoryTileProps = Pick<ComponentProps<typeof CategoryIcon>, 'imageUrl' | 'ancestorImageUrls' | 'iconKey' | 'ancestorKeys'> & {
  href: string;
  label: string;
  imageLabel?: string;
  countLabel?: string;
  size?: 'compact' | 'directory';
  onFocus?: FocusEventHandler<HTMLAnchorElement>;
};

export default function CategoryTile({ href, label, imageLabel = label, countLabel, size = 'compact', onFocus, ...iconProps }: CategoryTileProps) {
  return (
    <Link href={href} onFocus={onFocus} className={`${styles.tile} ${size === 'directory' ? styles.directory : ''}`}>
      <CategoryIcon {...iconProps} label={imageLabel} className={styles.icon} />
      {size === 'directory' ? (
        <div className={styles.details}>
          <h2 className={styles.label}>{label}</h2>
          {countLabel !== undefined && <p className={styles.count}>{countLabel}</p>}
        </div>
      ) : <span className={styles.label}>{label}</span>}
    </Link>
  );
}
