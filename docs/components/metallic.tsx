import { cn } from '@/lib/utils';

export const Metallic = ({
  children,
  className,
}: { children: React.ReactNode; className?: string }) => (
  <p className={cn('h-fit font-custom font-medium text-4xl dark:text-black ', className)}>
    <span
      className="block h-fit bg-[linear-gradient(120deg,rgb(0,0,0),rgba(0,0,0,0.5)_100%)] bg-clip-text fill-transparent dark:bg-[linear-gradient(120deg,rgb(255,255,255),rgba(255,255,255,0.5)_100%)]"
      style={{
        WebkitTextFillColor: 'transparent',
      }}>
      {children}
    </span>
  </p>
);
