import { OPEN_HASH, OPEN_MESSAGE } from '@/shared/messages';

chrome.action.onClicked.addListener(async (tab) => {
  try {
    // Succeeds only on a YouTube tab whose content script is listening.
    if (tab.id !== undefined) return void (await chrome.tabs.sendMessage(tab.id, OPEN_MESSAGE));
  } catch {}
  await chrome.tabs.create({ url: `https://www.youtube.com/playlist?list=WL${OPEN_HASH}` });
});
