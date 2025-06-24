import { Button } from '@/components/ui/button';
import { LinkIcon } from 'lucide-react';

interface ParamFieldProps {
  path: string;
  type: string;
  children: React.ReactNode;
  isRequired?: boolean;
  defaultValue?: string;
}

export const ParamField = ({
  path,
  type,
  children,
  isRequired,
  defaultValue,
}: ParamFieldProps) => {
  const paramId = `param-${path.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <div className="field my-2.5 border-gray-50 border-b pt-2.5 pb-5 dark:border-gray-800/50">
      <div
        className="group/param-head param-head relative flex break-all font-mono text-sm"
        id={paramId}>
        <div className="mr-5 flex flex-1 content-start py-0.5">
          <div className="flex flex-wrap items-center gap-2">
            <a
              data-heading={true}
              href={`#${paramId}`}
              id={paramId}
              className="scroll-mt-25">
              <div className="-top-1.5 absolute">
                <Button
                  variant="ghost"
                  size="sm"
                  className="-ml-11 [.expandable-content_&]:-ml-[2.1rem] flex cursor-pointer items-center border-0 py-2 text-muted-foreground opacity-0 transition duration-200 hover:text-primary group-hover/param-head:opacity-100"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.href}#${paramId}`);
                  }}>
                  <LinkIcon
                    width={12}
                    height={12}
                  />
                </Button>
              </div>
              <div
                className="overflow-wrap-anywhere cursor-pointer font-semibold text-primary dark:text-primary-light"
                data-component-part="field-name">
                {path}
              </div>
            </a>
            <div
              className="inline items-center gap-2 font-medium text-xs [&_div]:mr-2 [&_div]:inline [&_div]:leading-5"
              data-component-part="field-meta">
              <div
                className="flex items-center break-all rounded-md bg-gray-100/50 px-2 py-0.5 font-medium text-gray-600 dark:bg-white/5 dark:text-gray-200"
                data-component-part="field-info-pill">
                <span>{type}</span>
              </div>
              {isRequired && (
                <div
                  className="whitespace-nowrap rounded-md bg-red-100/50 px-2 py-0.5 font-medium text-red-600 dark:bg-red-400/10 dark:text-red-300"
                  data-component-part="field-required-pill">
                  required
                </div>
              )}
              {defaultValue && (
                <div
                  className="flex items-center break-all rounded-md bg-gray-100/50 px-2 py-0.5 font-medium text-gray-600 dark:bg-white/5 dark:text-gray-200"
                  data-component-part="field-info-pill">
                  <span className="text-gray-400 dark:text-gray-500">default:</span>
                  <span>"{defaultValue}"</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      <div
        className="prose-sm prose-gray dark:prose-invert mt-4 [&_.prose>p:first-child]:mt-0 [&_.prose>p:last-child]:mb-0"
        data-component-part="field-content">
        {children}
      </div>
    </div>
  );
};
