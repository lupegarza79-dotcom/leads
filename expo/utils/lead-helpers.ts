import type { Lead } from '@/types/leads';

export const TOP_CARRIERS = [
  'Progressive',
  'GEICO',
  'State Farm',
  'Allstate',
  'Bristol West',
  'National General',
] as const;

export const CARRIERS = TOP_CARRIERS;
export type Carrier = (typeof TOP_CARRIERS)[number];

const QUOTE_FIELDS: (keyof Lead)[] = [
  'carrier',
  'quote_price',
  'effective_date',
  'down_payment',
  'monthly_payment',
];

export function isLeadIncomplete(lead: Lead): boolean {
  if (lead.status === 'Lost') return false;
  if (lead.status === 'New' || lead.status === 'Contacted') return false;

  const missing = QUOTE_FIELDS.filter(f => {
    const val = lead[f];
    return val === null || val === undefined || val === '';
  });

  return missing.length >= 3;
}

export function getMissingQuoteFields(lead: Lead): string[] {
  const labels: Record<string, string> = {
    carrier: 'Carrier',
    quote_price: 'Quote Price',
    effective_date: 'Effective Date',
    down_payment: 'Down Payment',
    monthly_payment: 'Monthly Payment',
  };

  return QUOTE_FIELDS
    .filter(f => {
      const val = lead[f];
      return val === null || val === undefined || val === '';
    })
    .map(f => labels[f] ?? f);
}
