import { createServer } from 'node:http';
import type { IncomingMessage, ServerResponse } from 'node:http';

const PORT = 5151;
const NOW = '2026-01-01T00:00:00.000Z';

const customer = {
  id: 'customer-e2e',
  email: 'fixture@example.com',
  name: 'E2E Fixture',
  channelId: 'channel-e2e',
  role: 'admin',
  permissions: ['settings:write'],
  createdAt: NOW,
  updatedAt: NOW,
};

const analysis = {
  id: 'analysis-e2e',
  videoId: 'video-e2e',
  title: 'Fixture clip plan',
  durationSec: 120,
  candidates: [
    {
      id: 'segment-e2e',
      rank: 1,
      startSec: 10,
      endSec: 40,
      score: 9,
      reason: 'A deterministic fixture moment',
      source: 'transcript',
      transcriptExcerpt: 'A useful fixture transcript.',
      selected: true,
    },
  ],
  chunkEvaluations: [],
  createdAt: NOW,
};

const clip = {
  id: 'clip-e2e',
  videoId: 'video-e2e',
  analysisId: 'analysis-e2e',
  segmentId: 'segment-e2e',
  filename: 'fixture-clip.mp4',
  path: '/tmp/fixture-clip.mp4',
  startSec: 10,
  endSec: 40,
  durationSec: 30,
  createdAt: NOW,
  hasEdits: false,
};

const edits = {
  clipId: 'clip-e2e',
  schemaVersion: 1,
  trim: { startSec: 0, endSec: 30 },
  viewport: {
    preset: '9:16',
    focus: { xCenter: 0.5, yCenter: 0.5 },
    fillMode: 'crop',
    crop: { top: 0, right: 0, bottom: 0, left: 0 },
    placement: { offsetX: 0, offsetY: 0, scale: 1 },
  },
  subtitles: [],
  overlays: [],
  updatedAt: NOW,
};

const transcript = {
  videoId: 'video-e2e',
  lines: [{ text: 'A useful fixture transcript.', start: 12, duration: 3 }],
  microBlocks: [{ start: 12, end: 15, text: 'A useful fixture transcript.' }],
  chunks: [{ start: 12, end: 15, text: 'A useful fixture transcript.' }],
  fetchedAt: NOW,
};

const settings = {
  registry: {
    groups: [
      {
        id: 'selection',
        label: 'Segment Selection',
        fields: [
          {
            key: 'SCORE_THRESHOLD',
            label: 'Score Threshold',
            description: 'Minimum score required to select a clip.',
            widget: 'slider',
            required: false,
            secret: false,
            defaultValue: 7,
            min: 1,
            max: 10,
          },
        ],
      },
    ],
  },
  values: { SCORE_THRESHOLD: 7 },
};

function sendJson(response: ServerResponse, status: number, body: unknown): void {
  response.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  response.end(JSON.stringify(body));
}

function isAuthenticated(request: IncomingMessage): boolean {
  return (
    request.headers.cookie?.split(';').some((part) => part.trim() === 'vc_session=e2e-session') ??
    false
  );
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  if (chunks.length === 0) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8')) as unknown;
}

const server = createServer(async (request: IncomingMessage, response: ServerResponse) => {
  const url = new URL(request.url ?? '/', `http://${request.headers.host ?? `127.0.0.1:${PORT}`}`);

  if (url.pathname === '/health') {
    sendJson(response, 200, { ready: true });
    return;
  }

  if (url.pathname === '/api/me') {
    if (!isAuthenticated(request)) {
      sendJson(response, 401, { error: { message: 'Sign in to continue.' } });
      return;
    }
    sendJson(response, 200, { customer });
    return;
  }

  if (!isAuthenticated(request)) {
    sendJson(response, 401, { error: { message: 'Sign in to continue.' } });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/channel') {
    sendJson(response, 200, {
      channelId: 'channel-e2e',
      title: 'Fixture Channel',
      handle: '@fixture',
    });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/videos') {
    sendJson(response, 200, { videos: [], total: 0 });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/analyses/analysis-e2e') {
    sendJson(response, 200, analysis);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/clips') {
    sendJson(response, 200, { clips: [clip] });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/youtube/connection') {
    sendJson(response, 200, { connected: false, oauthConfigured: false });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/publish/drafts/analysis-e2e') {
    sendJson(response, 404, { error: { message: 'Draft not found.' } });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/settings') {
    sendJson(response, 200, settings);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/clips/clip-e2e/edits') {
    sendJson(response, 200, { edits });
    return;
  }

  if (request.method === 'PUT' && url.pathname === '/api/clips/clip-e2e/edits') {
    const body = await readJson(request);
    sendJson(response, 200, { edits: body });
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/videos/video-e2e/transcript') {
    sendJson(response, 200, transcript);
    return;
  }

  if (request.method === 'GET' && url.pathname === '/api/clips/clip-e2e/file') {
    response.writeHead(204, { 'cache-control': 'no-store' });
    response.end();
    return;
  }

  sendJson(response, 404, {
    error: { message: `No E2E fixture for ${request.method} ${url.pathname}.` },
  });
});

function shutdown(): void {
  server.close(() => process.exit(0));
}

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`E2E fixture API listening on http://127.0.0.1:${PORT}\n`);
});
