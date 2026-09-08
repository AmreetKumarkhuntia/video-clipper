import { Hono } from 'hono';
import { findChannel, findSavedVideoIds } from '@lib/services/db/index.js';
import { ChannelVideosQuerySchema } from '@lib/types/api.js';
import { createYouTubeCatalogService } from '../services/catalogFactory.js';
import { requireCustomer } from '../middleware/session.js';
import { HttpError, jsonError } from '../http/responses.js';
import type { ApiEnv } from '../context.js';
import type { Customer } from '@lib/types/auth.js';

/**
 * The customer's own linked channel. Distinct from `/api/youtube/channels/*`,
 * which resolves anyone's channel by handle — these two routes only ever answer
 * about the one channel this customer is linked to.
 */
export const channelRoutes = new Hono<ApiEnv>();

/**
 * A customer whose sign-in completed always has a channel; one whose link never
 * finished does not, and asking them to reconnect is more useful than a 404 on
 * a route they cannot fix.
 */
function linkedChannelId(customer: Customer): string {
  if (!customer.channelId) {
    throw new HttpError(jsonError(409, 'No YouTube channel is linked to this account.'));
  }
  return customer.channelId;
}

channelRoutes.get('/', (c) => {
  const customer = requireCustomer(c);
  const channelId = linkedChannelId(customer);
  // The row is written at sign-in, so it is normally present; an empty title
  // rather than a 404 keeps the topbar renderable if it ever is not.
  const channel = findChannel(channelId);
  return c.json({
    channelId,
    title: channel?.title ?? '',
    ...(channel?.handle ? { handle: channel.handle } : {}),
  });
});

/**
 * One page of the customer's uploads, annotated with which are already in their
 * library so the browse grid can show Add against Added.
 *
 * Reads the public uploads playlist with the operator's API key, so private and
 * unlisted uploads do not appear. Using the customer's own token would surface
 * them, and is a later change.
 */
channelRoutes.get('/videos', async (c) => {
  const customer = requireCustomer(c);
  const channelId = linkedChannelId(customer);
  const { pageToken } = ChannelVideosQuerySchema.parse({
    pageToken: c.req.query('pageToken') ?? undefined,
  });

  const page = await createYouTubeCatalogService().listChannelVideos(channelId, pageToken);
  const savedIds = findSavedVideoIds(
    customer.id,
    page.videos.map((video) => video.id),
  );

  return c.json({ ...page, savedIds });
});
