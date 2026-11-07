import { useEffect, useState } from 'react';
import { Layers } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { OPEN_MESSAGE, OPEN_HASH } from '@/shared/messages';
import { youtube } from './bridge';
import { mount } from './mount';
import { Triage } from './triage/triage';

const onWatchLater = () =>
  location.pathname === '/playlist' && new URLSearchParams(location.search).get('list') === 'WL';

function App() {
  const [open, setOpen] = useState(() => location.hash === OPEN_HASH);
  const [watchLater, setWatchLater] = useState(onWatchLater);
  const dark = document.documentElement.hasAttribute('dark');

  useEffect(() => {
    if (location.hash === OPEN_HASH)
      history.replaceState(history.state, '', location.href.split('#')[0]);
    const onMessage = (message: unknown) => {
      if (message === OPEN_MESSAGE) setOpen(true);
    };
    // YouTube is a single-page app: it fires this after every in-app navigation.
    const onNavigate = () => setWatchLater(onWatchLater());
    chrome.runtime.onMessage.addListener(onMessage);
    document.addEventListener('yt-navigate-finish', onNavigate);
    return () => {
      chrome.runtime.onMessage.removeListener(onMessage);
      document.removeEventListener('yt-navigate-finish', onNavigate);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const root = document.documentElement;
    const overflow = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = overflow;
    };
  }, [open]);

  const close = (changed: boolean) => {
    setOpen(false);
    // The playlist YouTube rendered underneath still lists the removed videos.
    if (changed && onWatchLater()) location.reload();
  };

  return (
    <div className={dark ? 'dark' : undefined}>
      {open ? (
        <Triage youtube={youtube} onClose={close} />
      ) : (
        watchLater && (
          <Button
            onClick={() => setOpen(true)}
            className="pointer-events-auto fixed right-6 bottom-6 h-12 rounded-full bg-brand px-5 text-base text-white shadow-lg hover:bg-brand/90"
          >
            <Layers className="size-5" />
            Triage
          </Button>
        )
      )}
    </div>
  );
}

mount(<App />);
