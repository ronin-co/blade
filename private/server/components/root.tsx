import { flatten } from 'flat';
import type { ReactNode } from 'react';

import History from '../../client/components/history.client';
import { getSerializableContext } from '../../universal/context';
import { usePrivateLocation } from '../../universal/hooks';
import type { Asset } from '../../universal/types/util';
import { useServerContext } from '../hooks';
import type { PageMetadata, RecursiveRequired, ValueOf } from '../types';

const metadataNames: Record<string, string> = {
  colorScheme: 'color-scheme',
  themeColor: 'theme-color',

  'x.title': 'twitter:title',
  'x.description': 'twitter:description',
  'x.card': 'twitter:card',
  'x.creator': 'twitter:creator',

  'openGraph.title': 'og:title',
  'openGraph.description': 'og:description',
  'openGraph.siteName': 'og:site_name',
};

interface RootProps {
  children?: ReactNode;
}

const Root = ({ children }: RootProps) => {
  const serverContext = useServerContext();
  const { metadata } = serverContext.collected;

  const { origin } = usePrivateLocation();

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
        {JSON.parse(import.meta.env.__BLADE_ASSETS).map(({ type, source }: Asset) => {
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
                />
              );

            // Fonts are already loaded by the CSS bundle, but we also want to pre-load
            // them in addition.
            case 'font':
              return (
                <link
                  rel="preload"
                  crossOrigin="anonymous"
                  as="font"
                  href={source}
                  type="font/woff2"
                  key={source}
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
          content={origin}
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
              const tagName = metadataNames[name];
              return tagName ? (
                <meta
                  key={tagName + value}
                  name={tagName}
                  content={value as string}
                />
              ) : null;
            }
          }
        })}
      </head>

      <body
        suppressHydrationWarning={true}
        className={metadata.bodyClassName}>
        <History universalContext={getSerializableContext(serverContext)}>
          {children}
        </History>
      </body>
    </html>
  );
};

export default Root;
