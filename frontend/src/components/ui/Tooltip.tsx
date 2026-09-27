import React from 'react';
import { useTooltip, type TooltipOptions } from './useTooltip';

type TriggerElement = React.ReactElement<
  React.HTMLAttributes<HTMLElement> & { ref?: React.Ref<HTMLElement> }
>;

export interface TooltipProps extends TooltipOptions {
  /** One focusable element, such as a button. Its own handlers still run. */
  children: TriggerElement;
}

const chain =
  <A extends unknown[]>(first: ((...args: A) => void) | undefined, second: (...args: A) => void) =>
  (...args: A) => {
    first?.(...args);
    second(...args);
  };

/** Wraps one focusable element and shows `content` on hover and keyboard focus. */
export const Tooltip: React.FC<TooltipProps> = ({ children, ...options }) => {
  const { triggerProps, tooltip } = useTooltip(options);
  const own = children.props;
  const describedBy = [own['aria-describedby'], triggerProps['aria-describedby']].filter(Boolean).join(' ');
  return (
    <>
      {React.cloneElement(children, {
        ref: triggerProps.ref,
        onMouseEnter: chain(own.onMouseEnter, triggerProps.onMouseEnter),
        onMouseLeave: chain(own.onMouseLeave, triggerProps.onMouseLeave),
        onFocus: chain(own.onFocus, triggerProps.onFocus),
        onBlur: chain(own.onBlur, triggerProps.onBlur),
        'aria-describedby': describedBy || undefined,
      })}
      {tooltip}
    </>
  );
};
