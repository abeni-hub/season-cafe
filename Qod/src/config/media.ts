export interface MediaAsset {
  src: string;
  srcSmall: string;
  width: number;
  height: number;
  alt: string;
}

export interface ProductMediaMeta extends MediaAsset {
  slug: string;
  artIndex: number;
  category: string;
  note: string;
}

export const PRODUCT_MEDIA: ProductMediaMeta[] = [
  {
    slug: 'vanilla-custard',
    artIndex: 0,
    src: '/images/products/vanilla-custard.webp',
    srcSmall: '/images/products/vanilla-custard-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Vanilla Custard tartlet with speckled vanilla bean custard and whipped cream quenelle on stoneware',
    category: 'Custard',
    note: 'Madagascar vanilla bean & crisp pastry shell',
  },
  {
    slug: 'chocolate-custard',
    artIndex: 1,
    src: '/images/products/chocolate-custard.webp',
    srcSmall: '/images/products/chocolate-custard-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Chocolate Custard tartlet in cocoa pastry topped with whipped cream and fine cocoa dusting',
    category: 'Custard',
    note: 'Dark chocolate custard & cocoa crust',
  },
  {
    slug: 'mocha',
    artIndex: 2,
    src: '/images/products/mocha.webp',
    srcSmall: '/images/products/mocha-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Mocha espresso custard tartlet dusted with cocoa and garnished with roasted coffee beans',
    category: 'Custard',
    note: 'Espresso infusion & cocoa dust',
  },
  {
    slug: 'mille-feuille',
    artIndex: 3,
    src: '/images/products/mille-feuille.webp',
    srcSmall: '/images/products/mille-feuille-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Hand-laminated Mille-feuille with three crisp puff pastry layers, vanilla diplomat cream, and feathered glaze',
    category: 'Pastry',
    note: 'Laminated butter pastry & diplomat cream',
  },
  {
    slug: 'cream-puffs',
    artIndex: 4,
    src: '/images/products/cream-puffs.webp',
    srcSmall: '/images/products/cream-puffs-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Box of six golden craquelin Cream Puffs filled with vanilla bean cream and dusted with sugar',
    category: 'Choux',
    note: 'Filled to order · box of six',
  },
  {
    slug: 'strawberry-tart',
    artIndex: 5,
    src: '/images/products/strawberry-tart.webp',
    srcSmall: '/images/products/strawberry-tart-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Strawberry Tart with fresh sliced berries and mint over vanilla pastry cream in a golden fluted shell',
    category: 'Fruit Tart',
    note: 'Seasonal berries & vanilla crème pâtissière',
  },
  {
    slug: 'chocolate-tart',
    artIndex: 6,
    src: '/images/products/chocolate-tart.webp',
    srcSmall: '/images/products/chocolate-tart-sm.webp',
    width: 1000,
    height: 747,
    alt: 'Chocolate Tart filled with glossy dark ganache and flaky sea salt on matte stoneware',
    category: 'Ganache Tart',
    note: 'Bittersweet ganache & sea salt finish',
  },
];

export const EDITORIAL_MEDIA = {
  hero: {
    src: '/images/editorial/hero-patisserie.webp',
    srcSmall: '/images/editorial/hero-patisserie-sm.webp',
    width: 1376,
    height: 768,
    alt: 'Sunlit Seasons Cake patisserie spread with mille-feuille, strawberry tart, and vanilla custard on linen',
  },
  brandCraft: {
    src: '/images/editorial/brand-craft.webp',
    srcSmall: '/images/editorial/brand-craft-sm.webp',
    width: 1200,
    height: 896,
    alt: 'Baker hands piping smooth vanilla bean cream onto laminated puff pastry on a marble workbench',
  },
  customCelebration: {
    src: '/images/editorial/custom-celebration.webp',
    srcSmall: '/images/editorial/custom-celebration-sm.webp',
    width: 896,
    height: 1200,
    alt: 'Three-tier ivory buttercream bespoke celebration cake adorned with pressed botanical foliage and terracotta florals',
  },
  cafeCounter: {
    src: '/images/editorial/cafe-counter.webp',
    srcSmall: '/images/editorial/cafe-counter-sm.webp',
    width: 1376,
    height: 768,
    alt: 'Seasons Cake botanical café counter with fluted oak cabinetry, glass pastry cloches, and potted olive tree',
  },
  giftPackaging: {
    src: '/images/editorial/gift-packaging.webp',
    srcSmall: '/images/editorial/gift-packaging-sm.webp',
    width: 1200,
    height: 896,
    alt: 'Natural kraft pastry boxes tied with twine and filled with cream puffs and chocolate tarts on marble',
  },
} as const satisfies Record<string, MediaAsset>;

export type GalleryCategory = 'all' | 'counter' | 'craft' | 'celebration';

export interface GalleryItem {
  id: string;
  category: Exclude<GalleryCategory, 'all'>;
  label: string;
  asset: MediaAsset;
  fallbackCaption: string;
}

export const GALLERY_MEDIA: GalleryItem[] = [
  {
    id: 'gal-cafe',
    category: 'craft',
    label: 'The café counter',
    asset: EDITORIAL_MEDIA.cafeCounter,
    fallbackCaption: 'Morning display under glass cloches at the café counter.',
  },
  {
    id: 'gal-mille',
    category: 'counter',
    label: 'Mille-feuille',
    asset: PRODUCT_MEDIA[3],
    fallbackCaption: 'Hand-laminated pastry layered with Madagascar vanilla cream.',
  },
  {
    id: 'gal-craft',
    category: 'craft',
    label: 'Home bakery bench',
    asset: EDITORIAL_MEDIA.brandCraft,
    fallbackCaption: 'Piped to order in small morning batches.',
  },
  {
    id: 'gal-custom',
    category: 'celebration',
    label: 'Bespoke celebration',
    asset: EDITORIAL_MEDIA.customCelebration,
    fallbackCaption: 'Three-tier botanical celebration work quoted to brief.',
  },
  {
    id: 'gal-strawberry',
    category: 'counter',
    label: 'Strawberry Tart',
    asset: PRODUCT_MEDIA[5],
    fallbackCaption: 'Seasonal berries glazed over crisp shortcrust pastry.',
  },
  {
    id: 'gal-packaging',
    category: 'celebration',
    label: 'Gifting & corporate boxes',
    asset: EDITORIAL_MEDIA.giftPackaging,
    fallbackCaption: 'Counter and corporate gifting packed in natural kraft boxes.',
  },
  {
    id: 'gal-puffs',
    category: 'counter',
    label: 'Cream Puffs',
    asset: PRODUCT_MEDIA[4],
    fallbackCaption: 'Choux craquelin filled at the counter, boxed by the half-dozen.',
  },
  {
    id: 'gal-mocha',
    category: 'counter',
    label: 'Mocha & Espresso',
    asset: PRODUCT_MEDIA[2],
    fallbackCaption: 'Espresso custard paired with morning coffee.',
  },
];

export function resolveProductMedia(slug?: string, artIndex?: number): ProductMediaMeta {
  const bySlug = slug ? PRODUCT_MEDIA.find((item) => item.slug === slug) : undefined;
  if (bySlug) return bySlug;
  const idx = typeof artIndex === 'number' ? Math.abs(artIndex) % PRODUCT_MEDIA.length : 0;
  return PRODUCT_MEDIA[idx];
}
