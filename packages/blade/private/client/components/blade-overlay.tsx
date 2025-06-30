import { IS_CLIENT_DEV } from '@/private/client/utils/constants';
import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useEffect } from 'react';
import { ErrorModalProvider } from '@/private/client/contexts/error-modal';
import { useErrorModal } from '@/private/client/hooks/error-modal';
import { ErrorModal } from '@/private/client/components/error-modal';
import type { StateMessage } from '@/private/universal/utils/state-msg';
import type BuildError from '@/private/universal/utils/build-error';

/**
 * BladeOverlay is a bubble indicator component used to display
 * visual notifications for build errors, client errors, and other statuses.
 */
const BladeOverlay = () => {
  const { isVisible, showModal } = useErrorModal();

  useEffect(() => {
    // Here we default to the origin available in the browser, because BLADE might
    // locally sit behind a proxy that terminates TLS, in which case the origin protocol
    // would be `http` if we make use of the location provided by `usePrivateLocation`,
    // since that comes from the server.

    // This endpoint can be used to send multiple stages of statuses like build-pending to indicate
    // it's in a build process, or failures in server, etc.
    const url = new URL('/_blade/state', window.location.origin);

    // This also replaces `https` with `wss` automatically.
    url.protocol = url.protocol.replace('http', 'ws');

    /**
     * TODO: This WebSocket state handler logic should be moved to a dedicated
     * service or hook for better organization and reusability
     */
    const stateHandler = (event: StateMessage) => {
      switch (event.type) {
        case 'build-error':
          console.log(event);
          const errorMessages: BuildError[] = JSON.parse(event.message);
          /**
           * TODO: Make the Modal able to show multiple error messages
           */
          const errorMessage = errorMessages[0];
          const richErrorMessage = `
Error message: ${errorMessage.errorMessage}
File ${errorMessage.location.file} Line ${errorMessage.location.line}: ${errorMessage.location.text}
${errorMessage.location.suggestion ? `Suggestion: ${errorMessage.location.suggestion}` : ''}
`.trim();
          showModal('Build Error', richErrorMessage);
          break;
        default:
          console.log('unsupported');
          break;
      }
    };

    let ws: WebSocket;

    const connect = () => {
      // Close the old connection if there is one available.
      if (ws) ws.close();

      // Establish a new connection.
      ws = new WebSocket(url.href);

      // If the connection was closed unexpectedly, try to reconnect.
      ws.addEventListener('error', () => connect(), { once: true });

      // Add listener to state events
      ws.addEventListener('message', (event: MessageEvent) => {
        const data = JSON.parse(event.data) as StateMessage;
        stateHandler(data);
      });
    };

    connect();
    return () => ws.close();
  }, [showModal]);

  if (!IS_CLIENT_DEV) return <></>;

  return (
    <>
      {isVisible && <ErrorModal />}
    </>
  );
};

const WrappedBladeOverlay = () => (
  <ErrorModalProvider>
    <BladeOverlay />
  </ErrorModalProvider>
);

wrapClientComponent(WrappedBladeOverlay, 'BladeOverlay');

export { WrappedBladeOverlay as BladeOverlay };
