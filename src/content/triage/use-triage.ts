import { useCallback, useEffect, useRef, useState } from 'react';
import type { YouTube } from '../bridge';
import { initialState, reducer, type Action, type Verdict } from './state';

/** Load the next page once fewer than this many cards are left. */
const PREFETCH = 15;

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

export function useTriage(youtube: YouTube) {
  // Decisions read the latest state synchronously, so two quick swipes can
  // never act on the same card.
  const store = useRef(initialState);
  const [state, setState] = useState(initialState);
  const dispatch = useCallback((action: Action) => {
    store.current = reducer(store.current, action);
    setState(store.current);
  }, []);

  // Writes run one at a time, in the order they were made, so an undo always
  // lands after the removal it reverses.
  const tail = useRef<Promise<unknown>>(Promise.resolve());
  const serial = useCallback(<T>(task: () => Promise<T>) => {
    const run = tail.current.then(task);
    tail.current = run.catch(() => {});
    return run;
  }, []);
  const removals = useRef(new Map<number, Promise<boolean>>());
  // A re-added video gets a new setVideoId from YouTube.
  const reissued = useRef(new Map<number, string>());
  const setVideoId = (index: number) =>
    reissued.current.get(index) ?? store.current.videos[index].setVideoId;

  const load = useCallback(
    async (continuation: string | null) => {
      dispatch({ type: 'loading' });
      try {
        dispatch({ type: 'loaded', page: await youtube.list(continuation) });
      } catch (error) {
        dispatch({ type: 'error', error: message(error) });
      }
    },
    [dispatch, youtube],
  );

  useEffect(() => {
    void load(null);
  }, [load]);

  const { loaded, loading, error, continuation, videos, cursor } = state;
  useEffect(() => {
    if (loaded && !loading && !error && continuation && videos.length - cursor < PREFETCH)
      void load(continuation);
  }, [loaded, loading, error, continuation, videos.length, cursor, load]);

  const decide = (verdict: Verdict) => {
    const index = store.current.cursor;
    const video = store.current.videos[index];
    if (!video) return;
    dispatch({ type: 'decide', verdict });
    if (verdict === 'watch')
      window.open(`https://www.youtube.com/watch?v=${video.videoId}`, '_blank', 'noopener');
    if (verdict === 'remove')
      removals.current.set(
        index,
        serial(() => youtube.remove(setVideoId(index))).then(
          () => true,
          (e) => {
            dispatch({
              type: 'failed',
              index,
              error: `Couldn't remove “${video.title}”: ${message(e)}`,
            });
            return false;
          },
        ),
      );
  };

  const undo = () => {
    const last = store.current.history.at(-1);
    if (!last) return;
    dispatch({ type: 'undo' });
    if (last.verdict !== 'remove') return;
    const removed = removals.current.get(last.index);
    removals.current.delete(last.index);
    const video = store.current.videos[last.index];
    serial(async () => {
      if (!(await removed)) return;
      // Undo is last-in-first-out, so the next video is back in the playlist by now.
      const successor = store.current.videos[last.index + 1] ? setVideoId(last.index + 1) : null;
      reissued.current.set(last.index, await youtube.restore(video.videoId, successor));
    }).catch((e) =>
      dispatch({ type: 'error', error: `Couldn't put back “${video.title}”: ${message(e)}` }),
    );
  };

  /** Resolves once every queued change has reached YouTube. */
  const settled = () => tail.current;

  return { state, decide, undo, settled };
}
