import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { CheckIcon, CopyIcon } from 'lucide-react';
import { useState } from 'react';

export const CopyToClipboard = ({ content }: { content: string }) => {
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    setIsCopied(true);
    setTimeout(() => {
      setIsCopied(false);
    }, 2000);
  };

  return (
    <Tooltip>
      <TooltipTrigger>
        <Button
          asChild={true}
          className="h-6 w-6 cursor-pointer p-1.5"
          variant="ghost"
          size="icon"
          onClick={handleCopy}>
          {isCopied ? (
            <CheckIcon className="rounded-sm" />
          ) : (
            <CopyIcon className="rounded-sm" />
          )}
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{isCopied ? 'Copied!' : 'Copy to clipboard'}</p>
      </TooltipContent>
    </Tooltip>
  );
};
