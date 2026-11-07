// Runs in YouTube's own JavaScript world, the only place with the InnerTube
// client config (`ytcfg`). Requests are signed the way youtube.com signs its
// own: a SAPISIDHASH derived from the session cookie. Nothing leaves youtube.com.
import { REQUEST_EVENT, RESPONSE_EVENT, type Envelope, type Reply } from '@/shared/protocol';
import { addedSetVideoId, parsePage } from './parse';

declare const ytcfg: { get(key: string): unknown };

const PLAYLIST = 'WL';

const cookie = (name: string) =>
  document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`))?.[1] ?? null;

async function authorization() {
  const sapisid = cookie('SAPISID') ?? cookie('__Secure-3PAPISID');
  if (!sapisid) throw new Error('Sign in to YouTube to triage your Watch Later.');
  const timestamp = Math.floor(Date.now() / 1000);
  const digest = await crypto.subtle.digest(
    'SHA-1',
    new TextEncoder().encode(`${timestamp} ${sapisid} ${location.origin}`),
  );
  const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
  return `SAPISIDHASH ${timestamp}_${hex}`;
}

async function innertube(endpoint: string, body: object) {
  const response = await fetch(`/youtubei/v1/${endpoint}?prettyPrint=false`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      authorization: await authorization(),
      'x-origin': location.origin,
      'x-goog-authuser': String(ytcfg.get('SESSION_INDEX') ?? 0),
    },
    body: JSON.stringify({ context: ytcfg.get('INNERTUBE_CONTEXT'), ...body }),
  });
  if (!response.ok) throw new Error(`YouTube answered ${response.status}.`);
  return response.json();
}

async function edit(actions: object[]) {
  const result = await innertube('browse/edit_playlist', { playlistId: PLAYLIST, actions });
  if (result.status !== 'STATUS_SUCCEEDED') throw new Error('YouTube rejected the change.');
  return result;
}

async function handle(request: Envelope): Promise<unknown> {
  switch (request.op) {
    case 'list':
      return parsePage(
        await innertube(
          'browse',
          request.continuation
            ? { continuation: request.continuation }
            : { browseId: `VL${PLAYLIST}` },
        ),
      );
    case 'remove':
      await edit([{ action: 'ACTION_REMOVE_VIDEO', setVideoId: request.setVideoId }]);
      return null;
    case 'restore': {
      const setVideoId = addedSetVideoId(
        await edit([{ action: 'ACTION_ADD_VIDEO', addedVideoId: request.videoId }]),
      );
      await edit([
        {
          action: 'ACTION_MOVE_VIDEO_BEFORE',
          setVideoId,
          ...(request.successor && { movedSetVideoIdSuccessor: request.successor }),
        },
      ]);
      return setVideoId;
    }
  }
}

document.addEventListener(REQUEST_EVENT, async (event) => {
  const detail = (event as CustomEvent<unknown>).detail;
  if (typeof detail !== 'string') return;
  const request = JSON.parse(detail) as Envelope;
  let reply: Reply;
  try {
    reply = { id: request.id, ok: true, result: await handle(request) };
  } catch (error) {
    reply = { id: request.id, ok: false, error: (error as Error).message };
  }
  document.dispatchEvent(new CustomEvent(RESPONSE_EVENT, { detail: JSON.stringify(reply) }));
});
