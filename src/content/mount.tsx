import { createRoot } from 'react-dom/client';
import type { ReactNode } from 'react';
import styles from '@/styles.css?inline';

// YouTube sets the root font size to 10px, so rem-based Tailwind sizes are
// pinned to pixels. Shadow roots also ignore @property, which Tailwind relies
// on for its --tw-* defaults; those are re-declared on every element instead.
const ROOT_FONT_SIZE = 16;
export function shadowStyles(css: string) {
  const initial = [...css.matchAll(/@property\s+(--tw-[\w-]+)\s*\{([^}]+)\}/g)]
    .flatMap((match) => {
      const value = match[2].match(/initial-value:\s*([^;}]+)/)?.[1];
      return value ? [`${match[1]}:${value};`] : [];
    })
    .join('');
  const toPixels = (text: string) =>
    text.replace(
      /([:\s,(*/+=<>-])(-?(?:\d+\.?\d*|\.\d+))rem\b/g,
      (_, before: string, value: string) =>
        `${before}${Number((Number(value) * ROOT_FONT_SIZE).toFixed(3))}px`,
    );
  const pixels = css.replace(/@(?:media|container)[^{;]*(?=\{)|[^{};]+(?=[;}])/g, toPixels);
  return `${pixels.replaceAll(':root', ':host')}\n@layer properties{*,::before,::after{${initial}}}\n:host,[data-root]{font:14px/1.5 Roboto,Arial,system-ui,sans-serif;color:var(--foreground);-webkit-font-smoothing:antialiased}`;
}

export function mount(node: ReactNode) {
  const host = document.createElement('youtube-triage');
  host.style.cssText = 'all:initial;position:fixed;inset:0;z-index:2147483646;pointer-events:none';
  const shadow = host.attachShadow({ mode: 'open' });
  const style = document.createElement('style');
  style.textContent = shadowStyles(styles);
  const container = document.createElement('div');
  container.setAttribute('data-root', '');
  shadow.append(style, container);
  document.body.append(host);
  createRoot(container).render(node);
}
