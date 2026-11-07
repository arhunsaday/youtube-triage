import {
  motion,
  useMotionValue,
  useTransform,
  type MotionValue,
  type PanInfo,
  type Variants,
} from 'motion/react';
import type { Video } from '@/shared/protocol';
import { cn } from '@/lib/utils';
import type { Verdict } from './state';

const DISTANCE = 120;
const SPEED = 600;

export function verdictFor({ offset, velocity }: PanInfo): Verdict | null {
  if (offset.y < -DISTANCE || velocity.y < -SPEED) return 'watch';
  if (offset.x < -DISTANCE || velocity.x < -SPEED) return 'remove';
  if (offset.x > DISTANCE || velocity.x > SPEED) return 'keep';
  return null;
}

const variants: Variants = {
  stacked: (depth: number) => ({ scale: 1 - depth * 0.05, y: depth * 16, opacity: 1 }),
  exit: (verdict: Verdict | undefined) =>
    verdict === 'watch'
      ? { y: -700, opacity: 0, transition: { duration: 0.3 } }
      : { x: verdict === 'remove' ? -700 : 700, opacity: 0, transition: { duration: 0.3 } },
};

function Stamp({
  label,
  className,
  opacity,
}: {
  label: string;
  className: string;
  opacity: MotionValue<number>;
}) {
  return (
    <motion.span
      style={{ opacity }}
      className={cn(
        'pointer-events-none absolute top-6 rounded-lg border-4 px-3 py-1 text-2xl font-black tracking-wider uppercase',
        className,
      )}
    >
      {label}
    </motion.span>
  );
}

export function Card({
  video,
  depth,
  onDecide,
}: {
  video: Video;
  depth: number;
  onDecide: (verdict: Verdict) => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-300, 300], [-15, 15]);
  const remove = useTransform(x, [-DISTANCE, -20], [1, 0]);
  const keep = useTransform(x, [20, DISTANCE], [0, 1]);
  const watch = useTransform(y, [-DISTANCE, -20], [1, 0]);
  const top = depth === 0;

  return (
    <motion.article
      custom={depth}
      variants={variants}
      initial={{ scale: 0.9, y: 32, opacity: 0 }}
      animate="stacked"
      exit="exit"
      style={{ x, y, rotate, zIndex: 10 - depth }}
      drag={top}
      dragSnapToOrigin
      dragElastic={0.9}
      onDragEnd={(_, info) => {
        const verdict = verdictFor(info);
        if (verdict) onDecide(verdict);
      }}
      aria-hidden={!top}
      className={cn(
        'absolute inset-x-0 top-0 overflow-hidden rounded-2xl border bg-card shadow-2xl select-none',
        top ? 'cursor-grab touch-none active:cursor-grabbing' : 'pointer-events-none',
      )}
    >
      <div className="relative aspect-video bg-muted">
        <img src={video.thumbnail} alt="" draggable={false} className="size-full object-cover" />
        {video.duration && (
          <span className="absolute right-2 bottom-2 rounded bg-black/80 px-1.5 py-0.5 text-xs font-medium text-white">
            {video.duration}
          </span>
        )}
        {video.progress > 0 && (
          <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30">
            <div className="h-full bg-brand" style={{ width: `${video.progress}%` }} />
          </div>
        )}
      </div>
      <div className="space-y-1 p-4">
        <h2 className="line-clamp-2 text-lg leading-snug font-semibold">{video.title}</h2>
        <p className="truncate text-sm text-muted-foreground">
          {[video.channel, video.info].filter(Boolean).join(' · ')}
        </p>
      </div>
      {top && (
        <>
          <Stamp
            label="Remove"
            opacity={remove}
            className="right-6 rotate-12 border-destructive text-destructive"
          />
          <Stamp
            label="Keep"
            opacity={keep}
            className="left-6 -rotate-12 border-success text-success"
          />
          <Stamp
            label="Watch"
            opacity={watch}
            className="left-1/2 -translate-x-1/2 border-watch text-watch"
          />
        </>
      )}
    </motion.article>
  );
}
