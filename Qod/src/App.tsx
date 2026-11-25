import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ToastProvider } from '@/components/ui/toast';
import { RemoteBootstrap } from '@/app/RemoteBootstrap';
import { ScrollToTop } from '@/app/ScrollToTop';
import { SiteLayout } from '@/app/layouts/SiteLayout';
import { BmsLayout } from '@/app/layouts/BmsLayout';
import { RequireAuth, RequirePermission } from '@/app/guards/RequireAuth';
import { HomePage } from '@/features/website/HomePage';
import { ProductsPage } from '@/features/website/ProductsPage';
import { ProductDetailPage } from '@/features/website/ProductDetailPage';
import { AboutPage } from '@/features/website/AboutPage';
import { GalleryPage } from '@/features/website/GalleryPage';
import { CustomOrdersPage as WebsiteCustomOrdersPage } from '@/features/website/CustomOrdersPage';
import { ContactPage } from '@/features/website/ContactPage';
import { NotFoundPage } from '@/features/website/NotFoundPage';
import { LoginPage } from '@/features/auth/LoginPage';
import { DashboardPage } from '@/features/dashboard/DashboardPage';
import { PosPage } from '@/features/pos/PosPage';
import { OrdersPage } from '@/features/orders/OrdersPage';
import { OrderDetailPage } from '@/features/orders/OrderDetailPage';
import { CustomOrdersPage } from '@/features/custom-orders/CustomOrdersPage';
import { CustomersPage } from '@/features/customers/CustomersPage';
import { PaymentsPage } from '@/features/payments/PaymentsPage';
import { InventoryPage } from '@/features/inventory/InventoryPage';
import { PurchasingPage } from '@/features/purchasing/PurchasingPage';
import { ProductionPage } from '@/features/production/ProductionPage';
import { RecipesPage } from '@/features/recipes/RecipesPage';
import { TransfersPage } from '@/features/transfers/TransfersPage';
import { ExpensesPage } from '@/features/expenses/ExpensesPage';
import { ReportsPage } from '@/features/reports/ReportsPage';
import { ProductsPage as CataloguePage } from '@/features/products/ProductsPage';
import { EmployeesPage } from '@/features/employees/EmployeesPage';
import { WebsiteCmsPage } from '@/features/website/WebsiteCmsPage';

export function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <RemoteBootstrap>
          <ScrollToTop />
          <Routes>
          <Route element={<SiteLayout />}>
            <Route index element={<HomePage />} />
            <Route path="/products" element={<ProductsPage />} />
            <Route path="/products/:slug" element={<ProductDetailPage />} />
            <Route path="/about" element={<AboutPage />} />
            <Route path="/gallery" element={<GalleryPage />} />
            <Route path="/custom-orders" element={<WebsiteCustomOrdersPage />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="*" element={<NotFoundPage />} />
          </Route>

          <Route path="/admin/login" element={<LoginPage />} />

          <Route
            path="/admin"
            element={
              <RequireAuth>
                <BmsLayout />
              </RequireAuth>
            }
          >
            <Route
              index
              element={
                <RequirePermission permission="dashboard.view">
                  <DashboardPage />
                </RequirePermission>
              }
            />
            <Route
              path="pos"
              element={
                <RequirePermission permission="pos.use">
                  <PosPage />
                </RequirePermission>
              }
            />
            <Route
              path="orders"
              element={
                <RequirePermission permission="orders.view">
                  <OrdersPage />
                </RequirePermission>
              }
            />
            <Route
              path="orders/:orderId"
              element={
                <RequirePermission permission="orders.view">
                  <OrderDetailPage />
                </RequirePermission>
              }
            />
            <Route
              path="custom-orders"
              element={
                <RequirePermission permission="orders.view">
                  <CustomOrdersPage />
                </RequirePermission>
              }
            />
            <Route
              path="customers"
              element={
                <RequirePermission permission="customers.manage">
                  <CustomersPage />
                </RequirePermission>
              }
            />
            <Route
              path="payments"
              element={
                <RequirePermission permission="payments.view">
                  <PaymentsPage />
                </RequirePermission>
              }
            />
            <Route
              path="inventory"
              element={
                <RequirePermission permission="inventory.view">
                  <InventoryPage />
                </RequirePermission>
              }
            />
            <Route
              path="purchasing"
              element={
                <RequirePermission permission="purchasing.manage">
                  <PurchasingPage />
                </RequirePermission>
              }
            />
            <Route
              path="production"
              element={
                <RequirePermission permission="production.view">
                  <ProductionPage />
                </RequirePermission>
              }
            />
            <Route
              path="recipes"
              element={
                <RequirePermission permission="recipes.manage">
                  <RecipesPage />
                </RequirePermission>
              }
            />
            <Route
              path="transfers"
              element={
                <RequirePermission permission="transfers.manage">
                  <TransfersPage />
                </RequirePermission>
              }
            />
            <Route
              path="expenses"
              element={
                <RequirePermission permission="expenses.manage">
                  <ExpensesPage />
                </RequirePermission>
              }
            />
            <Route
              path="reports"
              element={
                <RequirePermission permission="reports.view">
                  <ReportsPage />
                </RequirePermission>
              }
            />
            <Route
              path="products"
              element={
                <RequirePermission permission="products.manage">
                  <CataloguePage />
                </RequirePermission>
              }
            />
            <Route
              path="employees"
              element={
                <RequirePermission permission="employees.manage">
                  <EmployeesPage />
                </RequirePermission>
              }
            />
            <Route
              path="website"
              element={
                <RequirePermission permission="cms.manage">
                  <WebsiteCmsPage />
                </RequirePermission>
              }
            />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
          </Routes>
        </RemoteBootstrap>
      </ToastProvider>
    </BrowserRouter>
  );
}
