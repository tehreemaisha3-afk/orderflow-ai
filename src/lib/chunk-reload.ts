const KEY = "lovable:chunk-reloaded-at";
const COOLDOWN_MS = 30_000;

export function isChunkLoadError(error: unknown): boolean {
  const message =
    error instanceof Error ? error.message : typeof error === "string" ? error : "";
  return (
    /Failed to fetch dynamically imported module/i.test(message) ||
    /error loading dynamically imported module/i.test(message) ||
    /Importing a module script failed/i.test(message) ||
    /ChunkLoadError/i.test(message)
  );
}

/** Reload once (with a cooldown) so the browser picks up the new asset manifest. */
export function reloadForNewBuild(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const last = Number(sessionStorage.getItem(KEY) ?? 0);
    if (Date.now() - last < COOLDOWN_MS) return false;
    sessionStorage.setItem(KEY, String(Date.now()));
  } catch {
    /* storage unavailable — still attempt one reload */
  }
  window.location.reload();
  return true;
}

/** Recovers from stale chunk references left over after a new deploy. */
export function installChunkReloadHandler() {
  if (typeof window === "undefined") return;
  window.addEventListener("vite:preloadError", (event) => {
    event.preventDefault();
    reloadForNewBuild();
  });
  window.addEventListener("unhandledrejection", (event) => {
    if (isChunkLoadError(event.reason)) reloadForNewBuild();
  });
  window.addEventListener("error", (event) => {
    if (isChunkLoadError(event.error ?? event.message)) reloadForNewBuild();
  });
}
