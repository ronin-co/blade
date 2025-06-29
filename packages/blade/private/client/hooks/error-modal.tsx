import { useContext } from 'react';
import { ErrorModalContext } from '@/private/client/contexts/error-modal';
import type { ErrorModalState } from '@/private/client/contexts/error-modal';

const useErrorModal = (): ErrorModalState => {
  const context = useContext(ErrorModalContext);
  if (!context) {
    throw new Error('useErrorModal must be used within an ErrorModalProvider');
  }
  return context;
};

export { useErrorModal };
