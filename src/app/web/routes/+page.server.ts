import { backendJson } from '@web/lib/server/backend.js';
import type { ServerLoadEvent } from '@sveltejs/kit';
import type { LibraryVideoPage } from '@lib/types/auth.js';

const PAGE_SIZE = 24;

/**
 * The library loads on the server: it reads our own database through the
 * backend, which is fast enough to render with no spinner, and paging lives in
 * the URL so a page is linkable. Browse, which calls the slow YouTube API,
 * fetches on the client instead.
 */
export async function load({ cookies, url }: ServerLoadEvent) {
  const requested = Number(url.searchParams.get('page') ?? '1');
  const pageNumber = Number.isFinite(requested) && requested >= 1 ? Math.floor(requested) : 1;
  const offset = (pageNumber - 1) * PAGE_SIZE;

  const result = await backendJson<LibraryVideoPage>(
    `/api/videos?limit=${PAGE_SIZE}&offset=${offset}`,
    cookies,
  );

  return {
    page: pageNumber,
    pageSize: PAGE_SIZE,
    total: result.total,
    videos: result.videos,
  };
}
