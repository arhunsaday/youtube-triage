import { describe, expect, it } from 'vitest';
import { initialState, reducer, summary, type Action, type State } from '@/content/triage/state';
import { verdictFor } from '@/content/triage/card';
import type { Video } from '@/shared/protocol';

const video = (id: string): Video => ({
  videoId: id,
  setVideoId: `S${id}`,
  title: id,
  channel: '',
  info: '',
  duration: null,
  thumbnail: 'https://i.ytimg.com/x.jpg',
  progress: 0,
});

const run = (...actions: Action[]) => actions.reduce<State>(reducer, initialState);
const loaded = (ids: string[], continuation: string | null = null): Action => ({
  type: 'loaded',
  page: { videos: ids.map(video), continuation },
});

describe('triage state', () => {
  it('advances through decisions and counts them', () => {
    const state = run(
      loaded(['a', 'b', 'c']),
      { type: 'decide', verdict: 'remove' },
      { type: 'decide', verdict: 'keep' },
      { type: 'decide', verdict: 'watch' },
    );
    expect(summary(state)).toMatchObject({
      removed: 1,
      kept: 2,
      finished: true,
      current: undefined,
    });
  });

  it('undoes the last decision and returns to its card', () => {
    const state = run(loaded(['a', 'b']), { type: 'decide', verdict: 'remove' }, { type: 'undo' });
    expect(state.cursor).toBe(0);
    expect(summary(state)).toMatchObject({
      removed: 0,
      current: expect.objectContaining({ videoId: 'a' }),
    });
  });

  it('ignores decisions past the end and undo with no history', () => {
    const state = run(
      loaded(['a']),
      { type: 'decide', verdict: 'keep' },
      { type: 'decide', verdict: 'keep' },
    );
    expect(state.history).toHaveLength(1);
    expect(reducer(initialState, { type: 'undo' })).toBe(initialState);
  });

  it('does not count a removal YouTube rejected', () => {
    const state = run(
      loaded(['a', 'b']),
      { type: 'decide', verdict: 'remove' },
      { type: 'failed', index: 0, error: 'nope' },
    );
    expect(summary(state)).toMatchObject({ removed: 0 });
    expect(state.error).toBe('nope');
  });

  it('is not finished while more pages exist', () => {
    const state = run(loaded(['a'], 'NEXT'), { type: 'decide', verdict: 'keep' });
    expect(summary(state)).toMatchObject({ finished: false, more: true });
    expect(summary(reducer(state, loaded(['b'])))).toMatchObject({
      finished: false,
      current: expect.objectContaining({ videoId: 'b' }),
    });
  });
});

describe('swipe verdicts', () => {
  const pan = (x: number, y: number, vx = 0, vy = 0) => ({
    offset: { x, y },
    velocity: { x: vx, y: vy },
    point: { x: 0, y: 0 },
    delta: { x: 0, y: 0 },
  });

  it('maps direction to a verdict past the threshold', () => {
    expect(verdictFor(pan(-200, 0))).toBe('remove');
    expect(verdictFor(pan(200, 0))).toBe('keep');
    expect(verdictFor(pan(0, -200))).toBe('watch');
  });

  it('accepts a quick flick and rejects a small drag', () => {
    expect(verdictFor(pan(-40, 0, -900))).toBe('remove');
    expect(verdictFor(pan(40, 10))).toBeNull();
  });
});
