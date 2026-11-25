import { HAS_REMOTE_API } from '@/config/brand';
import type { Employee } from '@/types/domain';
import { initializeRemoteSession, loginRemote, logoutRemote } from '../api/session';
import {
  DEMO_PASSWORD as DEMO_PASSWORD_VALUE,
  listDemoAccounts as demoListDemoAccounts,
  login as demoLogin,
  logout as demoLogout,
} from '../authService';

export * from '../authService';

export const DEMO_PASSWORD = HAS_REMOTE_API ? '' : DEMO_PASSWORD_VALUE;

export function listDemoAccounts(): Employee[] {
  return HAS_REMOTE_API ? [] : demoListDemoAccounts();
}

export function login(email: string, password: string): Employee | Promise<Employee> {
  return HAS_REMOTE_API ? loginRemote(email, password) : demoLogin(email, password);
}

export function logout(): void | Promise<void> {
  return HAS_REMOTE_API ? logoutRemote() : demoLogout();
}

export { initializeRemoteSession };
