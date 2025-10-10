import type { ModelField, StoredObject } from 'blade-compiler';
import { assign, construct, dash } from 'radash';
import {
  type AnchorHTMLAttributes,
  type InputHTMLAttributes,
  type MutableRefObject,
  type PropsWithChildren,
  type ReactNode,
  createContext,
  forwardRef,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { wrapClientComponent } from '@/private/client/utils/wrap-client';
import { useUniversalContext } from '@/private/universal/hooks';
import { useLinkEvents, useMutation } from '@/public/client/hooks';
import { TriggerError } from '@/public/server/errors';
import { useLocation, useParams, usePopulatePathname } from '@/public/universal/hooks';
import type { ResultRecord } from '@/public/universal/types';

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

wrapClientComponent(Image, 'Image');

export { Image };
