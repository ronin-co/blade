import { bundleId as serverBundleId } from 'build-meta';
import { flatten } from 'flat';
import type { ReactNode } from 'react';

import { History } from '@/private/client/components/history';
import { composeWorkerRegistration } from '@/private/client/utils/service-worker';
import { RootServerContext, type ServerContext } from '@/private/server/context';
import type { PageMetadata, RecursiveRequired, ValueOf } from '@/private/server/types';
import { getSerializableContext } from '@/private/universal/context';
import { usePrivateLocation } from '@/private/universal/hooks';
import type { Asset } from '@/private/universal/types/util';
import { getOutputFile } from '@/private/universal/utils/paths';
import { usePopulatePathname } from '@/public/universal/hooks';

const metadataNames: Record<string, string> = {
  colorScheme: 'color-scheme',
  themeColor: 'theme-color',

  'x.title': 'twitter:title',
  'x.description': 'twitter:description',
  'x.card': 'twitter:card',
  'x.site': 'twitter:site',
  'x.creator': 'twitter:creator',

  'openGraph.title': 'og:title',
  'openGraph.description': 'og:description',
  'openGraph.siteName': 'og:site_name',
};

const ASSETS = new Array<Asset>(
  { type: 'js', source: `/${getOutputFile(serverBundleId, 'js')}` },
  { type: 'css', source: `/${getOutputFile(serverBundleId, 'css')}` },
);

// In production, load the service worker script.
if (import.meta.env['__BLADE_SERVICE_WORKER'] === 'true') {
  ASSETS.push({ type: 'worker', source: '/service-worker.js' });
}

const SERVICE_WORKER = ASSETS.find((asset) => asset.type === 'worker');

interface RootProps {
  children?: ReactNode;
  serverContext: ServerContext;
}

const Root = ({ children, serverContext }: RootProps) => {
  const { metadata } = serverContext.collected;

  const currentLocation = usePrivateLocation();
  const populatePathname = usePopulatePathname();

  const flatMetadata = Object.entries(
    flatten<PageMetadata, Record<string, ValueOf<PageMetadata>>>(
      serverContext.collected.metadata,
      {
        safe: true,
      },
    ),
  );

  return (
    <html
      lang="en"
      className={metadata.htmlClassName}
      suppressHydrationWarning={true}>
      <head>
        {ASSETS
          // Ensure that stylesheets are loaded first in favor of performance. The HMR
          // logic on the client depends on this order as well.
          .sort((a, b) => Number(b.type === 'css') - Number(a.type === 'css'))
          .map(({ type, source }) => {
            switch (type) {
              case 'css':
                return (
                  <link
                    rel="stylesheet"
                    href={source}
                    key={source}
                    className="blade-style"
                  />
                );
              case 'js':
                return (
                  <script
                    src={source}
                    key={source}
                    type="module"
                    className="blade-script"
                    // Don't block the parsing of the remaining HTML, CSS, etc.
                    async
                  />
                );
              case 'worker':
                return (
                  <link
                    rel="prefetch"
                    href={source}
                    as="script"
                  />
                );
            }
          })}

        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0"
        />

        <meta
          property="og:locale"
          content="en-US"
        />
        <meta
          property="og:type"
          content="website"
        />
        <meta
          property="og:url"
          content={populatePathname(currentLocation.href)}
        />

        {flatMetadata.map(([name, value]) => {
          // React seems to not update elements in `<head>` unless their `key` changes
          // explicitly, so we have to make sure that the `key` contains the name of the
          // meta tag and its value, in order for the elements to update whenever the
          // metadata changes.

          switch (name) {
            case 'title': {
              const title = Array.from(value as Set<string>).join(' — ');
              return <title key={`title${title}`}>{title}</title>;
            }

            case 'icon':
              return (
                <link
                  key={`icon${value}`}
                  rel="icon"
                  type="image/png"
                  href={value as string}
                />
              );

            case 'openGraph.images':
              return (
                value as RecursiveRequired<PageMetadata>['openGraph']['images']
              ).map((image) => (
                <>
                  <meta
                    key={`og:image${image.url}`}
                    property="og:image"
                    content={image.url}
                  />
                  <meta
                    key={`og:image:width${image.width}`}
                    property="og:image:width"
                    content={String(image.width)}
                  />
                  <meta
                    key={`og:image:height${image.height}`}
                    property="og:image:height"
                    content={String(image.height)}
                  />
                </>
              ));

            case 'x.images':
              return (value as RecursiveRequired<PageMetadata>['x']['images']).map(
                (imageURL) => (
                  <meta
                    key={`twitter:image${imageURL}`}
                    name="twitter:image"
                    content={imageURL}
                  />
                ),
              );

            default: {
              const tagName = metadataNames[name] || name;
              return (
                <meta
                  key={tagName + value}
                  name={tagName}
                  content={value as string}
                />
              );
            }
          }
        })}
      </head>

      <body
        suppressHydrationWarning={true}
        className={metadata.bodyClassName}>
        <RootServerContext.Provider value={serverContext}>
          <History universalContext={getSerializableContext(serverContext)}>
            {children}
          </History>
        </RootServerContext.Provider>

        {SERVICE_WORKER && (
          <script
            dangerouslySetInnerHTML={{
              __html: composeWorkerRegistration(SERVICE_WORKER),
            }}
          />
        )}
      </body>
    </html>
  );
};

export default Root;
