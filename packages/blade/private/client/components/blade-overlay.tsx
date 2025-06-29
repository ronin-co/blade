import { IS_CLIENT_DEV } from '@/private/client/utils/constants';
import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useEffect } from 'react';
import { ErrorModalProvider } from '@/private/client/contexts/error-modal';
import { useErrorModal } from '@/private/client/hooks/error-modal';
import { ErrorModal } from '@/private/client/components/error-modal';
import type { StateMessage } from '@/private/universal/utils/state-msg';
import type BuildError from '@/private/universal/utils/build-error';

// interface ErrorBadgeProps {
//   count: number;
// }

// const ErrorBadge = ({ count }: ErrorBadgeProps) => {
//   if (count === 0) return null;

//   return (
//     <div
//       style={{
//         position: 'fixed',
//         bottom: '1rem',
//         left: '4.5rem',
//         backgroundColor: 'red',
//         color: 'white',
//         borderRadius: '50%',
//         width: '1.5rem',
//         height: '1.5rem',
//         display: 'flex',
//         alignItems: 'center',
//         justifyContent: 'center',
//         fontSize: '0.75rem',
//         fontWeight: 'bold',
//         zIndex: 51,
//       }}>
//       {count}
//     </div>
//   );
// };

// const Floating = () => {

//   return (
//     <div
//       style={{
//         position: 'fixed',
//         bottom: '1rem',
//         left: '1rem',
//         width: '3rem',
//         height: '3rem',
//         backgroundColor: 'black',
//         borderRadius: '50%',
//         boxShadow:
//           '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
//         zIndex: 50,
//         cursor: 'pointer',
//       }}
//     />
//   );
// };

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
      {/*
       * I made this hidden now because there is no actual usage for it right now, but it's a base foundation
       * for both client errors and server errors to be shown here or even more like changing configs etc..
       */}
      {/* <div style={{ display: 'flex', flexDirection: 'row' }}>
        <ErrorBadge count={0} />
        <Floating />
      </div> */}
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
