import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

/**
 * Convert a heading string to a slug used in URLs.
 *
 * @param value - The heading string to convert.
 *
 * @returns A slugified version of the heading string.
 */
export const slugify = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
