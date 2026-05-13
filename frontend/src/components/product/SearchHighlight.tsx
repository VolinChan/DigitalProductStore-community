'use client';

import React from 'react';

interface SearchHighlightProps {
  text: string;
  query: string;
  /** Maximum number of characters to display. Truncates with ellipsis if exceeded. */
  maxLength?: number;
  /** CSS class for the highlighted segments */
  highlightClassName?: string;
}

/**
 * Component that highlights search terms within text.
 * Requirement 22.7: Highlight search terms in search results for better visibility.
 *
 * Splits the text by the search query (case-insensitive) and wraps matching
 * segments in a styled <mark> element.
 */
export default function SearchHighlight({
  text,
  query,
  maxLength,
  highlightClassName = 'bg-yellow-200 text-yellow-900 rounded-sm px-0.5',
}: SearchHighlightProps) {
  if (!text) return null;

  // Truncate text if maxLength is specified
  const displayText = maxLength && text.length > maxLength
    ? text.slice(0, maxLength) + '...'
    : text;

  // If no query, just return the text
  if (!query || !query.trim()) {
    return <span>{displayText}</span>;
  }

  const trimmedQuery = query.trim();

  // Escape special regex characters in the query
  const escapedQuery = escapeRegExp(trimmedQuery);

  // Split text by the query (case-insensitive), keeping the matched parts
  const parts = displayText.split(new RegExp(`(${escapedQuery})`, 'gi'));

  if (parts.length === 1) {
    // No match found
    return <span>{displayText}</span>;
  }

  return (
    <span>
      {parts.map((part, index) => {
        const isMatch = part.toLowerCase() === trimmedQuery.toLowerCase();
        return isMatch ? (
          <mark key={index} className={highlightClassName}>
            {part}
          </mark>
        ) : (
          <span key={index}>{part}</span>
        );
      })}
    </span>
  );
}

/**
 * Escapes special regex characters in a string.
 * Each special character is prefixed with a backslash.
 */
function escapeRegExp(str: string): string {
  const specialChars = /[.*+?^${}()|[\]\\]/g;
  return str.replace(specialChars, (match) => '\\' + match);
}
