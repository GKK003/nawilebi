import type { ComponentProps, MouseEvent } from 'react';

export const storeNavigationEvent = 'store:navigate';

export function navigateToStore(href: string) {
  const current = window.location.pathname + window.location.search + window.location.hash;
  if (current !== href) {
    window.history.pushState(null, '', href);
    window.dispatchEvent(new Event(storeNavigationEvent));
  }
}

export default function StoreLink({ href, ...props }: Omit<ComponentProps<'a'>, 'onClick' | 'target' | 'download'> & { href: string }) {
  function navigate(event: MouseEvent<HTMLAnchorElement>) {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    navigateToStore(href);
  }

  return <a {...props} href={href} onClick={navigate} />;
}
