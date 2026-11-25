import type { ReactNode } from 'react';
import { Link, Navigate, useLocation } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';
import { useSession } from '@/hooks/useStore';
import { roleHasPermission, type Permission } from '@/config/permissions';
import { buttonClasses } from '@/components/ui/button';

export function RequireAuth({ children }: { children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

export function RequirePermission({ permission, children }: { permission: Permission; children: ReactNode }) {
  const session = useSession();
  const location = useLocation();
  if (!session) {
    return <Navigate to="/admin/login" replace state={{ from: location.pathname }} />;
  }
  if (!roleHasPermission(session.role, permission)) {
    return <AccessDenied />;
  }
  return <>{children}</>;
}

function AccessDenied() {
  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-clay-wash text-clay-deep">
        <ShieldAlert className="h-6 w-6" />
      </div>
      <h1 className="font-display text-2xl text-forest-deep">Access restricted</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Your role does not include access to this module. Ask an administrator to adjust your
        permissions. The backend remains the authoritative security boundary.
      </p>
      <Link to="/admin" className={buttonClasses('outline', 'md', 'mt-6')}>
        Return to dashboard
      </Link>
    </div>
  );
}
