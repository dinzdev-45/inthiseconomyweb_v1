/*
 * Size guides (product-detail design D5). PLACEHOLDER CONTENT: the measurements below are
 * stand-ins until the brand supplies real ones; replacing them needs no other code change.
 * A guide is chosen by the sizing system of the product's sizes, not by category.
 */

export type SizeGuideSystem = 'letters' | 'waist' | 'one-size';

export type SizeGuide = {
  system: SizeGuideSystem;
  caption: string;
  /** Measurement column headers, each naming its unit. */
  columns: string[];
  /** One row per size the product offers, in the product's size order. */
  rows: { size: string; values: string[] }[];
  note?: string;
};

type Table = { caption: string; columns: string[]; sizes: Record<string, string[]> };

const TABLES: Record<SizeGuideSystem, Table> = {
  letters: {
    caption: 'Tops: body measurements of the garment, laid flat',
    columns: ['Chest (cm)', 'Length (cm)', 'Sleeve (cm)'],
    sizes: {
      XS: ['50', '66', '60'],
      S: ['53', '69', '61'],
      M: ['56', '72', '62'],
      L: ['59', '75', '63'],
      XL: ['62', '78', '64'],
      XXL: ['65', '80', '65'],
    },
  },
  waist: {
    caption: 'Bottoms: garment measurements',
    columns: ['Waist (cm)', 'Inseam (cm)', 'Leg opening (cm)'],
    sizes: {
      '28': ['72', '76', '19'],
      '30': ['77', '78', '20'],
      '32': ['82', '80', '21'],
      '34': ['87', '81', '22'],
      '36': ['92', '82', '23'],
    },
  },
  'one-size': {
    caption: 'One size',
    columns: ['Circumference (cm)'],
    sizes: { OS: ['56–60, adjustable'] },
  },
};

/** The sizing system all of `codes` belong to, or null for an empty or mixed set. */
export function sizingSystem(codes: readonly string[]): SizeGuideSystem | null {
  if (codes.length === 0) return null;
  for (const system of ['letters', 'waist', 'one-size'] as const) {
    if (codes.every((code) => code in TABLES[system].sizes)) return system;
  }
  return null;
}

/** The size guide for a product's sizes (codes in display order), or null when none fits. */
export function sizeGuideFor(codes: readonly string[]): SizeGuide | null {
  const system = sizingSystem(codes);
  if (!system) return null;
  const table = TABLES[system];
  return {
    system,
    caption: table.caption,
    columns: table.columns,
    rows: codes.map((code) => ({ size: code, values: table.sizes[code]! })),
    ...(system === 'one-size' ? { note: 'This item is one size.' } : {}),
  };
}
