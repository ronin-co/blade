import type { StoredObject } from 'blade-compiler';
import {
  type AnchorHTMLAttributes,
  type ReactElement,
  cloneElement,
  forwardRef,
  useCallback,
  useRef,
} from 'react';

import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useUniversalContext } from '@/private/universal/hooks';
import { useLinkEvents } from '@/public/client/hooks';
import { usePopulatePathname } from '@/public/universal/hooks';

interface LinkURL extends Omit<Partial<InstanceType<typeof URL>>, 'search'> {
  search?: string | Record<string, string | number | boolean | null>;
}

/**
 * Normalizes a `LinkURL` object to a `URL` instance.
 *
 * @param url - The `LinkURL` or `URL` object to normalize.
 * @param currentURL - The currently active URL.
 *
 * @returns A new `URL` instance.
 */
const normalizeURL = (url: LinkURL, currentURL: string) => {
  if (url instanceof URL) return url;

  const newURL = new URL(currentURL);

  for (const [key, value] of Object.entries(url)) {
    switch (key) {
      case 'search':
        // If the provided query parameters are serialized as a string, we can just
        // assign them to the final URL without any modifications.
        if (typeof url.search === 'string') {
          newURL.search = url.search;
          // If the provided query parameters are an object, however, we need to
          // explicitly convert them into a string.
        } else if (url.search) {
          // Filter out query parameters with `undefined` or `null` values. It's
          // important to filter out `null` because `location.searchParams` exposes query
          // params as `null` if they're empty, and `normalizeURL` should be able to
          // accept query params that were retrieved from `location.searchParams`.
          const params = Object.entries(url.search).filter(([, value]) => {
            return typeof value !== 'undefined' && value !== null;
          }) as [string, string][];

          // Generate and assign a new string of query parameters.
          newURL.search = new URLSearchParams(params).toString();
        }
        break;
      case 'hash':
      case 'host':
      case 'hostname':
      case 'href':
      case 'password':
      case 'pathname':
      case 'port':
      case 'protocol':
      case 'username':
        newURL[key] = value;
    }
  }

  return newURL;
};

/**
 * Get the pathname (including query parameters) of a URL.
 *
 * @param url - The URL to compose the pathname for.
 *
 * @returns The pathname (including query parameters) of the provided URL.
 */
const getPathFromURL = (url: LinkURL, currentURL: string) => {
  const normalized = normalizeURL(url, currentURL);
  return normalized.pathname + normalized.search;
};

interface LinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: ReactElement;
  href: string | LinkURL;
  segments?: Record<string, string | Array<string>>;
  prefetch?: boolean;
}

const Link = ({
  href: hrefDefault,
  segments,
  children,
  prefetch = true,
  ...extraProps
}: LinkProps) => {
  const universalContext = useUniversalContext();

  const href =
    typeof hrefDefault === 'string'
      ? hrefDefault
      : getPathFromURL(hrefDefault, universalContext.url);

  const populatePathname = usePopulatePathname();
  const destination = populatePathname(href, segments);
  const linkEventHandlers = useLinkEvents(destination);

  const shouldPrefetch =
    prefetch &&
    !(destination.startsWith('https://') || destination.startsWith('http://'));

  const eventHandlers = shouldPrefetch
    ? linkEventHandlers
    : { onClick: linkEventHandlers.onClick };

  return cloneElement(children, {
    href: destination,
    ...eventHandlers,
    ...extraProps,

    // We must pass `extraProps` after `linkEventHandlers`, to allow for overwriting the
    // default event handlers.
    //
    // However, simply deconstructing `extraProps` after deconstructing
    // `linkEventHandlers` would cause props within `extraProps` to overwrite the props
    // in `linkEventHandlers`, even if the props in `extraProps` contain the value
    // `undefined`. To protect against this, we are explicitly checking whether the value
    // is falsy before using it.
    onClick: extraProps.onClick || linkEventHandlers.onClick,
    onMouseEnter: extraProps.onMouseEnter || linkEventHandlers.onMouseEnter,
    onTouchStart: extraProps.onTouchStart || linkEventHandlers.onTouchStart,
  });
};

const supportedFitValues = ['fill', 'contain', 'cover'];

interface BaseImageProps {
  /**
   * Defines text that can replace the image in the page.
   */
  alt?: string;
  /**
   * The quality level at which the image should be displayed. A lower quality ensures a
   * faster loading speed, but might also effect the visual appearance, so it is
   * essential to choose carefully.
   *
   * Must be an integer between `0` and `100`.
   *
   * @default 80
   */
  quality?: number;
  /**
   * The format of the image.
   *
   * @default "webp"
   */
  format?: 'webp' | 'jpeg' | 'png' | 'original';
  /**
   * The value of a RONIN blob field.
   */
  src: string | StoredObject;
  /**
   * Specifies how the image should be resized to fit its container.
   *
   * @default "cover"
   */
  fit?: React.CSSProperties['objectFit'];
  /**
   * The aspect ratio of the image. Can be "square", "video", or a custom string.
   */
  aspect?: 'square' | 'video' | string;
  /**
   * Indicates how the browser should load the image.
   *
   * Providing the value "lazy" defers loading the image until it reaches a calculated
   * distance from the viewport, as defined by the browser. The intent is to avoid the
   * network and storage impact needed to handle the image until it's reasonably certain
   * that it will be needed. This generally improves the performance of the content in
   * most typical use cases.
   */
  loading?: 'lazy';
  /**
   * The class names for the image container (not the image itself).
   */
  className?: string;
  /**
   * The inline style for the image container (not the image itself).
   */
  style?: React.CSSProperties;
}

type ImageProps = BaseImageProps &
  (
    | {
        /**
         * The intrinsic size of the image in pixels, if its width and height are the same.
         * Must be an integer without a unit.
         */
        size: number;
        /**
         * The intrinsic width of the image in pixels. Must be an integer without a unit.
         */
        width?: never;
        /**
         * The intrinsic height of the image, in pixels. Must be an integer without a unit.
         */
        height?: never;
      }
    | {
        /**
         * The intrinsic size of the image in pixels, if its width and height are the same.
         * Must be an integer without a unit.
         */
        size?: never;
        /**
         * The intrinsic width of the image in pixels. Must be an integer without a unit.
         */
        width?: number;
        /**
         * The intrinsic height of the image, in pixels. Must be an integer without a unit.
         */
        height: number;
      }
    | {
        /**
         * The intrinsic size of the image in pixels, if its width and height are the same.
         * Must be an integer without a unit.
         */
        size?: never;
        /**
         * The intrinsic width of the image in pixels. Must be an integer without a unit.
         */
        width: number;
        /**
         * The intrinsic height of the image, in pixels. Must be an integer without a unit.
         */
        height?: number;
      }
  );

const Image = forwardRef<HTMLDivElement, ImageProps>(
  (
    {
      src: input,
      alt,
      size: defaultSize,
      width: defaultWidth,
      height: defaultHeight,
      fit = 'cover',
      format = 'webp',
      quality = 80,
      aspect,
      loading,
      style,
      className,
    },
    ref,
  ) => {
    const imageElement = useRef<HTMLImageElement | null>(null);
    const renderTime = useRef<number>(Date.now());

    const isMediaObject = typeof input === 'object' && input !== null;
    const width = defaultSize || defaultWidth;
    const height = defaultSize || defaultHeight;

    const onLoad = useCallback(() => {
      const duration = Date.now() - renderTime.current;
      const threshold = 150;

      // Fade in and gradually reduce blur of the real image if loading takes longer than
      // the specified threshold.
      if (duration > threshold) {
        imageElement.current?.animate(
          [
            { filter: 'blur(4px)', opacity: 0 },
            { filter: 'blur(0px)', opacity: 1 },
          ],
          {
            duration: 200,
          },
        );
      }
    }, []);

    if (!(height || width))
      throw new Error('Either `width`, `height`, or `size` must be defined for `Image`.');

    // Validate given `quality` property.
    if (quality && (quality < 0 || quality > 100))
      throw new Error('The given `quality` was not in the range between 0 and 100.');

    const optimizationParams = new URLSearchParams({
      ...(width ? { w: width.toString() } : {}),
      ...(height ? { h: height.toString() } : {}),
      ...(format !== 'original' ? { fm: format } : {}),

      fit: supportedFitValues.includes(fit) ? fit : 'cover',
      q: quality.toString(),
    });

    const responsiveOptimizationParams = new URLSearchParams({
      ...(width ? { h: (width * 2).toString() } : {}),
      ...(height ? { h: (height * 2).toString() } : {}),
      ...(format !== 'original' ? { fm: format } : {}),

      fit: supportedFitValues.includes(fit) ? fit : 'cover',
      q: quality.toString(),
    });

    const source = isMediaObject ? `${input.src}?${optimizationParams}` : input;

    const responsiveSource = isMediaObject
      ? `${input.src}?${optimizationParams} 1x, ` +
        `${input.src}?${responsiveOptimizationParams} 2x`
      : input;

    const placeholder =
      input && typeof input !== 'string' ? input.placeholder?.base64 : null;

    return (
      <div
        ref={ref}
        className={className}
        style={{
          position: 'relative',
          overflow: 'hidden',
          flexShrink: 0,
          width: width || '100%',
          height: height || '100%',
          aspectRatio: aspect === 'video' ? '16/9' : aspect === 'square' ? '1/1' : 'auto',
          ...style,
        }}>
        {/* Blurred preview being displayed until the actual image is loaded. */}
        {placeholder && (
          // biome-ignore lint/nursery/noImgElement: An image component requires a `<img />` element.
          <img
            style={{
              position: 'absolute',
              width: '100%',
              height: '100%',
              objectFit: fit,
            }}
            src={placeholder}
            alt={alt}
          />
        )}

        {/* The optimized image, responsive to the specified size. */}
        {/* biome-ignore lint/nursery/noImgElement: An image component requires a `<img />` element. */}
        <img
          alt={alt}
          style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            objectFit: fit,
          }}
          decoding="async"
          onLoad={onLoad}
          loading={loading}
          ref={imageElement}
          src={source}
          srcSet={responsiveSource}
        />
      </div>
    );
  },
);

wrapClientComponent(Link, 'Link');
wrapClientComponent(Image, 'Image');

export { Link, Image };
