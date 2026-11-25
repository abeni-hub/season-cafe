import type { BusinessSettings, Message, SiteContent } from '@/types/domain';
import { getDb, mutateDb } from './demo/store';
import { AppError } from './errors';
import { requirePermission } from './guard';
import { requireNonEmpty } from './helpers';
import { nowIso } from '@/utils/date';
import { uid } from '@/utils/id';

export function getSiteContent(): SiteContent {
  return getDb().siteContent;
}

export function getSettings(): BusinessSettings {
  return getDb().settings;
}

export function updateSiteContent(patch: Partial<SiteContent>): SiteContent {
  const actor = requirePermission('cms.manage');
  return mutateDb(
    (draft) => {
      const next: SiteContent = { ...draft.siteContent, ...patch };
      if (!next.heroTitle.trim()) throw new AppError('The hero title cannot be empty.');
      if (next.galleryCaptions.length !== draft.siteContent.galleryCaptions.length) {
        throw new AppError('Gallery caption count is fixed.');
      }
      draft.siteContent = next;
      draft.activity.unshift({
        id: uid('act'),
        message: 'Website content updated.',
        actor: actor.name,
        createdAt: nowIso(),
      });
      return next;
    },
    undefined,
  );
}

export function updateSettings(patch: Partial<Pick<BusinessSettings, 'businessName' | 'currency' | 'tagline'>>): BusinessSettings {
  const actor = requirePermission('cms.manage');
  return mutateDb(
    (draft) => {
      if (patch.businessName !== undefined) {
        draft.settings.businessName = requireNonEmpty(patch.businessName, 'Business name is required.');
      }
      if (patch.currency !== undefined) {
        if (!/^[A-Z]{3}$/.test(patch.currency)) throw new AppError('Currency must be a 3-letter ISO code.');
        draft.settings.currency = patch.currency;
      }
      if (patch.tagline !== undefined) {
        draft.settings.tagline = requireNonEmpty(patch.tagline, 'Tagline is required.');
      }
      draft.activity.unshift({
        id: uid('act'),
        message: 'Business settings updated.',
        actor: actor.name,
        createdAt: nowIso(),
      });
      return draft.settings;
    },
    undefined,
  );
}

export interface MessageInput {
  name: string;
  email?: string;
  phone?: string;
  subject: string;
  body: string;
}

export function submitMessage(input: MessageInput): Message {
  const name = requireNonEmpty(input.name, 'Please include your name.');
  const subject = requireNonEmpty(input.subject, 'Please include a subject.');
  const body = requireNonEmpty(input.body, 'Please include a message.');
  if (!input.email?.trim() && !input.phone?.trim()) {
    throw new AppError('Please include an email address or phone number.');
  }
  return mutateDb(
    (draft) => {
      const message: Message = {
        id: uid('msg'),
        name,
        email: input.email?.trim() || undefined,
        phone: input.phone?.trim() || undefined,
        subject,
        body,
        isRead: false,
        createdAt: nowIso(),
      };
      draft.messages.unshift(message);
      draft.activity.unshift({
        id: uid('act'),
        message: `Website message received from ${name}.`,
        actor: 'Website',
        createdAt: message.createdAt,
      });
      return message;
    },
    undefined,
  );
}

export function listMessages(): Message[] {
  return [...getDb().messages].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

export function markMessageRead(id: string): void {
  requirePermission('cms.manage');
  mutateDb((draft) => {
    const message = draft.messages.find((entry) => entry.id === id);
    if (message) message.isRead = true;
  });
}
