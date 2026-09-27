import React from 'react';
import { navigate } from './router';

export interface LinkProps extends React.AnchorHTMLAttributes<HTMLAnchorElement> {
  href: string;
  /** Replace the current history entry instead of adding one. */
  replace?: boolean;
}

/**
 * A link to a page of the dashboard. A plain click opens it without reloading; a click with a
 * modifier key or the middle button is left to the browser, so it can open in a new tab.
 */
export const Link: React.FC<LinkProps> = ({ href, replace, onClick, target, children, ...rest }) => {
  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event);
    if (
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      (target && target !== '_self')
    ) {
      return;
    }
    event.preventDefault();
    navigate(href, { replace });
  };

  return (
    <a href={href} target={target} onClick={handleClick} {...rest}>
      {children}
    </a>
  );
};
