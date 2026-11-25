import { HAS_REMOTE_API } from '@/config/brand';
import type { BusinessSettings, Message, SiteContent } from '@/types/domain';
import { apiRequest } from '../api/client';
import { synced } from '../api/session';
import {
  markMessageRead as demoMarkMessageRead,
  submitMessage as demoSubmitMessage,
  updateSettings as demoUpdateSettings,
  updateSiteContent as demoUpdateSiteContent,
  type MessageInput,
} from '../siteService';

export * from '../siteService';

export function updateSiteContent(patch: Partial<SiteContent>): SiteContent | Promise<SiteContent> {
  if (!HAS_REMOTE_API) return demoUpdateSiteContent(patch);
  return (async () => {
    const content = await apiRequest<SiteContent>('/site/content/', {
      method: 'PATCH',
      body: patch,
    });
    return synced('Website content', content);
  })();
}

export function updateSettings(
  patch: Partial<Pick<BusinessSettings, 'businessName' | 'currency' | 'tagline'>>,
): BusinessSettings | Promise<BusinessSettings> {
  if (!HAS_REMOTE_API) return demoUpdateSettings(patch);
  return (async () => {
    const settings = await apiRequest<BusinessSettings>('/site/settings/', {
      method: 'PATCH',
      body: patch,
    });
    return synced('Business settings', settings);
  })();
}

export function submitMessage(input: MessageInput): Message | Promise<Message> {
  if (!HAS_REMOTE_API) return demoSubmitMessage(input);
  return (async () => {
    const message = await apiRequest<Message>('/messages/', {
      method: 'POST',
      auth: false,
      body: input,
    });
    return synced('Message', message);
  })();
}

export function markMessageRead(id: string): void | Promise<void> {
  if (!HAS_REMOTE_API) return demoMarkMessageRead(id);
  return (async () => {
    await apiRequest(`/messages/${id}/read/`, { method: 'POST' });
    await synced('Message', undefined);
  })();
}
