import type { Metadata } from 'next';
import NoIndexLayout from '@/components/seo/NoIndexLayout';
import { NOINDEX_ROBOTS } from '@/lib/seo/policy';

// Remains noindex until the legal-compliance specification approves policy text.
export const metadata: Metadata = { robots: NOINDEX_ROBOTS };
export default NoIndexLayout;
