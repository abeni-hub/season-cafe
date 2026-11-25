import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { ArrowLeft, ArrowRight, Lock, Sparkles } from 'lucide-react';
import { Logo } from '@/components/shared/Logo';
import { BotanicalSprig } from '@/components/shared/ProductArt';
import { Button } from '@/components/ui/button';
import { Field, Input } from '@/components/ui/field';
import { useToast } from '@/components/ui/toast';
import { useSession } from '@/hooks/useStore';
import { DEMO_PASSWORD, listDemoAccounts, login } from '@/services/live/authService';
import { ROLE_LABELS } from '@/config/permissions';
import { BRAND, HAS_REMOTE_API } from '@/config/brand';
import { EDITORIAL_MEDIA } from '@/config/media';
import { EDITORIAL_EASE } from '@/lib/motion';
import { cn } from '@/utils/cn';

export function LoginPage() {
  const session = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const [email, setEmail] = useState(HAS_REMOTE_API ? '' : 'owner@seasonscake.demo');
  const [password, setPassword] = useState(HAS_REMOTE_API ? '' : DEMO_PASSWORD);
  const [submitting, setSubmitting] = useState(false);
  const accounts = listDemoAccounts();

  const from = (location.state as { from?: string } | null)?.from ?? '/admin';

  if (session) return <Navigate to={from} replace />;

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const employee = await login(email, password);
      toast.success(`Welcome back, ${employee.name}.`);
      navigate(from, { replace: true });
    } catch (error) {
      toast.error(error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="grid min-h-screen bg-paper lg:grid-cols-[1.05fr_1fr]">
      <div className="relative hidden overflow-hidden bg-forest-deep text-cream lg:block">
        <img
          src={EDITORIAL_MEDIA.cafeCounter.src}
          alt={EDITORIAL_MEDIA.cafeCounter.alt}
          className="absolute inset-0 h-full w-full object-cover opacity-30"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-deep via-forest-deep/85 to-forest-deep/55" />
        <BotanicalSprig className="absolute right-8 top-10 h-52 w-40 opacity-25" />

        <div className="relative flex h-full flex-col justify-between p-12">
          <div className="flex items-center justify-between gap-4">
            <Logo invert />
            <img
              src={BRAND.logoPath}
              alt="Seasons Cake official logo mark"
              width={52}
              height={52}
              className="h-13 w-13 rounded-2xl border border-cream/20 object-cover shadow-soft"
            />
          </div>

          <div className="max-w-md">
            <p className="eyebrow text-clay-soft">Business management</p>
            <h1 className="mt-4 font-display text-4xl leading-tight text-cream">
              Run the bakery with a ledger you can trust.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-cream/70">
              Sales, custom orders, production, procurement and finance in one workspace — built around
              the inventory and payment rules that keep stock and balances honest.
            </p>
            <div className="mt-8 grid grid-cols-2 gap-3 text-xs">
              {[
                'Deposits never move stock',
                'Stock moves once per sale',
                'Transfers preserve stock',
                'Purchases arrive before stock',
              ].map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-2 rounded-xl border border-cream/10 bg-cream/5 px-3 py-2.5 text-cream/75"
                >
                  <Sparkles className="mt-0.5 h-3.5 w-3.5 shrink-0 text-clay-soft" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          <p className="text-[11px] text-cream/45">
            {HAS_REMOTE_API
              ? 'Live Django + PostgreSQL workspace — role-based permissions enforced server-side.'
              : 'Demo environment — accounts and passwords are placeholders, not production credentials.'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-center px-5 py-12 sm:px-10">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: EDITORIAL_EASE }}
          className="w-full max-w-md"
        >
          <Link
            to="/"
            className="mb-8 inline-flex items-center gap-1.5 text-xs font-semibold text-muted transition-colors hover:text-forest"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to website
          </Link>
          <p className="eyebrow">Seasons Cake BMS</p>
          <h1 className="mt-2 font-display text-3xl text-forest-deep">Sign in to the workspace</h1>
          <p className="mt-2 text-sm text-muted">
            Role-aware access. Navigation adapts to your permissions;{' '}
            {HAS_REMOTE_API
              ? 'the API authorises every request'
              : 'mutating actions are also checked in the service layer'}
            .
          </p>

          <form onSubmit={(event) => void submit(event)} className="mt-7 space-y-4">
            <Field label="Email" htmlFor="email">
              <Input
                id="email"
                type="email"
                autoComplete="username"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </Field>
            <Button type="submit" className="w-full" size="lg" disabled={submitting}>
              <Lock className="h-4 w-4" />
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </form>

          {!HAS_REMOTE_API && (
            <div className="mt-8 rounded-2xl border border-line bg-cream p-4">
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted">Demo accounts</p>
              <p className="mt-1 text-xs text-muted">
                Password for all demo accounts:{' '}
                <span className="font-mono font-semibold text-ink">{DEMO_PASSWORD}</span>
              </p>
              <div className="mt-3 grid gap-1.5">
                {accounts.map((account) => (
                  <button
                    key={account.id}
                    type="button"
                    onClick={() => {
                      setEmail(account.email);
                      setPassword(DEMO_PASSWORD);
                    }}
                    className={cn(
                      'flex items-center justify-between rounded-lg border px-3 py-2 text-left text-xs transition-colors',
                      email === account.email
                        ? 'border-forest/30 bg-forest-wash text-forest-deep'
                        : 'border-line bg-paper/50 text-ink-soft hover:border-forest/20 hover:bg-paper',
                    )}
                  >
                    <span>
                      <span className="font-semibold">{ROLE_LABELS[account.role]}</span>
                      <span className="ml-2 text-muted">{account.email}</span>
                    </span>
                    <ArrowRight className="h-3.5 w-3.5 opacity-50" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
