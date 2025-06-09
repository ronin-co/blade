import { cn } from '@/lib/utils';

export const Metallic = ({
  children,
  className,
}: { children: React.ReactNode; className?: string }) => (
  <p className={cn('h-fit font-custom font-medium text-4xl ', className)}>
    <span
      style={{
        backgroundImage:
          'linear-gradient(120deg, rgb(255, 255, 255) 0%, rgba(255, 255, 255, 0.5) 100%)',
        WebkitTextFillColor: 'transparent',
      }}
      className="block h-fit bg-clip-text fill-transparent">
      {children}
    </span>
  </p>
);
