import { Link as NativeLink } from 'blade/client/components';
import type { AnchorHTMLAttributes, ReactElement } from 'react';

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  href: string;
  children: ReactElement;
}

export const Link = ({ href, children }: LinkProps) => {
  const isExternal = typeof href === 'string' && href.startsWith('http');

  const props: LinkProps = {
    href,
    className: 'text-cyan-600 transition-colors duration-200 hover:text-cyan-800',
    children,
  };

  if (isExternal) {
    return (
      <a
        {...props}
        target="_blank"
        rel="noreferrer"
      />
    );
  }

  return <NativeLink {...props} />;
};
