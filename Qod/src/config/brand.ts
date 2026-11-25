export const BRAND = {
  name: 'Seasons Cake',
  shortName: 'Seasons',
  tagline: 'Delicious & Fresh',
  description:
    'A botanical artisan bakery serving custards, mille-feuille, cream puffs and tarts from a home bakery and café.',
  logoPath: '/brand/season-cake-logo.png',
};

export const DEMO_NOTE =
  'Demo mode — this build runs against a local demo data adapter. Records are stored in your browser, not a production database.';

export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';
export const HAS_REMOTE_API = API_BASE_URL.trim().length > 0;

export const PRODUCT_ICONS = [
  'custard',
  'chocolate',
  'coffee',
  'layers',
  'puffs',
  'strawberry',
  'cocoa',
] as const;

export const LOW_STOCK_MESSAGE = 'Items below their reorder level across all locations.';
