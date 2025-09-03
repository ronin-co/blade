import { Link as NativeLink } from 'blade/client/components';

export const Link = ({ href, children }: { href: string; children: React.ReactNode }) => {
  return (
    <NativeLink href={href}>
      <a className="text-cyan-600 transition-colors duration-200 hover:text-cyan-800">
        {children}
      </a>
    </NativeLink>
  );
};
