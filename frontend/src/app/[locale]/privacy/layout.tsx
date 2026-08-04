import type { Metadata } from 'next';
import NoIndexLayout from '@/components/seo/NoIndexLayout';
import { NOINDEX_ROBOTS } from '@/lib/seo/policy';

// Remains noindex until the legal-compliance specification supplies an
// approved, versioned privacy policy.
export const metadata: Metadata = { robots: NOINDEX_ROBOTS };
export default NoIndexLayout;
