import { documentViewsEndpoint } from '../shared/document-views.mjs';

let reported = false;

function browserId(site) {
  try {
    const key = 'xiaomeng-document-visitor:' + site;
    const existing = localStorage.getItem(key);
    if (existing) return existing;
    const id = crypto.randomUUID();
    localStorage.setItem(key, id);
    return id;
  } catch {
    return '';
  }
}

export function reportPublishedDocumentOpen() {
  if (reported) return;
  reported = true;
  const send = async () => {
    if (document.visibilityState !== 'visible') return;
    document.removeEventListener('visibilitychange', send);
    try {
      const response = await fetch('./document-views.json', {
        credentials: 'omit', redirect: 'error', cache: 'no-cache',
      });
      if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) return;
      const config = await response.json();
      const endpoint = documentViewsEndpoint(config?.endpoint);
      if (!endpoint) return;
      // One count per document load. Section switches and URL parameters do not add views.
      const site = new URL('./', window.location.href).href;
      await fetch(new URL('/v1/view', endpoint), {
        method: 'POST', credentials: 'omit', redirect: 'error', keepalive: true,
        referrerPolicy: 'no-referrer', headers: { 'Content-Type': 'text/plain' },
        body: site + '\n' + browserId(site),
      });
    } catch {
      // The public document remains readable when the counter is unavailable.
    }
  };
  document.addEventListener('visibilitychange', send);
  void send();
}
