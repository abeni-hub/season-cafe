import { roleHasPermission, type Permission } from '@/config/permissions';
import type { SessionUser } from '@/types/domain';
import { AppError } from './errors';
import { getSessionUser } from './session';

export function requireSession(): SessionUser {
  const user = getSessionUser();
  if (!user) throw new AppError('Please sign in to continue.');
  return user;
}

export function requirePermission(permission: Permission): SessionUser {
  const user = requireSession();
  if (!roleHasPermission(user.role, permission)) {
    throw new AppError('Your role does not allow this action.');
  }
  return user;
}

export function currentActorName(): string {
  return getSessionUser()?.name ?? 'System';
}
