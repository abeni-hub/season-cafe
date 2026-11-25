import { Link } from 'react-router-dom';
import { Leaf } from 'lucide-react';
import { buttonClasses } from '@/components/ui/button';

export function NotFoundPage() {
  return (
    <div className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <div className="mb-5 rounded-full bg-forest-wash p-4 text-forest">
        <Leaf className="h-7 w-7" />
      </div>
      <p className="eyebrow">Page not found</p>
      <h1 className="mt-3 font-display text-4xl text-forest-deep">This bake has sold out.</h1>
      <p className="mt-3 max-w-md text-sm leading-relaxed text-muted">
        The page you are looking for is not on the menu. Head back to the storefront or browse the
        catalogue.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-2">
        <Link to="/" className={buttonClasses('primary')}>
          Return home
        </Link>
        <Link to="/products" className={buttonClasses('outline')}>
          Browse products
        </Link>
      </div>
    </div>
  );
}
