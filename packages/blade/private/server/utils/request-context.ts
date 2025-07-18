import UserAgentParser from 'ua-parser-js';

import { IS_SERVER_DEV } from '@/private/server/utils/constants';
import type { GeoLocation, UserAgent } from '@/private/universal/types/util';

export const getRequestGeoLocation = (headers: Headers): GeoLocation => {
  const coordinates = headers.get('Ronin-Client-Coordinates');
  const latitude = coordinates ? Number.parseFloat(coordinates.split(',')[0]) : null;
  const longitude = coordinates ? Number.parseFloat(coordinates.split(',')[1]) : null;

  const start = Date.now();

  const geoLocation: GeoLocation = {
    country: headers.get('Ronin-Client-Country') || null,
    region: headers.get('Ronin-Client-Region') || null,
    city: headers.get('Ronin-Client-City') || null,
    latitude,
    longitude,
    timeZone: null,
  };

  const end = Date.now();

  if (geoLocation.timeZone) console.log(`Set geo location in ${end - start}ms`);

  // During local development, we don't have access to the client's location, so we would
  // like to provide default values.
  if (IS_SERVER_DEV) {
    geoLocation.country = 'DE';
    geoLocation.region = 'DEBE';
    geoLocation.city = 'Berlin';
    geoLocation.latitude = 52.5167;
    geoLocation.longitude = 13.4007;
    geoLocation.timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  }

  return geoLocation;
};

export const getRequestLanguages = (headers: Headers): string[] => {
  const header = headers.get('Accept-Language');
  if (!header) return [];

  // Split the header by commas.
  const parts = header.split(',');

  // Map each part to an object with language code and quality value. The quality value
  // determines the order of languages.
  const languages = parts.map((part) => {
    const [lang, qValue] = part.split(';');
    const q = qValue ? Number.parseFloat(qValue.split('=')[1]) : 1.0;
    return { lang: lang.trim(), q: q };
  });

  // Sort languages by quality value in descending order.
  languages.sort((a, b) => b.q - a.q);

  // Return an array of language codes.
  return languages.map((language) => language.lang);
};

const formatOperatingSystem = (name: string): string =>
  name.replace('Mac OS', 'macOS').replace('Mac', 'macOS');

export const getRequestUserAgent = (headers: Headers): UserAgent => {
  const header = headers.get('User-Agent');
  let parsed = null;

  if (header) {
    const parser = new UserAgentParser();
    parser.setUA(header);

    parsed = parser.getResult();
  }

  // The package we're using for parsing the user agent above will not provide a device
  // type in the case of desktop, because user agents exposed by browsers on desktop do
  // not provide a reliable indication of this. Some packages handle this by loading an
  // extreme amount of existing user agents and then comparing with those, but because we
  // want to avoid loading too much code, we will instead assume that, if the device type
  // isn't "console", "mobile", "tablet", "smarttv", "wearable", or "embedded", it is
  // instead likely to be "desktop", so we'll default to that.
  if (!parsed?.device?.type && parsed?.os?.name) {
    parsed.device.type = 'desktop';
  }

  return {
    browser: parsed?.browser?.name || null,
    browserVersion: parsed?.browser?.version || null,
    os: parsed?.os?.name ? formatOperatingSystem(parsed?.os?.name) : null,
    osVersion: parsed?.os?.version || null,
    deviceType: (parsed?.device?.type as UserAgent['deviceType']) || null,
  };
};
