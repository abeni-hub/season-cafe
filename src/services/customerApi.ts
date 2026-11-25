export interface OrderRequest {
  customerName: string;
  phone: string;
  email?: string;
  cakeId: string;
  size: string;
  quantity: number;
  instructions?: string;
  fulfillment: "pickup" | "delivery";
  requestedDate: string;
  deliveryAddress?: string;
  idempotencyKey: string;
}

export interface ContactRequest {
  name: string;
  email: string;
  phone?: string;
  subject?: string;
  message: string;
  idempotencyKey: string;
}

export interface PublicWebsiteProduct {
  id: string;
  name: string;
  description: string;
  image: string;
  image_alt: string;
  category: string;
  category_id: number | null;
  price: string | null;
  featured: boolean;
}

export interface PublicWebsiteSettings {
  site_name: string;
  hero_eyebrow: string;
  hero_title: string;
  hero_body: string;
  hero_image: string;
  hero_image_alt: string;
  hero_cta_label: string;
  hero_cta_url: string;
  about_eyebrow: string;
  about_title: string;
  about_body: string;
  about_image: string;
  about_image_alt: string;
  menu_eyebrow: string;
  menu_title: string;
  menu_body: string;
  featured_eyebrow: string;
  featured_title: string;
  featured_body: string;
  gallery_eyebrow: string;
  gallery_title: string;
  gallery_body: string;
  trust_eyebrow: string;
  trust_title: string;
  trust_body: string;
  contact_eyebrow: string;
  contact_title: string;
  contact_body: string;
  phone: string;
  email: string;
  address: string;
  opening_hours: string;
  instagram_url: string;
  facebook_url: string;
}

export interface PublicWebsiteContent {
  cms_active: boolean;
  settings?: PublicWebsiteSettings | null;
  categories?: Array<{ id: number; name: string; sort_order: number }>;
  products?: PublicWebsiteProduct[];
  banners?: Array<{
    id: number;
    eyebrow: string;
    title: string;
    body: string;
    image: string;
    image_alt: string;
    cta_label: string;
    cta_url: string;
    sort_order: number;
  }>;
  sections?: Array<{
    id: number;
    slug: string;
    kind: "content" | "promotion";
    eyebrow: string;
    title: string;
    body: string;
    image: string;
    image_alt: string;
    cta_label: string;
    cta_url: string;
    sort_order: number;
  }>;
  gallery?: Array<{ id: number; image: string; alt_text: string; sort_order: number }>;
  testimonials?: Array<{ id: number; quote: string; customer_name: string; sort_order: number }>;
}

function formatApiError(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value;
  if (Array.isArray(value)) {
    return value.map(formatApiError).filter(Boolean).join(" ");
  }
  if (value && typeof value === "object") {
    return Object.values(value)
      .map(formatApiError)
      .filter(Boolean)
      .join(" ");
  }
  return undefined;
}

function apiUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim();
  if (!baseUrl) return path;
  return `${baseUrl.replace(/\/+$/, "")}${path}`;
}

function isJsonResponse(response: Response): boolean {
  return response.headers.get("content-type")?.toLowerCase().includes("json") ?? false;
}

async function postJson<T>(path: string, payload: T): Promise<void> {
  let response: Response;
  try {
    response = await fetch(apiUrl(path), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    throw new Error("The request could not reach the bakery service. Nothing has been sent.");
  }

  if (!isJsonResponse(response)) {
    throw new Error("The bakery service returned a web page instead of an API response. Check the API proxy configuration.");
  }

  if (!response.ok) {
    const body: unknown = await response.json().catch(() => null);
    const detail = formatApiError(body);
    throw new Error(
      detail ?? `The request could not be sent (server returned ${response.status}). Please try again later.`,
    );
  }
}

export async function getPublicWebsite(): Promise<PublicWebsiteContent> {
  let response: Response;
  try {
    response = await fetch(apiUrl("/api/v1/public/site/"));
  } catch {
    throw new Error("The bakery website could not connect to its content service.");
  }
  if (!isJsonResponse(response)) {
    throw new Error("The public website received a web page instead of API data. Rebuild the website so API requests reach Django.");
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") {
    const detail = formatApiError(body);
    throw new Error(
      detail ?? (response.ok
        ? "The content service returned invalid JSON."
        : `Website content could not be loaded (server returned ${response.status}).`),
    );
  }
  return body as PublicWebsiteContent;
}

export function submitOrder(order: OrderRequest): Promise<void> {
  return postJson("/orders", order);
}

export function submitContactMessage(
  message: ContactRequest,
): Promise<void> {
  return postJson("/api/v1/public/inquiries/", message);
}
