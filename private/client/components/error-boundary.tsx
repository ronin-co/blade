import type { ReactElement } from 'react';

interface BoundaryProps {
  error: unknown;
}

// We're intentionally not using any of our components here, to avoid infinite crash
// loops, as the code below will be executed in the case that a component throws errors.
const ErrorBoundary = ({ error: defaultError }: BoundaryProps): ReactElement => {
  const error = defaultError as Error;
  const { message, name, constructor: constructorDetails } = error;
  let { stack } = error;

  // Browsers like Safari don't include the error message in the stack, so we want to
  // format the stack to include it and look the same as in Chrome.
  if (!stack?.includes(error.message)) {
    const spacer = '    ';
    const details = spacer + stack?.replaceAll('\n', `\n${spacer}`);

    stack = `${constructorDetails.name}: ${message}\n${details}`;
  }

  // Only expose the stack trace in development. In production, we only want to render
  // the red background, because a Sentry overlay (which lets people report additional
  // details) will be shown on top of it.
  const content =
    import.meta.env.BLADE_ENV === 'development' ? (
      <div className="flex w-full max-w-4xl flex-col justify-around">
        <h1 className="font-mono text-2xl">{name}:</h1>
        <h2 className="mt-4 break-normal font-mono text-lg">{message}</h2>

        <div className="mt-4 w-full overflow-x-scroll">
          <pre>{stack.substring(stack.indexOf('\n') + 1)}</pre>
        </div>
      </div>
    ) : null;

  return (
    <div
      role="alert"
      className="absolute inset-0 flex flex-col items-center justify-center bg-red-500 px-12 text-white">
      {content}
    </div>
  );
};

export { ErrorBoundary };
