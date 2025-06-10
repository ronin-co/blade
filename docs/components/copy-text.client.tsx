import { useState } from 'react';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

import type { JSX } from 'react';

export const CopyText = ({
  children,
  text,
}: {
  children: React.ReactNode;
  text: string;
}): JSX.Element => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const handleCopy = (): void => {
    navigator.clipboard.writeText(text);
    setIsCopied(true);
    setTimeout((): void => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <>
      <Tooltip>
        <TooltipTrigger
          className="cursor-pointer"
          onClick={handleCopy}>
          {children}
        </TooltipTrigger>
        <TooltipContent>
          <p>{isCopied ? 'Copied!' : 'Copy to clipboard'}</p>
        </TooltipContent>
      </Tooltip>
    </>
  );
};
