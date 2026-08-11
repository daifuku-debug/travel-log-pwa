(function registerTravelLogSpaFallback(global) {
  const BASE_PATH = '/travel-log-pwa/';
  const REDIRECT_PARAMETER = '__spa';
  const APP_ROUTE_ROOTS = Object.freeze([
    'trips',
    'japan-map',
    'castles',
    'time-machine',
    'travel-gacha',
    'rpg',
    'collections',
    'wishlist',
    'settings',
    'more',
  ]);
  const EXCLUDED_ROUTE_ROOTS = Object.freeze(['api', 'cdn-cgi']);

  function getRelativePath(pathname) {
    if (pathname === BASE_PATH.slice(0, -1)) return '';
    if (!pathname.startsWith(BASE_PATH)) return undefined;
    return pathname.slice(BASE_PATH.length).replace(/^\/+/, '');
  }

  function isAppPath(pathname) {
    const relativePath = getRelativePath(pathname);
    if (relativePath === undefined) return false;
    if (relativePath === '') return true;

    const routeRoot = relativePath.split('/')[0];
    if (EXCLUDED_ROUTE_ROOTS.includes(routeRoot)) return false;
    if (/\.[^/]+$/.test(relativePath)) return false;
    return APP_ROUTE_ROOTS.includes(routeRoot);
  }

  function createRedirectUrl(locationLike) {
    if (!isAppPath(locationLike.pathname) || getRelativePath(locationLike.pathname) === '') return undefined;

    const redirectUrl = new URL(BASE_PATH, locationLike.origin);
    redirectUrl.searchParams.set(
      REDIRECT_PARAMETER,
      `${locationLike.pathname}${locationLike.search || ''}${locationLike.hash || ''}`,
    );
    return redirectUrl.href;
  }

  function restoreRedirectLocation(locationLike, historyLike) {
    const parameters = new URLSearchParams(locationLike.search);
    const target = parameters.get(REDIRECT_PARAMETER);
    if (!target) return false;

    const targetUrl = new URL(target, locationLike.origin);
    if (targetUrl.origin !== locationLike.origin || !isAppPath(targetUrl.pathname)) return false;

    historyLike.replaceState(null, '', `${targetUrl.pathname}${targetUrl.search}${targetUrl.hash}`);
    return true;
  }

  global.TravelLogSpaFallback = Object.freeze({
    APP_ROUTE_ROOTS,
    BASE_PATH,
    createRedirectUrl,
    isAppPath,
    restoreRedirectLocation,
  });
})(globalThis);
