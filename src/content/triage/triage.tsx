import { useEffect, useState, type ReactNode } from 'react';
import { AnimatePresence } from 'motion/react';
import { ArrowUp, Check, LoaderCircle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import type { YouTube } from '../bridge';
import { Card } from './card';
import { summary, type Verdict } from './state';
import { useTriage } from './use-triage';

const KEYS: Record<string, Verdict> = { ArrowLeft: 'remove', ArrowRight: 'keep', ArrowUp: 'watch' };

function Kbd({ children }: { children: ReactNode }) {
  return (
    <kbd className="rounded border border-current/30 px-1 font-sans text-[11px] leading-4 opacity-70">
      {children}
    </kbd>
  );
}

function Message({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <h2 className="text-2xl font-semibold">{title}</h2>
      {children}
    </div>
  );
}

export function Triage({
  youtube,
  onClose,
}: {
  youtube: YouTube;
  onClose: (changed: boolean) => void;
}) {
  const { state, decide, undo, settled } = useTriage(youtube);
  const { removed, kept, current, finished, total, more } = summary(state);
  const [closing, setClosing] = useState(false);
  const lastVerdict = state.history.at(-1)?.verdict;
  const stack = state.videos.slice(state.cursor, state.cursor + 3);

  const close = async () => {
    setClosing(true);
    await settled();
    onClose(removed > 0);
  };

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const verdict = KEYS[event.key];
      const isUndo = event.key.toLowerCase() === 'z' || event.key === 'Backspace';
      if (!verdict && !isUndo && event.key !== 'Escape') return;
      // Keep YouTube's own shortcuts from firing underneath the overlay.
      event.preventDefault();
      event.stopImmediatePropagation();
      if (event.repeat || closing) return;
      if (event.key === 'Escape') void close();
      else if (isUndo) undo();
      else if (verdict) decide(verdict);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Triage Watch Later"
      className="pointer-events-auto fixed inset-0 flex flex-col bg-background/95 text-foreground backdrop-blur-md"
    >
      <header className="flex items-center gap-3 px-6 py-4">
        <h1 className="text-lg font-semibold">Watch Later</h1>
        {state.loaded && total > 0 && (
          <span className="text-sm text-muted-foreground tabular-nums">
            {Math.min(state.cursor + 1, total)} / {total}
            {more && '+'}
          </span>
        )}
        <span className="ml-auto text-sm text-muted-foreground tabular-nums">
          <span className="text-destructive">{removed} removed</span> ·{' '}
          <span className="text-success">{kept} kept</span>
        </span>
        <Button variant="ghost" size="icon" aria-label="Close" onClick={close} disabled={closing}>
          {closing ? <LoaderCircle className="animate-spin" /> : <X />}
        </Button>
      </header>

      {state.error && (
        <p
          role="alert"
          className="mx-auto max-w-xl rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive"
        >
          {state.error}
        </p>
      )}

      <main className="flex flex-1 flex-col items-center justify-center gap-10 px-4">
        {finished ? (
          <Message title={total === 0 ? 'Watch Later is empty' : 'All triaged'}>
            <Button onClick={close} disabled={closing}>
              Done
            </Button>
          </Message>
        ) : !current ? (
          <LoaderCircle className="size-8 animate-spin text-muted-foreground" />
        ) : (
          <>
            <div className="relative aspect-[4/3] w-[min(480px,90vw)]">
              <AnimatePresence custom={lastVerdict}>
                {stack
                  .map((video, depth) => (
                    <Card
                      key={`${state.cursor + depth}-${video.videoId}`}
                      video={video}
                      depth={depth}
                      onDecide={decide}
                    />
                  ))
                  .reverse()}
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="icon-lg"
                aria-label="Undo"
                onClick={undo}
                disabled={state.history.length === 0}
                className="rounded-full"
              >
                <RotateCcw />
              </Button>
              <Action
                label="Remove"
                hint="←"
                className="text-destructive"
                onClick={() => decide('remove')}
              >
                <X />
              </Action>
              <Action label="Watch" hint="↑" className="text-watch" onClick={() => decide('watch')}>
                <ArrowUp />
              </Action>
              <Action label="Keep" hint="→" className="text-success" onClick={() => decide('keep')}>
                <Check />
              </Action>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function Action({
  label,
  hint,
  className,
  onClick,
  children,
}: {
  label: string;
  hint: string;
  className: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <Button
      variant="outline"
      onClick={onClick}
      className={cn('h-14 rounded-full px-6 text-base [&_svg]:size-5', className)}
    >
      {children}
      {label}
      <Kbd>{hint}</Kbd>
    </Button>
  );
}
