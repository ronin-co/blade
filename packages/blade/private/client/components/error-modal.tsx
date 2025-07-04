import { wrapClientComponent } from '@/private/client/utils/wrap-client';

interface ErrorModalProps {
  title: string;
  message: string;
}

const ErrorModal = ({ title, message }: ErrorModalProps) => {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        backgroundColor: 'rgba(0, 0, 0, 0.95)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
      }}>
      <div
        style={{
          position: 'relative',
          width: '90%',
          maxWidth: '600px',
          backgroundColor: '#0A0A0A',
          border: '2px solid #333',
          borderRadius: '12px',
          padding: '2rem',
          boxShadow: '0 0 30px rgba(255, 0, 0, 0.3), 0 0 60px rgba(255, 0, 0, 0.15)',
          animation: 'pulse 2s ease-in-out infinite alternate',
        }}
        onClick={(e) => e.stopPropagation()}>
        {/* Error Content */}
        <div style={{ color: '#fff', textAlign: 'center' }}>
          <h2
            style={{
              margin: '0 0 1rem 0',
              fontSize: '1.5rem',
              fontWeight: 'bold',
              color: '#ff4444',
            }}>
            {title}
          </h2>

          <div
            style={{
              backgroundColor: '#000',
              border: '1px solid #444',
              borderRadius: '6px',
              padding: '1rem',
              marginBottom: '1rem',
              fontFamily: 'monospace',
              fontSize: '0.875rem',
              textAlign: 'left',
              overflow: 'auto',
              maxHeight: '300px',
              whiteSpace: 'pre-wrap',
            }}>
            {message}
          </div>

          <div
            style={{
              display: 'flex',
              gap: '1rem',
              justifyContent: 'center',
            }}></div>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0% { box-shadow: 0 0 30px rgba(255, 0, 0, 0.3), 0 0 60px rgba(255, 0, 0, 0.15); }
          100% { box-shadow: 0 0 40px rgba(255, 0, 0, 0.5), 0 0 80px rgba(255, 0, 0, 0.25); }
        }
      `}</style>
    </div>
  );
};

wrapClientComponent(ErrorModal, 'ErrorModal');

export { ErrorModal };
