import type { Page, Video } from '@/shared/protocol';

type Json = Record<string, unknown>;
type Text = { simpleText?: string; runs?: { text: string }[] } | undefined;

const text = (value: Text) => value?.simpleText ?? value?.runs?.map((r) => r.text).join('') ?? '';

// YouTube reshuffles the wrappers around playlist items often; the item and
// continuation renderers themselves are stable, so find them wherever they are.
function walk(node: unknown, visit: (node: Json) => void) {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) {
    for (const child of node) walk(child, visit);
    return;
  }
  visit(node as Json);
  for (const child of Object.values(node)) walk(child, visit);
}

function toVideo(r: Json): Video | null {
  const videoId = r.videoId;
  const setVideoId = r.setVideoId;
  if (typeof videoId !== 'string' || typeof setVideoId !== 'string') return null;
  const thumbnails = (r.thumbnail as { thumbnails?: { url: string }[] } | undefined)?.thumbnails;
  let progress = 0;
  walk(r.thumbnailOverlays, (o) => {
    const resume = o.thumbnailOverlayResumePlaybackRenderer as
      { percentDurationWatched?: number } | undefined;
    if (resume?.percentDurationWatched) progress = resume.percentDurationWatched;
  });
  return {
    videoId,
    setVideoId,
    title: text(r.title as Text),
    channel: text(r.shortBylineText as Text),
    info: text(r.videoInfo as Text),
    duration: text(r.lengthText as Text) || null,
    thumbnail: thumbnails?.at(-1)?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    progress,
  };
}

export function parsePage(response: unknown): Page {
  const videos: Video[] = [];
  let continuation: string | null = null;
  walk(response, (node) => {
    const item = node.playlistVideoRenderer as Json | undefined;
    const video = item && toVideo(item);
    if (video) videos.push(video);
    const token = (node.continuationCommand as { token?: string } | undefined)?.token;
    if (token) continuation = token;
  });
  return { videos, continuation };
}

/** The setVideoId YouTube assigned to a video that `edit_playlist` just added. */
export function addedSetVideoId(response: unknown): string {
  let id: string | null = null;
  walk(response, (node) => {
    const added = node.playlistEditVideoAddedResultData as { setVideoId?: string } | undefined;
    if (added?.setVideoId) id = added.setVideoId;
  });
  if (!id) throw new Error('YouTube did not confirm the video was re-added.');
  return id;
}
