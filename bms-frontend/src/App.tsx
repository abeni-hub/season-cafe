import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowDownLeft,
  ArrowLeftRight,
  BookOpenText,
  Boxes,
  ChartNoAxesCombined,
  ClipboardList,
  CookingPot,
  Download,
  Globe,
  LogOut,
  MessageCircle,
  Menu,
  PackageCheck,
  ReceiptText,
  ScrollText,
  ShieldCheck,
  ShoppingBasket,
  Store,
  Users,
  X,
} from "lucide-react";
import { Navigate, Route, Routes, useNavigate, useParams } from "react-router-dom";
import { api, getList, refreshCsrfToken, signIn, signOut } from "./api";
import type { PortalUser } from "./api";
import { Button } from "./components/ui/button";
import { ReportFiltersPanel } from "./components/ReportFiltersPanel";
import type { ReportEmployee, ReportFilters } from "./components/ReportFiltersPanel";
import { CatalogPanel } from "./components/CatalogPanel";
import type { CatalogCategory, CatalogIngredient, CatalogProduct } from "./components/CatalogPanel";
import { RecipesPanel } from "./components/RecipesPanel";
import type { ManagedRecipe } from "./components/RecipesPanel";
import { SalesPanel } from "./components/SalesPanel";
import { InquiriesPanel } from "./components/InquiriesPanel";
import type { CustomerInquiry } from "./components/InquiriesPanel";
import { WebsitePanel } from "./components/WebsitePanel";
import type {
  WebsiteBanner,
  WebsiteGalleryItem,
  WebsiteSection,
  WebsiteSettings,
  WebsiteTestimonial,
} from "./components/WebsitePanel";
import { OrdersPanel } from "./components/OrdersPanel";
import type { Order as PanelOrder } from "./components/OrdersPanel";
import { InventoryPanel } from "./components/InventoryPanel";
import { ProductionPanel } from "./components/ProductionPanel";
import { PurchasesPanel } from "./components/PurchasesPanel";
import { StaffPanel } from "./components/StaffPanel";
import type { StaffMember } from "./components/StaffPanel";
import { BrandLogo } from "./components/BrandLogo";
import { exportToCsv } from "./utils/exportCsv";

type Module = "overview" | "orders" | "sales" | "inventory" | "production" | "purchases" | "catalog" | "recipes" | "website" | "inquiries" | "reports" | "staff" | "audit";
type Location = { id: number; name: string; kind: "home_bakery" | "cafe" | "other" };
type Product = CatalogProduct;
type Ingredient = CatalogIngredient;
type Order = PanelOrder;
type Sale = {
  id: number; sold_at: string; cashier_name: string; order: number | null; order_number: string;
  status: "active" | "cancelled"; cancellation_reason: string; cancelled_by_name: string; cancelled_at: string | null;
  total: string; amount_paid: string; amount_due: string; amount_refunded: string;
  lines: Array<{ product: number; product_name: string; quantity: number; unit_price: string }>;
  payment_history: Array<{ method: string; amount: string; bank_name: string; payment_date: string; received_by_name: string; received_at: string }>;
  refunds: Array<{ id: number; method: string; amount: string; bank_name: string; refund_date: string; reason: string; refunded_by_name: string; lines: Array<{ product: number; product_name: string; quantity: number }> }>;
};
type Balance = {
  id: number | null; location: number; ingredient?: number; product?: number; quantity: string;
  reserved_quantity: string; available_quantity: string; ingredient_name?: string; product_name?: string;
  unit?: string; category_name?: string; supplier_names?: string[];
};
type Movement = {
  id: number; item_name: string; unit: string; quantity_delta: string; kind: string; actor_name: string;
  location: number; created_at: string; note: string;
};
type StockTransfer = {
  id: number; shipment_id: number | null; source_location: number; destination_location: number; item_name: string;
  quantity: string; received_quantity: string; remaining_quantity: string; created_at: string;
  recorded_by_name: string; received_by_name: string; received_at: string | null; status: string;
  receipts: Array<{ id: number; quantity: string; is_final: boolean; discrepancy_quantity: string; discrepancy_note: string; received_by_name: string; received_at: string }>;
};
type AuditEvent = {
  id: number; location: number | null; location_name: string; actor_name: string;
  action: string; summary: string; target_type: string; target_id: string; created_at: string;
};
type Dashboard = {
  period: string; startDate: string; endDate: string; location: Location | null;
  summary: {
    salesTotal?: string; saleCount?: number; openOrders: number; productionBatches: number;
    ingredientPurchases: number; purchaseSpend?: string; purchasesPendingApproval?: number;
    grossMargin?: string; grossMarginPercent?: string;
    lowIngredientBalances: number; cashCollected?: string;
    telebirrCollected?: string; bankTransferCollected?: string; cakesSold?: number;
    netSalesTotal?: string; refundsTotal?: string; cashRefunded?: string;
    telebirrRefunded?: string; bankTransferRefunded?: string; netPayments?: string;
    bankTransferByBank?: Array<{ bank_name: string; collected: string; refunded: string; net: string }>;
    salesByCake?: Array<{ product: string; quantity: number; sales: string }>;
    productionQuantity?: number; productionWastage?: number;
    productionByCake?: Array<{ product: string; quantity: number; wastage: number }>;
    ingredientConsumption?: Array<{ ingredient: string; quantity: string; unit: string }>;
    ordersCreated?: number;
    newOrdersToday?: number; ordersDueToday?: number; overdueOrders?: number; pendingTransfers?: number;
  };
  locationStock?: Array<{ id: number; name: string; finishedCakes: string; lowIngredients: number }>;
  recentStockMovements?: Movement[];
  recentActivity?: AuditEvent[];
};
type Inventory = { ingredients: Balance[]; products: Balance[] };
type ProductionPlan = {
  product: number; product_name: string; quantity: number; recipe_version: number;
  ingredients: Array<{
    ingredient: number; ingredient_name: string; recipe_quantity: string; recipe_unit: Ingredient["unit"];
    required_quantity: string; unit: Ingredient["unit"]; available_quantity: string; sufficient: boolean;
  }>;
};
type Recipe = ManagedRecipe;
type Purchase = {
  id: number; purchased_at: string; supplier_name: string; note: string; status: string;
  rejection_reason: string; total_cost: string; recorded_by_name: string; approved_by_name: string;
  approved_at: string | null;
  received_lines: Array<{
    ingredient_name: string; quantity: string; unit: Ingredient["unit"];
    stock_quantity: string; stock_unit: Ingredient["unit"]; unit_cost: string; total_cost: string;
  }>;
};
type BusinessSettings = { require_purchase_approval: boolean };
type WorkspaceData = {
  dashboard?: Dashboard;
  orders?: Order[];
  sales?: Sale[];
  salesAvailability?: Array<{ product: number; available_quantity: string }>;
  inventory?: Inventory;
  movements?: Movement[];
  transfers?: StockTransfer[];
  products?: Product[];
  ingredients?: Ingredient[];
  purchases?: Purchase[];
  production?: Array<{
    id: number; product_name: string; quantity: number; produced_at: string;
    finished_quantity: number; adjustment_note: string; wastage_quantity: number; wastage_note: string;
    recipe_version: number | null; estimated_cost: string | null; actual_cost: string | null;
    consumptions: Array<{ ingredient_name: string; quantity: string; unit: string; total_cost: string | null }>;
  }>;
  productionPlan?: ProductionPlan;
  recipes?: Recipe[];
  settings?: BusinessSettings;
  audit?: AuditEvent[];
  suppliers?: Array<{ id: number; name: string }>;
  employees?: ReportEmployee[];
  staff?: StaffMember[];
  categories?: CatalogCategory[];
  websiteSettings?: WebsiteSettings;
  websiteBanners?: WebsiteBanner[];
  websiteSections?: WebsiteSection[];
  websiteGallery?: WebsiteGalleryItem[];
  websiteTestimonials?: WebsiteTestimonial[];
  inquiries?: CustomerInquiry[];
};

const navigation: Array<{ id: Module; label: string; icon: typeof Store; permission: string }> = [
  { id: "overview", label: "Overview", icon: ChartNoAxesCombined, permission: "dashboard" },
  { id: "orders", label: "Customer orders", icon: ClipboardList, permission: "orders" },
  { id: "sales", label: "Sales & payments", icon: ReceiptText, permission: "sales" },
  { id: "inventory", label: "Inventory", icon: Boxes, permission: "inventory" },
  { id: "production", label: "Production", icon: CookingPot, permission: "production" },
  { id: "purchases", label: "Purchases", icon: ShoppingBasket, permission: "purchases" },
  { id: "catalog", label: "Catalog", icon: PackageCheck, permission: "catalog" },
  { id: "recipes", label: "Recipes", icon: BookOpenText, permission: "recipes" },
  { id: "website", label: "Website content", icon: Globe, permission: "website_content" },
  { id: "inquiries", label: "Customer inquiries", icon: MessageCircle, permission: "inquiries" },
  { id: "reports", label: "Reports", icon: Activity, permission: "reports" },
  { id: "staff", label: "Staff & Team", icon: Users, permission: "users" },
  { id: "audit", label: "Audit history", icon: ScrollText, permission: "audit" },
];

function formatMoney(value: string | number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-ET", { style: "currency", currency: "ETB", maximumFractionDigits: 2 }).format(Number(value ?? 0));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ET", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

const loginSchema = z.object({
  username: z.string().trim().min(1, "Enter your username."),
  password: z.string().min(1, "Enter your password."),
});
type LoginValues = z.infer<typeof loginSchema>;

function LoginPage({ onLogin }: { onLogin: (user: PortalUser) => void }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  async function submit(values: LoginValues) {
    setBusy(true);
    setError("");
    try {
      onLogin(await signIn(values.username, values.password));
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-card">
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.25rem" }}>
          <BrandLogo size={74} showTagline={true} />
        </div>
        <p className="eyebrow" style={{ textAlign: "center" }}>Private Business Management System</p>
        <h1>Good morning.<br /><em>Let’s get to work.</em></h1>
        <p className="login-description">Sign in with the account provided by the business owner.</p>
        <form className="portal-form" onSubmit={handleSubmit(submit)}>
          <label>Username<input autoComplete="username" {...register("username")} />{errors.username && <small className="field-error">{errors.username.message}</small>}</label>
          <label>Password<input type="password" autoComplete="current-password" {...register("password")} />{errors.password && <small className="field-error">{errors.password.message}</small>}</label>
          {error && <p className="form-error" role="alert">{error}</p>}
          <Button type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</Button>
        </form>
        <p className="login-footnote"><ShieldCheck size={15} /> Access is limited to authorized staff.</p>
      </section>
    </main>
  );
}

function EmptyState({ title, children }: { title: string; children: React.ReactNode }) {
  return <div className="empty-state"><span className="empty-icon"><PackageCheck size={22} /></span><h3>{title}</h3><p>{children}</p></div>;
}

function DataTable({ headers, children }: { headers: string[]; children: React.ReactNode }) {
  return <div className="table-scroll"><table><thead><tr>{headers.map((header) => <th key={header}>{header}</th>)}</tr></thead><tbody>{children}</tbody></table></div>;
}

function Portal({ user, onSignOut }: { user: PortalUser; onSignOut: () => void }) {
  const { portal } = useParams();
  const [module, setModule] = useState<Module>(
    () => navigation.find((item) => user.permissions.includes(item.permission))?.id ?? "overview",
  );
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("daily");
  const [reportFilters, setReportFilters] = useState<ReportFilters>({
    product: "",
    payment_method: "",
    employee: "",
    start_date: "",
    end_date: "",
  });
  const [locationId, setLocationId] = useState(user.location ? String(user.location.id) : "all");
  const [actionBusy, setActionBusy] = useState(false);
  const [error, setError] = useState("");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const queryClient = useQueryClient();
  const locationsQuery = useQuery({
    queryKey: ["locations", user.id],
    queryFn: () => getList<Location>("/api/locations/"),
  });
  const locations = locationsQuery.data ?? [];

  const selectedLocation = user.role === "owner"
    ? locations.find((location) => String(location.id) === locationId)
    : user.location ?? undefined;
  const locationQuery = selectedLocation ? `?location=${selectedLocation.id}` : "";
  const visibleNavigation = navigation.filter((item) => user.permissions.includes(item.permission));
  const title = navigation.find((item) => item.id === module)?.label ?? "Overview";

  const workspaceQuery = useQuery({
    queryKey: ["workspace", user.id, module, period, selectedLocation?.id ?? "all", reportFilters],
    refetchInterval: ["overview", "orders", "sales", "inventory"].includes(module)
      ? 30_000
      : module === "reports" || module === "purchases"
        ? 60_000
        : false,
    queryFn: async (): Promise<WorkspaceData> => {
      if (module === "overview" || module === "reports") {
        const query = new URLSearchParams({ period });
        if (selectedLocation) query.set("location", String(selectedLocation.id));
        if (module === "reports") {
          if (reportFilters.product) query.set("product", reportFilters.product);
          if (reportFilters.payment_method) query.set("payment_method", reportFilters.payment_method);
          if (reportFilters.employee) query.set("employee", reportFilters.employee);
          if (reportFilters.start_date && reportFilters.end_date) {
            query.set("start_date", reportFilters.start_date);
            query.set("end_date", reportFilters.end_date);
          }
          const [dashboard, products, employees] = await Promise.all([
            api<Dashboard>(`/api/dashboard/?${query.toString()}`),
            getList<Product>("/api/products/"),
            getList<ReportEmployee>("/api/users/"),
          ]);
          return { dashboard, products, employees };
        }
        return { dashboard: await api<Dashboard>(`/api/dashboard/?${query.toString()}`) };
      }
      if (module === "orders") {
        const [orders, products] = await Promise.all([
          getList<Order>(`/api/orders/${locationQuery}`),
          getList<Product>("/api/products/"),
        ]);
        return { orders, products };
      }
      if (module === "sales") {
        const activeCafeLocation = selectedLocation ?? locations.find((l) => l.kind === "cafe") ?? locations[0];
        const activeLocationQuery = activeCafeLocation ? `?location=${activeCafeLocation.id}` : "";
        const [sales, products, orders, availability] = await Promise.all([
          getList<Sale>(`/api/sales/${activeLocationQuery}`),
          getList<Product>("/api/products/"),
          user.permissions.includes("orders")
            ? getList<Order>(`/api/orders/${activeLocationQuery}`)
            : Promise.resolve([]),
          activeCafeLocation
            ? api<{ products: NonNullable<WorkspaceData["salesAvailability"]> }>(`/api/sales/availability/${activeLocationQuery}`)
            : Promise.resolve({ products: [] }),
        ]);
        return { sales, products, orders, salesAvailability: availability.products };
      }
      if (module === "inventory") {
        const [inventory, movements, products, ingredients, transfers] = await Promise.all([
          api<Inventory>(`/api/inventory/${locationQuery}`),
          getList<Movement>(`/api/stock-movements/${locationQuery}`),
          getList<Product>("/api/products/"),
          getList<Ingredient>("/api/ingredients/"),
          user.permissions.includes("transfers")
            ? getList<StockTransfer>(`/api/transfers/${locationQuery}`)
            : Promise.resolve([]),
        ]);
        return {
          inventory,
          movements,
          products,
          ingredients,
          transfers,
        };
      }
      if (module === "production") {
        const [production, products, recipes, inventory] = await Promise.all([
          getList<NonNullable<WorkspaceData["production"]>[number]>(`/api/production/${locationQuery}`),
          getList<Product>("/api/products/"),
          user.permissions.includes("recipes") ? getList<Recipe>("/api/recipes/") : Promise.resolve([]),
          api<Inventory>(`/api/inventory/${locationQuery}`),
        ]);
        return { production, products, recipes, inventory };
      }
      if (module === "purchases") {
        const [purchases, ingredients, suppliers, settings] = await Promise.all([
          getList<Purchase>(`/api/purchases/${locationQuery}`),
          getList<Ingredient>("/api/ingredients/"),
          getList<NonNullable<WorkspaceData["suppliers"]>[number]>("/api/suppliers/"),
          api<BusinessSettings>("/api/business-settings/"),
        ]);
        return { purchases, ingredients, suppliers, settings };
      }
      if (module === "catalog") {
        const [products, ingredients, categories] = await Promise.all([
          getList<Product>("/api/products/"),
          getList<Ingredient>("/api/ingredients/"),
          getList<CatalogCategory>("/api/catalog-categories/"),
        ]);
        return { products, ingredients, categories };
      }
      if (module === "recipes") {
        const [recipes, products, ingredients] = await Promise.all([
          getList<Recipe>("/api/recipes/"),
          getList<Product>("/api/products/"),
          getList<Ingredient>("/api/ingredients/"),
        ]);
        return { recipes, products, ingredients };
      }
      if (module === "website") {
        const [websiteSettings, websiteBanners, websiteSections, websiteGallery, websiteTestimonials] = await Promise.all([
          api<WebsiteSettings>("/api/website/settings/"),
          getList<WebsiteBanner>("/api/website/banners/"),
          getList<WebsiteSection>("/api/website/sections/"),
          getList<WebsiteGalleryItem>("/api/website/gallery/"),
          getList<WebsiteTestimonial>("/api/website/testimonials/"),
        ]);
        return { websiteSettings, websiteBanners, websiteSections, websiteGallery, websiteTestimonials };
      }
      if (module === "inquiries") {
        return { inquiries: await getList<CustomerInquiry>("/api/website/inquiries/") };
      }
      if (module === "staff") {
        return { staff: await getList<StaffMember>("/api/v1/staff/") };
      }
      if (module === "audit") {
        return { audit: await getList<AuditEvent>(`/api/audit/${locationQuery}`) };
      }
      return {};
    },
  });
  const workspace = workspaceQuery.data ?? {};
  const dashboard = workspace.dashboard ?? null;
  const orders = workspace.orders ?? [];
  const sales = workspace.sales ?? [];
  const salesAvailability = workspace.salesAvailability ?? [];
  const inventory = workspace.inventory ?? { ingredients: [], products: [] };
  const movements = workspace.movements ?? [];
  const transfers = workspace.transfers ?? [];
  const products = workspace.products ?? [];
  const ingredients = workspace.ingredients ?? [];
  const suppliers = workspace.suppliers ?? [];
  const purchases = workspace.purchases ?? [];
  const production = workspace.production ?? [];
  const recipes = workspace.recipes ?? [];
  const busy = actionBusy || workspaceQuery.isFetching || locationsQuery.isLoading;
  const queryError = workspaceQuery.error ?? locationsQuery.error;

  async function performAction(action: () => Promise<unknown>): Promise<boolean> {
    setActionBusy(true);
    setError("");
    try {
      await action();
      await queryClient.invalidateQueries({ queryKey: ["workspace", user.id] });
      return true;
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "The action could not be completed.");
      return false;
    } finally {
      setActionBusy(false);
    }
  }

  async function updateOrder(id: number, update: Record<string, string | number>): Promise<boolean> {
    return performAction(() => api(`/api/orders/${id}/`, { method: "PATCH", body: JSON.stringify(update) }));
  }

  if (portal !== user.role) return <Navigate to={`/${user.role}`} replace />;

  return (
    <div className="portal-shell">
      <aside className={`side-rail${mobileNavOpen ? " is-open" : ""}`}>
        <a className="portal-brand" href="/" style={{ padding: "0 6px 20px" }}>
          <BrandLogo size={36} horizontal={true} showTagline={true} />
        </a>
        <div className="rail-caption">WORKSPACE</div>
        <nav aria-label="Business workspace">
          {visibleNavigation.map(({ id, label, icon: Icon }) => (
            <button key={id} className={`rail-link${module === id ? " is-active" : ""}`} onClick={() => { setModule(id); setMobileNavOpen(false); }}>
              <Icon size={17} strokeWidth={1.7} />{label}
            </button>
          ))}
        </nav>
        <div className="rail-bottom">
          <button className="rail-link sign-out" onClick={onSignOut}><LogOut size={17} /> Sign out</button>
          <p>Signed in as <strong>{user.displayName}</strong></p>
        </div>
      </aside>

      <div className="portal-main">
        <header className="top-bar">
          <button className="mobile-nav-toggle" aria-label={mobileNavOpen ? "Close menu" : "Open menu"} onClick={() => setMobileNavOpen((open) => !open)}>
            {mobileNavOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <div className="breadcrumb"><span>Season Cake</span><span>/</span><strong>{title}</strong></div>
          <div className="top-controls">
            {user.role === "owner" ? (
              <label className="location-select"><Store size={15} /><span className="sr-only">Active location</span>
                <select value={locationId} onChange={(event) => setLocationId(event.target.value)}>
                  <option value="all">All locations</option>
                  {locations.map((location) => <option value={location.id} key={location.id}>{location.name} · {location.kind.replaceAll("_", " ")}</option>)}
                </select>
              </label>
            ) : <span className="location-chip"><Store size={14} />{user.location?.name ?? "Location unassigned"}</span>}
            <span className="role-chip">{user.role === "employee" ? `${user.workspace} team` : user.role}</span>
            <button className="avatar-button" aria-label="Sign out" onClick={onSignOut}>{user.displayName.slice(0, 1).toUpperCase()}</button>
          </div>
        </header>

        <main className="workspace">
          <div className="page-title-row">
            <div><p className="eyebrow">{module === "overview" ? "Business at a glance" : module === "reports" ? "A clear view of the numbers" : module === "catalog" || module === "recipes" ? "Products, ingredients and production" : "Daily operations"}</p><h1>{title}</h1></div>
            {(module === "overview" || module === "reports") && (
              <label className="period-select">Show
                <select value={period} onChange={(event) => setPeriod(event.target.value as typeof period)}>
                  <option value="daily">Today</option><option value="weekly">This week</option><option value="monthly">This month</option>
                </select>
              </label>
            )}
          </div>
          {(error || queryError) && <div className="inline-alert" role="alert"><span>{error || (queryError instanceof Error ? queryError.message : "Could not load this section.")}</span><button aria-label="Dismiss error" onClick={() => setError("")}><X size={16} /></button></div>}
          {busy && <div className="loading-bar" aria-label="Updating" />}
          {workspaceQuery.isError && <EmptyState title="This section could not be loaded">Check your connection or ask an owner to review your access.</EmptyState>}
          {module === "overview" && <Overview dashboard={dashboard} locations={locations} />}
          {module === "reports" && <Reports dashboard={dashboard} products={products} employees={workspace.employees ?? []} filters={reportFilters} onFiltersChange={setReportFilters} />}
          {module === "orders" && (
            <OrdersPanel
              orders={orders}
              products={products}
              locations={locations}
              isOwner={user.role === "owner"}
              location={selectedLocation}
              disabled={busy}
              onSubmit={(payload) => performAction(() => api("/api/orders/", { method: "POST", body: JSON.stringify(payload) }))}
              onUpdate={updateOrder}
              onRecordPayment={(orderId, payload) => performAction(() => api(`/api/orders/${orderId}/payments/`, { method: "POST", body: JSON.stringify(payload) }))}
              onConvertToSale={() => {
                setModule("sales");
              }}
            />
          )}
          {module === "sales" && (
            <SalesPanel
              sales={sales}
              products={products}
              orders={orders}
              availability={salesAvailability}
              location={selectedLocation ?? locations.find((l) => l.kind === "cafe") ?? locations[0]}
              locations={locations}
              onSelectLocation={(locId) => setLocationId(String(locId))}
              disabled={busy}
              onSubmit={(payload) => performAction(() => api("/api/sales/", { method: "POST", body: JSON.stringify(payload) }))}
              onCollectPayment={(saleId, payload) => performAction(() => api(`/api/sales/${saleId}/payments/`, { method: "POST", body: JSON.stringify(payload) }))}
              onRefund={(saleId, payload) => performAction(() => api(`/api/sales/${saleId}/refunds/`, { method: "POST", body: JSON.stringify(payload) }))}
              onCancel={(saleId, payload) => performAction(() => api(`/api/sales/${saleId}/cancel/`, { method: "POST", body: JSON.stringify(payload) }))}
            />
          )}
          {module === "inventory" && <InventoryPanel inventory={inventory} movements={movements} transfers={transfers} ingredients={ingredients} products={products} locations={locations} isOwner={user.role === "owner"} assignedLocationId={user.location?.id} canAdjust={user.permissions.includes("inventory_adjust")} canTransfer={user.permissions.includes("transfers")} location={selectedLocation} disabled={busy} onAdjust={(payload) => performAction(() => api("/api/inventory/adjustments/", { method: "POST", body: JSON.stringify(payload) }))} onTransfer={(payload) => performAction(() => api("/api/transfers/dispatch/", { method: "POST", body: JSON.stringify(payload) }))} onReceiveTransfer={(id, payload) => performAction(() => api(`/api/transfers/${id}/receive/`, { method: "POST", body: JSON.stringify(payload) }))} />}
          {module === "production" && <ProductionPanel batches={production} products={products} recipes={recipes} location={selectedLocation} disabled={busy} onSubmit={(payload) => performAction(() => api("/api/production/", { method: "POST", body: JSON.stringify(payload) }))} />}
          {module === "purchases" && <PurchasesPanel purchases={purchases} ingredients={ingredients} suppliers={suppliers} location={selectedLocation} settings={workspace.settings} isOwner={user.role === "owner"} canApprove={user.permissions.includes("purchases_approve")} disabled={busy} onSubmit={(payload) => performAction(() => api("/api/purchases/", { method: "POST", body: JSON.stringify(payload) }))} onApprove={(id) => performAction(() => api(`/api/purchases/${id}/approve/`, { method: "POST", body: "{}" }))} onReject={(id, reason) => performAction(() => api(`/api/purchases/${id}/reject/`, { method: "POST", body: JSON.stringify({ reason }) }))} onUpdateSettings={(approval) => performAction(() => api("/api/business-settings/", { method: "PATCH", body: JSON.stringify({ require_purchase_approval: approval }) }))} />}
          {module === "catalog" && <CatalogPanel
            products={products}
            ingredients={ingredients}
            categories={workspace.categories ?? []}
            canManageWebsite={user.permissions.includes("website_content")}
            disabled={busy}
            onSaveProduct={(id, payload) => performAction(() => api(id ? `/api/products/${id}/` : "/api/products/", { method: id ? "PATCH" : "POST", body: payload }))}
            onDeleteProduct={(id) => performAction(() => api(`/api/products/${id}/`, { method: "DELETE" }))}
            onSaveIngredient={(id, payload) => performAction(() => api(id ? `/api/ingredients/${id}/` : "/api/ingredients/", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) }))}
            onSaveCategory={(id, payload) => performAction(() => api(id ? `/api/catalog-categories/${id}/` : "/api/catalog-categories/", { method: id ? "PATCH" : "POST", body: JSON.stringify(payload) }))}
            onDeleteCategory={(id) => performAction(() => api(`/api/catalog-categories/${id}/`, { method: "DELETE" }))}
          />}
          {module === "recipes" && <RecipesPanel recipes={recipes} products={products} ingredients={ingredients} canManage={user.permissions.includes("recipes_manage")} disabled={busy} onCreate={(payload) => performAction(() => api("/api/recipes/", { method: "POST", body: JSON.stringify(payload) }))} onGoToCatalog={() => setModule("catalog")} />}
          {module === "website" && workspace.websiteSettings && <WebsitePanel
            settings={workspace.websiteSettings}
            banners={workspace.websiteBanners ?? []}
            sections={workspace.websiteSections ?? []}
            gallery={workspace.websiteGallery ?? []}
            testimonials={workspace.websiteTestimonials ?? []}
            disabled={busy}
            onSaveSettings={(payload) => performAction(() => api("/api/website/settings/", { method: "PATCH", body: payload }))}
            onSaveBanner={(id, payload) => performAction(() => api(id ? `/api/website/banners/${id}/` : "/api/website/banners/", { method: id ? "PATCH" : "POST", body: payload }))}
            onDeleteBanner={(id) => performAction(() => api(`/api/website/banners/${id}/`, { method: "DELETE" }))}
            onSaveSection={(id, payload) => performAction(() => api(id ? `/api/website/sections/${id}/` : "/api/website/sections/", { method: id ? "PATCH" : "POST", body: payload }))}
            onDeleteSection={(id) => performAction(() => api(`/api/website/sections/${id}/`, { method: "DELETE" }))}
            onSaveGallery={(id, payload) => performAction(() => api(id ? `/api/website/gallery/${id}/` : "/api/website/gallery/", { method: id ? "PATCH" : "POST", body: payload }))}
            onDeleteGallery={(id) => performAction(() => api(`/api/website/gallery/${id}/`, { method: "DELETE" }))}
            onSaveTestimonial={(id, payload) => performAction(() => api(id ? `/api/website/testimonials/${id}/` : "/api/website/testimonials/", { method: id ? "PATCH" : "POST", body: payload }))}
            onDeleteTestimonial={(id) => performAction(() => api(`/api/website/testimonials/${id}/`, { method: "DELETE" }))}
          />}
          {module === "inquiries" && <InquiriesPanel inquiries={workspace.inquiries ?? []} disabled={busy} onUpdateStatus={(id, status) => performAction(() => api(`/api/website/inquiries/${id}/`, { method: "PATCH", body: JSON.stringify({ status }) }))} />}
          {module === "staff" && (
            <StaffPanel
              staff={workspace.staff ?? []}
              locations={locations}
              currentUserId={user.id}
              isOwner={user.role === "owner"}
              disabled={busy}
              onSaveStaff={async (id, payload) => {
                const url = id ? `/api/v1/staff/${id}/` : "/api/v1/staff/";
                const method = id ? "PATCH" : "POST";
                return performAction(() => api(url, { method, body: JSON.stringify(payload) }));
              }}
              onDeactivateStaff={async (id) => {
                return performAction(() => api(`/api/v1/staff/${id}/`, { method: "DELETE" }));
              }}
            />
          )}
          {module === "audit" && <AuditPanel events={workspace.audit ?? []} />}
        </main>
      </div>
    </div>
  );
}

function Metric({ label, value, note, icon: Icon }: { label: string; value: string; note: string; icon: typeof Store }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><Icon size={17} /></div><strong>{value}</strong><small>{note}</small></article>;
}

function Overview({ dashboard, locations }: { dashboard: Dashboard | null; locations: Location[] }) {
  if (!dashboard) return <EmptyState title="Your workspace is ready">Add cake products and ingredients in Catalog, create a recipe in Recipes, then record a purchase or production batch.</EmptyState>;
  const data = dashboard.summary;
  return (
    <>
      <div className="welcome-strip"><div><p>{dashboard.location?.name ?? (locations.length ? "Across all locations" : "Set up your first location")}</p><span>Daily activity is recorded against the signed-in team member.</span></div><span className="live-mark"><i /> Live records</span></div>
      <section className="metric-grid" aria-label="Business summary">
        {data.salesTotal !== undefined && <Metric label="Sales value" value={formatMoney(data.salesTotal)} note={`${data.saleCount ?? 0} recorded sales`} icon={ReceiptText} />}
        {data.netSalesTotal !== undefined && <Metric label="Net sales" value={formatMoney(data.netSalesTotal)} note={`${formatMoney(data.refundsTotal)} refunded in this period`} icon={ReceiptText} />}
        <Metric label="Open orders" value={String(data.openOrders)} note="Need a next step" icon={ClipboardList} />
        <Metric label="New orders today" value={String(data.newOrdersToday ?? 0)} note={`${data.ordersDueToday ?? 0} due today · ${data.overdueOrders ?? 0} overdue`} icon={ClipboardList} />
        <Metric label="Production" value={String(data.productionBatches)} note="Batches in this period" icon={CookingPot} />
        {data.purchaseSpend !== undefined && <Metric label="Ingredient purchases" value={formatMoney(data.purchaseSpend)} note={`${data.ingredientPurchases} approved purchases this period`} icon={ShoppingBasket} />}
        {(data.purchasesPendingApproval ?? 0) > 0 && <Metric label="Purchases to approve" value={String(data.purchasesPendingApproval)} note="Waiting for an authorized approver" icon={ShoppingBasket} />}
        <Metric label="Low ingredients" value={String(data.lowIngredientBalances)} note="At or below reorder level" icon={Boxes} />
        <Metric label="Stock in transit" value={String(data.pendingTransfers ?? 0)} note="Awaiting receipt at destination" icon={ArrowLeftRight} />
        {data.cakesSold !== undefined &&         <Metric label="Products sold" value={String(data.cakesSold)} note="Selling units in selected period" icon={ReceiptText} />}
      </section>
      {data.cashCollected !== undefined && <section className="panel payment-panel">
        <div className="panel-heading"><div><p className="eyebrow">Payments received</p><h2>Money in</h2></div><span>{dashboard.startDate}</span></div>
        <div className="payment-breakdown">
          <div><span className="payment-dot cash" />Cash<strong>{formatMoney(data.cashCollected)}</strong><small>Refunded {formatMoney(data.cashRefunded)}</small></div>
          <div><span className="payment-dot telebirr" />Telebirr<strong>{formatMoney(data.telebirrCollected)}</strong><small>Refunded {formatMoney(data.telebirrRefunded)}</small></div>
          <div><span className="payment-dot bank" />Bank transfer<strong>{formatMoney(data.bankTransferCollected)}</strong><small>Refunded {formatMoney(data.bankTransferRefunded)}</small></div>
        </div>
        {data.netPayments !== undefined && <p className="payment-net">Net payments received <strong>{formatMoney(data.netPayments)}</strong></p>}
        {!!data.bankTransferByBank?.length && <DataTable headers={["Bank", "Received", "Refunded", "Net"]}>{data.bankTransferByBank.map((bank) => <tr key={bank.bank_name}><td>{bank.bank_name}</td><td>{formatMoney(bank.collected)}</td><td>{formatMoney(bank.refunded)}</td><td>{formatMoney(bank.net)}</td></tr>)}</DataTable>}
      </section>}
      {dashboard.locationStock && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Finished cake stock</p><h2>Across your locations</h2></div></div><DataTable headers={["Location", "Cakes on hand", "Low ingredients"]}>{dashboard.locationStock.map((branch) => <tr key={branch.id}><td>{branch.name}</td><td>{branch.finishedCakes}</td><td>{branch.lowIngredients}</td></tr>)}</DataTable></section>}
      {dashboard.recentStockMovements && <ActivityTable movements={dashboard.recentStockMovements} />}
      {dashboard.recentActivity && <RecentActivity events={dashboard.recentActivity} />}
    </>
  );
}

function Reports({
  dashboard,
  products,
  employees,
  filters,
  onFiltersChange,
}: {
  dashboard: Dashboard | null;
  products: Product[];
  employees: ReportEmployee[];
  filters: ReportFilters;
  onFiltersChange: (filters: ReportFilters) => void;
}) {
  if (!dashboard) return <EmptyState title="No report data yet">Sales, payment, stock, and production reports appear here when activity is recorded.</EmptyState>;
  const { summary } = dashboard;
  return (
    <>
      <ReportFiltersPanel
        products={products}
        employees={employees}
        filters={filters}
        startDate={dashboard.startDate}
        endDate={dashboard.endDate}
        onChange={onFiltersChange}
      />
      <section className="report-grid">
        {summary.salesTotal !== undefined && <Metric label="Sales value" value={formatMoney(summary.salesTotal)} note={`${summary.saleCount ?? 0} sales`} icon={ReceiptText} />}
        {summary.netSalesTotal !== undefined && <Metric label="Net sales" value={formatMoney(summary.netSalesTotal)} note={`${formatMoney(summary.refundsTotal)} refunded`} icon={ReceiptText} />}
        {summary.grossMargin !== undefined && <Metric label="Gross margin" value={formatMoney(summary.grossMargin)} note={`${summary.grossMarginPercent ?? 0}% margin (Net sales minus COGS)`} icon={ReceiptText} />}
        {summary.cashCollected !== undefined && <Metric label="Cash" value={formatMoney(summary.cashCollected)} note="Received in selected period" icon={ArrowDownLeft} />}
        {summary.telebirrCollected !== undefined && <Metric label="Telebirr" value={formatMoney(summary.telebirrCollected)} note="Received in selected period" icon={ArrowDownLeft} />}
        {summary.bankTransferCollected !== undefined && <Metric label="Bank transfer" value={formatMoney(summary.bankTransferCollected)} note="Received in selected period" icon={ArrowDownLeft} />}
        {summary.netPayments !== undefined && <Metric label="Net payments" value={formatMoney(summary.netPayments)} note="Collections less refunds" icon={ArrowDownLeft} />}
        <Metric label="Purchases" value={String(summary.ingredientPurchases)} note="Ingredient receipts" icon={ShoppingBasket} />
        {summary.purchaseSpend !== undefined && <Metric label="Purchase spend" value={formatMoney(summary.purchaseSpend)} note="Approved receipts in selected period" icon={ShoppingBasket} />}
        <Metric label="Production batches" value={String(summary.productionBatches)} note="Completed batches" icon={CookingPot} />
        {summary.productionQuantity !== undefined && <Metric label="Cakes produced" value={String(summary.productionQuantity)} note={`${summary.productionWastage ?? 0} recorded as wastage`} icon={CookingPot} />}
        {summary.cakesSold !== undefined && <Metric label="Products sold" value={String(summary.cakesSold)} note="Selling units in selected period" icon={ReceiptText} />}
        {summary.overdueOrders !== undefined && <Metric label="Overdue orders" value={String(summary.overdueOrders)} note="Require follow-up" icon={ClipboardList} />}
        {summary.ordersCreated !== undefined && <Metric label="Orders received" value={String(summary.ordersCreated)} note="Created in selected period" icon={ClipboardList} />}
      </section>
      {!!summary.bankTransferByBank?.length && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Bank reconciliation</p><h2>Transfers by bank</h2></div></div><DataTable headers={["Bank", "Received", "Refunded", "Net"]}>{summary.bankTransferByBank.map((bank) => <tr key={bank.bank_name}><td>{bank.bank_name}</td><td>{formatMoney(bank.collected)}</td><td>{formatMoney(bank.refunded)}</td><td>{formatMoney(bank.net)}</td></tr>)}</DataTable></section>}
      {summary.salesByCake?.length ? <section className="panel chart-panel"><div className="panel-heading"><div><p className="eyebrow">Product mix</p><h2>Sales by cake</h2></div></div><div className="chart-area"><ResponsiveContainer width="100%" height="100%"><BarChart data={summary.salesByCake} margin={{ top: 8, right: 12, left: 0, bottom: 8 }}><CartesianGrid stroke="#eee8e0" vertical={false} /><XAxis dataKey="product" tick={{ fill: "#766b64", fontSize: 10 }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fill: "#766b64", fontSize: 10 }} axisLine={false} tickLine={false} /><Tooltip formatter={(value) => [`${value} cakes`, "Quantity"]} /><Bar dataKey="quantity" fill="#9a7951" radius={[2, 2, 0, 0]} /></BarChart></ResponsiveContainer></div></section> : null}
      {!!summary.productionByCake?.length && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Kitchen output</p><h2>Production by cake</h2></div></div><DataTable headers={["Cake", "Produced", "Wastage"]}>{summary.productionByCake.map((item) => <tr key={item.product}><td>{item.product}</td><td>{item.quantity}</td><td>{item.wastage}</td></tr>)}</DataTable></section>}
      {!!summary.ingredientConsumption?.length && <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Recipe use</p><h2>Ingredient consumption</h2></div></div><DataTable headers={["Ingredient", "Consumed", "Unit"]}>{summary.ingredientConsumption.map((item) => <tr key={`${item.ingredient}-${item.unit}`}><td>{item.ingredient}</td><td>{item.quantity}</td><td>{item.unit}</td></tr>)}</DataTable></section>}
      {dashboard.recentActivity && <RecentActivity events={dashboard.recentActivity} />}
    </>
  );
}

function ActivityTable({ movements }: { movements: Movement[] }) {
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Stock ledger</p><h2>Recent movements</h2></div><span>Each change is attributed to a team member</span></div>
    {movements.length ? <DataTable headers={["Item", "Change", "Activity", "Recorded by", "Time"]}>{movements.map((item) => <tr key={item.id}><td>{item.item_name}<small>{item.unit}</small></td><td className={Number(item.quantity_delta) < 0 ? "negative" : "positive"}>{Number(item.quantity_delta) > 0 ? "+" : ""}{item.quantity_delta}</td><td>{item.kind.replaceAll("_", " ")}</td><td>{item.actor_name || "System"}</td><td>{formatDate(item.created_at)}</td></tr>)}</DataTable> : <EmptyState title="No stock activity yet">Purchases and production create a traceable stock record here.</EmptyState>}
  </section>;
}

function RecentActivity({ events }: { events: AuditEvent[] }) {
  return <section className="panel"><div className="panel-heading"><div><p className="eyebrow">Accountability</p><h2>Recent team activity</h2></div><span>Recorded business actions</span></div>
    {events.length ? <DataTable headers={["Activity", "Recorded by", "Location", "Time"]}>{events.map((event) => <tr key={event.id}><td>{event.summary}</td><td>{event.actor_name || "System"}</td><td>{event.location_name || "Unassigned request"}</td><td>{formatDate(event.created_at)}</td></tr>)}</DataTable> : <EmptyState title="No business activity yet">Purchases, sales, orders, and stock changes will appear here.</EmptyState>}
  </section>;
}

function AuditPanel({ events }: { events: AuditEvent[] }) {
  function handleExportCsv() {
    const headers = ["Time", "Action", "Details", "Target Type", "Target ID", "Recorded by", "Location"];
    const rows = events.map((e) => [
      formatDate(e.created_at),
      e.action.replaceAll("_", " "),
      e.summary,
      e.target_type,
      e.target_id,
      e.actor_name || "System",
      e.location_name || "Unassigned request",
    ]);
    exportToCsv("seasons-cake-audit-trail", headers, rows);
  }
  return (
    <section className="panel">
      <div className="panel-heading">
        <div><p className="eyebrow">Recorded business actions</p><h2>Audit history</h2></div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span>{events.length} recent events</span>
          {events.length > 0 && (
            <button
              type="button"
              className="button button-outline button-sm"
              onClick={handleExportCsv}
              title="Download audit trail as CSV"
            >
              <Download size={14} /> Export CSV
            </button>
          )}
        </div>
      </div>
      {events.length ? (
        <DataTable headers={["Time", "Action", "Details", "Recorded by", "Location"]}>
          {events.map((event) => (
            <tr key={event.id}>
              <td>{formatDate(event.created_at)}</td>
              <td>{event.action.replaceAll("_", " ")}</td>
              <td>{event.summary}<small>{event.target_type} #{event.target_id}</small></td>
              <td>{event.actor_name || "System"}</td>
              <td>{event.location_name || "Unassigned request"}</td>
            </tr>
          ))}
        </DataTable>
      ) : (
        <EmptyState title="No audit events yet">Operational actions are recorded here as your team begins working.</EmptyState>
      )}
    </section>
  );
}

export default function App() {
  const [user, setUser] = useState<PortalUser | null>(null);
  const [checking, setChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    refreshCsrfToken()
      .then(() => api<PortalUser | { authenticated: false }>("/api/auth/me/"))
      .then((session) => { if (active) setUser("authenticated" in session ? null : session); })
      .catch(() => { if (active) setUser(null); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  const home = useMemo(() => user ? `/${user.role}` : "/login", [user]);

  async function handleSignOut() {
    try { await signOut(); } finally {
      setUser(null);
      navigate("/login");
    }
  }

  if (checking) return <div className="checking-screen"><span className="brand-mark">S</span><span>Opening your workspace…</span></div>;

  return <Routes>
    <Route path="/login" element={user ? <Navigate to={home} replace /> : <LoginPage onLogin={(signedInUser) => { setUser(signedInUser); navigate(`/${signedInUser.role}`, { replace: true }); }} />} />
    <Route path="/:portal" element={user ? <Portal user={user} onSignOut={handleSignOut} /> : <Navigate to="/login" replace />} />
    <Route path="*" element={<Navigate to={home} replace />} />
  </Routes>;
}
