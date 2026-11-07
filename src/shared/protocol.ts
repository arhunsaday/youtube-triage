// Contract between the isolated content script (UI) and the page-world script
// that talks to YouTube. Payloads cross worlds as JSON strings: Firefox does not
// share object `detail`s between worlds.
export const REQUEST_EVENT = 'youtube-triage:request';
export const RESPONSE_EVENT = 'youtube-triage:response';

export type Video = {
  videoId: string;
  /** Identifies this entry inside the playlist; changes when a video is re-added. */
  setVideoId: string;
  title: string;
  channel: string;
  info: string;
  duration: string | null;
  thumbnail: string;
  /** Percent of the video already watched. */
  progress: number;
};

export type Page = { videos: Video[]; continuation: string | null };

export type Request =
  | { op: 'list'; continuation: string | null }
  | { op: 'remove'; setVideoId: string }
  /** Re-adds a removed video right before `successor`, or at the end when null. */
  | { op: 'restore'; videoId: string; successor: string | null };

export type Envelope = { id: string } & Request;

export type Reply = { id: string } & ({ ok: true; result: unknown } | { ok: false; error: string });
