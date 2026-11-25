export type SignatureStyle =
  | "vanilla-custard"
  | "chocolate-custard"
  | "mocha"
  | "mille-feuille"
  | "cream-puffs-strawberry-tart"
  | "chocolate-tart";

export interface Cake {
  id: string;
  name: string;
  category: string;
  description: string;
  image: string;
  alt: string;
  featured?: boolean;
  price?: string | null;
  signatureStyle?: SignatureStyle;
  sampleImage?: boolean;
}

export const categories: string[] = [
  "All cakes",
  "Signature cakes",
  "Celebration",
  "Birthday",
  "Wedding",
  "Custom cakes",
  "Pastries",
];

// Signature family names were provided by Season Cake; their images are illustrative samples.
// The remaining cake entries are development examples, not a confirmed menu.
export const cakes: Cake[] = [
  {
    id: "vanilla-custard",
    name: "Vanilla Custard",
    category: "Signature cakes",
    description: "Ask the bakery for product details and availability.",
    image:
      "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=960&q=85",
    alt: "Illustrative sample photo only; approved Vanilla Custard photography has not been supplied",
    signatureStyle: "vanilla-custard",
    sampleImage: true,
  },
  {
    id: "chocolate-custard",
    name: "Chocolate Custard",
    category: "Signature cakes",
    description: "Ask the bakery for product details and availability.",
    image:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=960&q=85",
    alt: "Illustrative sample photo only; approved Chocolate Custard photography has not been supplied",
    signatureStyle: "chocolate-custard",
    sampleImage: true,
  },
  {
    id: "mocha",
    name: "Mocha",
    category: "Signature cakes",
    description: "Ask the bakery for product details and availability.",
    image:
      "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=960&q=85",
    alt: "Illustrative sample photo only; approved Mocha photography has not been supplied",
    signatureStyle: "mocha",
    sampleImage: true,
  },
  {
    id: "mille-feuille",
    name: "Mille-feuille",
    category: "Signature cakes",
    description: "Ask the bakery for product details and availability.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=960&q=85",
    alt: "Illustrative sample photo only; approved Mille-feuille photography has not been supplied",
    signatureStyle: "mille-feuille",
    sampleImage: true,
  },
  {
    id: "cream-puffs-strawberry-tart",
    name: "Cream Puffs and Strawberry Tart",
    category: "Signature cakes",
    description: "Ask the bakery for product details and availability.",
    image:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=960&q=85",
    alt: "Illustrative sample photo only; approved Cream Puffs and Strawberry Tart photography has not been supplied",
    signatureStyle: "cream-puffs-strawberry-tart",
    sampleImage: true,
  },
  {
    id: "chocolate-tart",
    name: "Chocolate Tart",
    category: "Signature cakes",
    description: "Ask the bakery for product details and availability.",
    image:
      "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=960&q=85",
    alt: "Illustrative sample photo only; approved Chocolate Tart photography has not been supplied",
    signatureStyle: "chocolate-tart",
    sampleImage: true,
  },
  {
    id: "rose-cloud",
    name: "Rose cloud",
    category: "Celebration",
    description:
      "A softly finished celebration cake with delicate floral details. Ask us about available flavours and sizes.",
    image:
      "https://images.unsplash.com/photo-1578985545062-69928b1d9587?auto=format&fit=crop&w=960&q=85",
    alt: "Layered celebration cake decorated with soft pink frosting",
    featured: true,
  },
  {
    id: "golden-hour",
    name: "Golden hour",
    category: "Birthday",
    description:
      "A joyful centrepiece for a birthday table, finished with a warm, celebratory touch.",
    image:
      "https://images.unsplash.com/photo-1558636508-e0db3814bd1d?auto=format&fit=crop&w=960&q=85",
    alt: "Small frosted cake with colourful birthday decorations",
    featured: true,
  },
  {
    id: "the-gathering",
    name: "The gathering",
    category: "Wedding",
    description:
      "A refined tiered-cake direction for a day worth remembering. Every detail is made to order.",
    image:
      "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=960&q=85",
    alt: "Elegant white tiered cake for a wedding celebration",
  },
  {
    id: "little-moment",
    name: "Little moment",
    category: "Custom cakes",
    description:
      "A personal cake idea, shaped around your occasion, colours, and favourite details.",
    image:
      "https://images.unsplash.com/photo-1571115177098-24ec42ed204d?auto=format&fit=crop&w=960&q=85",
    alt: "Close-up of a handcrafted cake finished with smooth cream",
    featured: true,
  },
  {
    id: "berry-and-cream",
    name: "Berry & cream",
    category: "Celebration",
    description:
      "Fresh-looking berries and generous cream make a lovely choice for sharing.",
    image:
      "https://images.unsplash.com/photo-1565958011703-44f9829ba187?auto=format&fit=crop&w=960&q=85",
    alt: "Fresh berry cake topped with strawberries and blueberries",
  },
  {
    id: "afternoon-pastry",
    name: "Afternoon pastry",
    category: "Pastries",
    description:
      "A little something sweet for the everyday. Please ask the bakery about availability.",
    image:
      "https://images.unsplash.com/photo-1488477181946-6428a0291777?auto=format&fit=crop&w=960&q=85",
    alt: "Small pastries arranged on a serving plate",
  },
];

export const signatureCakes = cakes.filter((cake) => cake.signatureStyle);

export interface GalleryImage {
  image: string;
  alt: string;
}

export const galleryImages: GalleryImage[] = [
  {
    image:
      "https://images.unsplash.com/photo-1558301211-0d8c8ddee6ec?auto=format&fit=crop&w=1000&q=85",
    alt: "Carefully decorated cake with a soft buttercream finish",
  },
  {
    image:
      "https://images.unsplash.com/photo-1542826438-bd32f43d626f?auto=format&fit=crop&w=1000&q=85",
    alt: "A layered cake ready to be shared",
  },
  {
    image:
      "https://images.unsplash.com/photo-1535141192574-5d4897c12636?auto=format&fit=crop&w=1000&q=85",
    alt: "Celebration cake with delicate piped frosting",
  },
  {
    image:
      "https://images.unsplash.com/photo-1464349095431-e9a21285b5f3?auto=format&fit=crop&w=1000&q=85",
    alt: "A decorated cake set out for a celebration",
  },
  {
    image:
      "https://images.unsplash.com/photo-1563729784474-d77dbb933a9e?auto=format&fit=crop&w=1000&q=85",
    alt: "Small pastries and a freshly baked sweet",
  },
];

export const business = {
  phone: "",
  email: "",
  address: "",
  openingHours: "",
  instagram: "",
  facebook: "",
};

export const businessPlaceholders = {
  phone: "Business phone to be added",
  email: "Business email to be added",
  address: "Business address to be added",
  openingHours: "Opening hours to be added",
};
