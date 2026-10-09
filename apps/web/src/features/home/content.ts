import type { ProductSummary } from '../catalog/types.ts';
import type { HomeContent } from './types.ts';

/**
 * Placeholder homepage content (storefront-homepage design D2). Products,
 * the look, and the lookbook stand in for catalog/lookbook data
 * that does not exist yet; prices use IDR as a stand-in currency, in ISO 4217
 * minor units (2 digits for IDR), so 89900000 is Rp 899.000.
 * Read it only through getHomeContent().
 */

const product = (slug: string, name: string, color: string, rupiah: number): ProductSummary => ({
  slug,
  name,
  color,
  price: { amount: rupiah * 100, currency: 'IDR' },
  image: null,
  hoverImage: null,
});

const overdraftHoodie = product('overdraft-hoodie', 'Overdraft Hoodie', 'Washed Black', 899_000);
const inflationTee = product('inflation-tee', 'Inflation Tee', 'Off-White', 349_000);
const minimumWageCargo = product('minimum-wage-cargo', 'Minimum Wage Cargo', 'Stone Grey', 799_000);
const rentDueJacket = product('rent-due-coach-jacket', 'Rent Due Coach Jacket', 'Black', 1_299_000);

export const HOME_CONTENT: HomeContent = {
  hero: {
    headline: 'IN THIS ECONOMY',
    collection: 'COLLECTION 001',
    campaign: 'COST OF LIVING',
    supportingLine: 'Clothing for the world we’re living in.',
    cta: { label: 'SHOP THE DROP', href: '/drops' },
    visual: { image: null, placeholderLabel: 'CAMPAIGN — COST OF LIVING' },
  },
  // The featured drop comes from the store drops API (see getHomeContent).
  drop: null,
  featured: {
    heading: 'Featured',
    products: [overdraftHoodie, inflationTee, minimumWageCargo, rentDueJacket],
    cta: { label: 'SHOP ALL', href: '/shop' },
  },
  campaign: {
    title: 'PRICED IN',
    copy: 'Heavyweight basics cut for long days and short budgets. Built to outlast the trend cycle.',
    visual: { image: null, placeholderLabel: 'EDITORIAL — PRICED IN' },
  },
  look: {
    heading: 'Shop the look',
    visual: { image: null, placeholderLabel: 'LOOK 01' },
    items: [
      { product: rentDueJacket, position: { x: 48, y: 30 } },
      { product: inflationTee, position: { x: 52, y: 44 } },
      { product: minimumWageCargo, position: { x: 46, y: 72 } },
    ],
    cta: { label: 'SHOP THE LOOK', href: '/lookbook' },
  },
  newArrivals: {
    heading: 'New arrivals',
    products: [
      product('side-hustle-crewneck', 'Side Hustle Crewneck', 'Heather Grey', 649_000),
      product('budget-cut-shorts', 'Budget Cut Shorts', 'Black', 429_000),
      product('price-tag-cap', 'Price Tag Cap', 'Off-White', 279_000),
      product('fixed-income-overshirt', 'Fixed Income Overshirt', 'Charcoal', 749_000),
      product('receipt-long-sleeve', 'Receipt Long Sleeve', 'White', 399_000),
    ],
  },
  lookbook: {
    heading: 'Lookbook',
    visuals: [
      { image: null, placeholderLabel: 'LOOKBOOK 01' },
      { image: null, placeholderLabel: 'LOOKBOOK 02' },
      { image: null, placeholderLabel: 'LOOKBOOK 03' },
    ],
    cta: { label: 'VIEW LOOKBOOK', href: '/lookbook' },
  },
  manifesto: {
    headline: 'OUR ECONOMY.',
    copy: 'Clothing for the world we’re living in.',
    cta: { label: 'READ OUR STORY', href: '/story' },
  },
  newsletter: {
    heading: 'Newsletter',
    copy: 'Drop dates and restocks, first. No noise.',
  },
};
