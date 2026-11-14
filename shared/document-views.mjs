export function documentViewsEndpoint(value) {
  if (typeof value !== 'string' || !/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev\/?$/i.test(value.trim())) return '';
  return new URL(value.trim()).origin;
}

export function documentSiteUrl(value) {
  let url;
  try { url = new URL(value); } catch { return null; }
  if (url.protocol !== 'https:' || url.username || url.password || url.port ||
      !/^[a-z0-9-]+\.github\.io$/i.test(url.hostname) || url.search || url.hash ||
      !/^\/(?:[a-z0-9_.-]+\/)?$/i.test(url.pathname)) return null;
  return url;
}
