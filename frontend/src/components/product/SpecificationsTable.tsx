import type { ProductSpecification } from '@/types';

export default function SpecificationsTable({ structured = [], specifications, title }: { structured?: ProductSpecification[]; specifications?: string; title: string }) {
  const populated = structured.filter((item) => item.value_text?.trim() || item.value_number !== undefined);
  if (populated.length > 0) {
    const groups = new Map<string, ProductSpecification[]>();
    populated.sort((a, b) => a.group_name.localeCompare(b.group_name) || a.sort_order - b.sort_order).forEach((item) => {
      const group = item.group_name || 'General';
      groups.set(group, [...(groups.get(group) || []), item]);
    });
    return <div className="max-w-4xl"><h2 className="text-2xl font-black text-[var(--sf-ink)]">{title}</h2><div className="mt-5 space-y-7">{[...groups.entries()].map(([group, rows]) => <section key={group}><h3 className="mb-2 text-sm font-black text-[var(--sf-subtle)]">{group}</h3><dl className="overflow-hidden rounded-[18px] border border-[var(--sf-line)] text-sm">{rows.map((item, index) => <div key={`${group}-${item.spec_key}`} className={`grid grid-cols-[minmax(0,42%)_minmax(0,58%)] ${index % 2 === 0 ? 'bg-[#f7f8f6]' : 'bg-white'}`}><dt className="break-words border-r border-[var(--sf-line)] px-3 py-3 font-bold text-[var(--sf-ink)] sm:px-4">{item.label}</dt><dd className="min-w-0 break-words px-3 py-3 text-[var(--sf-subtle)] sm:px-4">{item.value_text ?? item.value_number}{item.unit ? ` ${item.unit}` : ''}</dd></div>)}</dl></section>)}</div></div>;
  }
  if (!specifications) return null;
  try {
    const parsed = JSON.parse(specifications);
    if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
      const entries = Object.entries(parsed);
      return entries.length ? <div className="max-w-4xl"><h2 className="text-2xl font-black text-[var(--sf-ink)]">{title}</h2><dl className="mt-5 overflow-hidden rounded-[18px] border border-[var(--sf-line)] text-sm">{entries.map(([key, value], index) => <div key={key} className={`grid grid-cols-[minmax(0,42%)_minmax(0,58%)] ${index % 2 === 0 ? 'bg-[#f7f8f6]' : 'bg-white'}`}><dt className="break-words border-r border-[var(--sf-line)] px-3 py-3 font-bold text-[var(--sf-ink)] sm:px-4">{key}</dt><dd className="break-words px-3 py-3 text-[var(--sf-subtle)] sm:px-4">{String(value)}</dd></div>)}</dl></div> : null;
    }
  } catch { /* render plain text below */ }
  return <div className="max-w-4xl"><h2 className="text-2xl font-black text-[var(--sf-ink)]">{title}</h2><p className="mt-4 whitespace-pre-wrap text-sm leading-7 text-[var(--sf-subtle)]">{specifications}</p></div>;
}
