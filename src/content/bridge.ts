import { z } from 'zod';
import { REQUEST_EVENT, RESPONSE_EVENT, type Page, type Request } from '@/shared/protocol';

const video = z.object({
  videoId: z.string(),
  setVideoId: z.string(),
  title: z.string(),
  channel: z.string(),
  info: z.string(),
  duration: z.string().nullable(),
  thumbnail: z.url(),
  progress: z.number(),
});
const page = z.object({ videos: z.array(video), continuation: z.string().nullable() });
const reply = z.discriminatedUnion('ok', [
  z.object({ id: z.string(), ok: z.literal(true), result: z.unknown() }),
  z.object({ id: z.string(), ok: z.literal(false), error: z.string() }),
]);

const TIMEOUT = 20_000;

function send(request: Request): Promise<unknown> {
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const done = () => {
      clearTimeout(timer);
      document.removeEventListener(RESPONSE_EVENT, receive);
    };
    const receive = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (typeof detail !== 'string') return;
      const parsed = reply.safeParse(JSON.parse(detail));
      if (!parsed.success || parsed.data.id !== id) return;
      done();
      if (parsed.data.ok) resolve(parsed.data.result);
      else reject(new Error(parsed.data.error));
    };
    const timer = setTimeout(() => {
      done();
      reject(new Error('YouTube Triage lost contact with the page. Reload this YouTube tab.'));
    }, TIMEOUT);
    document.addEventListener(RESPONSE_EVENT, receive);
    document.dispatchEvent(
      new CustomEvent(REQUEST_EVENT, { detail: JSON.stringify({ id, ...request }) }),
    );
  });
}

export const youtube = {
  list: async (continuation: string | null): Promise<Page> =>
    page.parse(await send({ op: 'list', continuation })),
  remove: async (setVideoId: string) => {
    await send({ op: 'remove', setVideoId });
  },
  restore: async (videoId: string, successor: string | null) =>
    z.string().parse(await send({ op: 'restore', videoId, successor })),
};

export type YouTube = typeof youtube;
