import { TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

export function AlertCard({ children }: { children: React.ReactNode }) {
  return (
    <Alert
      className="not-prose items-center"
      variant="warning">
      <TriangleAlertIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
