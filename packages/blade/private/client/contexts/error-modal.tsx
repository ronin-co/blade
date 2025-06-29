import { createContext, useState } from 'react';
import type { ReactNode } from 'react';

// Error Modal Context
interface ErrorModalState {
  isVisible: boolean;
  title: string;
  message: string;
  showModal: (title: string, message: string) => void;
  hideModal: () => void;
}

const ErrorModalContext = createContext<ErrorModalState | null>(null);

interface ErrorModalProviderProps {
  children: ReactNode;
}

const ErrorModalProvider = ({ children }: ErrorModalProviderProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');

  const showModal = (newTitle: string, newMessage: string) => {
    setTitle(newTitle);
    setMessage(newMessage);
    setIsVisible(true);
  };

  const hideModal = () => {
    setIsVisible(false);
  };

  return (
    <ErrorModalContext.Provider
      value={{
        isVisible,
        title,
        message,
        showModal,
        hideModal,
      }}>
      {children}
    </ErrorModalContext.Provider>
  );
};

export { ErrorModalProvider, ErrorModalContext };
export type { ErrorModalState };
