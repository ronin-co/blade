import { Link as NativeLink } from 'blade/client/components';
import type { ComponentProps } from 'react';

export const Link = ({ href, children }: ComponentProps<typeof NativeLink>) => {
  const isExternal = typeof href === 'string' && href.startsWith('http');
  if (isExternal)
    return (
      <a
        className="text-cyan-600 transition-colors duration-200 hover:text-cyan-800"
        href={href}>
        {children}
      </a>
    );

  return (
    <NativeLink
      className="text-cyan-600 transition-colors duration-200 hover:text-cyan-800"
      href={href}>
      {children}
    </NativeLink>
  );
};
