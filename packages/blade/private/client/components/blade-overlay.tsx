import { useState } from 'react';
import { wrapClientComponent } from '../utils/wrap-client';

interface ErrorBadgeProps{
    count: number;
} 
const ErrorBadge = ({ count }: ErrorBadgeProps) => {
  if (count === 0) return null;
  
  return (
    <div style={{
      position: 'fixed',
      bottom: '1rem',
      left: '4.5rem',
      backgroundColor: 'red',
      color: 'white',
      borderRadius: '50%',
      width: '1.5rem',
      height: '1.5rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '0.75rem',
      fontWeight: 'bold',
      zIndex: 51
    }}>
      {count}
    </div>
  );
}


const BladeOverlay = () => {
  const [count, setCount] = useState(0);

  const handleClick = () => {
    setCount(prev => prev + 1);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'row' }}>
      <ErrorBadge count={count} />
      
      {/* Circle */}
      <div 
        onClick={handleClick}
        style={{
          position: 'fixed',
          bottom: '1rem',
          left: '1rem',
          width: '3rem',
          height: '3rem',
          backgroundColor: 'black',
          borderRadius: '50%',
          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
          zIndex: 50,
          cursor: 'pointer'
        }}
      />
    </div>
  );
}

wrapClientComponent(BladeOverlay, 'BladeOverlay');

export { BladeOverlay };