type RouterLike = {
  canGoBack?: () => boolean;
  back: () => void;
  replace: unknown;
};

/** Safely navigates backward, falling back to a stable route when no back stack exists. */
export function safeBack(router: RouterLike, fallbackHref: string = '/(tabs)/(games)'): void {
  try {
    if (typeof router.canGoBack === 'function' && router.canGoBack()) {
      router.back();
      return;
    }
  } catch (error) {
    if (__DEV__) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(`[Navigation] canGoBack check failed: ${message}`);
    }
  }

  if (typeof router.replace === 'function') {
    (router.replace as (href: string) => void)(fallbackHref);
  }
}
