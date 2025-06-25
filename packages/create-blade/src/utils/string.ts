const hexToRgb = (hex: string): [number, number, number] => {
  const sanitized = hex.replace(/^#/, '');

  if (sanitized.length === 3)
    return [
      Number.parseInt(sanitized[0] + sanitized[0], 16),
      Number.parseInt(sanitized[1] + sanitized[1], 16),
      Number.parseInt(sanitized[2] + sanitized[2], 16),
    ];

  return [
    Number.parseInt(sanitized.substring(0, 2), 16),
    Number.parseInt(sanitized.substring(2, 4), 16),
    Number.parseInt(sanitized.substring(4, 6), 16),
  ];
};

const lerp = (start: number, end: number, t: number): number => start * (1 - t) + end * t;

const interpolateColor = (
  color1: [number, number, number],
  color2: [number, number, number],
  t: number,
): [number, number, number] => [
  Math.round(lerp(color1[0], color2[0], t)),
  Math.round(lerp(color1[1], color2[1], t)),
  Math.round(lerp(color1[2], color2[2], t)),
];

const rgbToAnsi = (r: number, g: number, b: number): string =>
  `\x1b[38;2;${r};${g};${b}m`;

/**
 * Creates a gradient text function with the specified colors
 *
 * @param colors - Array of hex color strings to create gradient from
 *
 * @returns A function that applies the gradient to input text
 *
 * @throws Error if less than 2 colors are provided
 *
 * @example
 * ```ts
 * import { gradient } from 'path/to/gradient';
 *
 * const custom = gradient(['#ff5f6d', '#ffc371']);
 * console.log(custom('Hello World!'));
 * ```
 */
export const gradient = (colors: Array<string>): ((value: string) => string) => {
  if (colors.length < 2)
    throw new Error('At least 2 colors are required to create a gradient');

  const rgbColors = colors.map(hexToRgb);

  return (value: string): string => {
    const chars = value.split('');

    // For single character, use the first color
    if (chars.length <= 1) return `${rgbToAnsi(...rgbColors[0])}${value}\x1b[0m`;

    // Calculate the color segments
    const segments = rgbColors.length - 1;
    const charsPerSegment = chars.length / segments;

    let result = '';

    for (let i = 0; i < chars.length; i++) {
      const char = chars[i];
      const segmentIndex = Math.min(Math.floor(i / charsPerSegment), segments - 1);
      const segmentPosition = (i % charsPerSegment) / charsPerSegment;

      const color = interpolateColor(
        rgbColors[segmentIndex],
        rgbColors[segmentIndex + 1],
        segmentPosition,
      );

      result += `${rgbToAnsi(...color)}${char}`;
    }

    return `${result}\x1b[0m`;
  };
};
