import { TriangleAlertIcon } from 'lucide-react';

import { Alert, AlertDescription } from '@/components/ui/alert';

export function AlertCard({ children }: { children: React.ReactNode }) {
  return (
    <Alert
      variant="warning"
      className="not-prose">
      <TriangleAlertIcon />
      <AlertDescription>{children}</AlertDescription>
    </Alert>
  );
}
