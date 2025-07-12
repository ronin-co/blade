import { describe, expect, test } from 'bun:test';
import { capitalize, convertToPascalCase } from '@/src/utils/slug';

describe('slugs', () => {
  describe('capitalize', () => {
    test('empty and null inputs', () => {
      expect(capitalize('')).toBe('');

      // @ts-expect-error – Intentionally passing `null`.
      expect(capitalize(null)).toBe('');

      // @ts-expect-error – Intentionally passing `undefined`.
      expect(capitalize(undefined)).toBe('');
    });

    test('capitalize the first letter only', () => {
      expect(capitalize('test')).toBe('Test');
      expect(capitalize('TEST')).toBe('Test');
      expect(capitalize('TeSt')).toBe('Test');
      expect(capitalize('this is a test')).toBe('This is a test');
    });
  });

  describe('to pascal case', () => {
    test('empty and null inputs', () => {
      expect(convertToPascalCase('')).toBe('');

      // @ts-expect-error – Intentionally passing `null`.
      expect(convertToPascalCase(null)).toBe('');

      // @ts-expect-error – Intentionally passing `undefined`.
      expect(convertToPascalCase(undefined)).toBe('');
    });

    test('simple lowercase strings', () => {
      expect(convertToPascalCase('hello world')).toBe('HelloWorld');
      expect(convertToPascalCase('foo bar baz')).toBe('FooBarBaz');
    });

    test('hyphen delimited strings', () => {
      expect(convertToPascalCase('hello-world')).toBe('HelloWorld');
      expect(convertToPascalCase('foo-bar-baz')).toBe('FooBarBaz');
    });

    test('underscore delimited strings', () => {
      expect(convertToPascalCase('hello_world')).toBe('HelloWorld');
      expect(convertToPascalCase('foo_bar_baz')).toBe('FooBarBaz');
    });

    test('mixed case strings', () => {
      expect(convertToPascalCase('HelloWorld')).toBe('HelloWorld');
      expect(convertToPascalCase('FOO_BAR_BAZ')).toBe('FooBarBaz');
    });

    test('consecutive uppercase letters', () => {
      expect(convertToPascalCase('myJSONData')).toBe('MyJsonData');
      expect(convertToPascalCase('API_Key')).toBe('ApiKey');
      expect(convertToPascalCase('OAuth2_token')).toBe('OAuth2Token');
    });

    test('special characters', () => {
      expect(convertToPascalCase('hello & world')).toBe('HelloAndWorld');
      expect(convertToPascalCase("user's name")).toBe('UsersName');
      expect(convertToPascalCase('"quoted" string')).toBe('QuotedString');
      expect(convertToPascalCase('special!@#characters')).toBe('SpecialCharacters');
    });

    test('leading and trailing whitespace', () => {
      expect(convertToPascalCase('  leading space')).toBe('LeadingSpace');
      expect(convertToPascalCase('trailing space  ')).toBe('TrailingSpace');
      expect(convertToPascalCase('  both ends  ')).toBe('BothEnds');
    });

    test('multiple consecutive delimiters', () => {
      expect(convertToPascalCase('multiple___underscores')).toBe('MultipleUnderscores');
      expect(convertToPascalCase('multiple---hyphens')).toBe('MultipleHyphens');
      expect(convertToPascalCase('multiple...dots')).toBe('MultipleDots');
    });

    test('mixed delimiters', () => {
      expect(convertToPascalCase('mixed_delimiters-and.cases')).toBe(
        'MixedDelimitersAndCases',
      );

      expect(convertToPascalCase('UPPER_CASE-mixedCase.lower_case')).toBe(
        'UpperCaseMixedCaseLowerCase',
      );
    });

    test('edge cases', () => {
      expect(convertToPascalCase('convert XML to JSON')).toBe('ConvertXmlToJson');
      expect(convertToPascalCase('HTTP_request_URL')).toBe('HttpRequestUrl');
    });
  });
});
