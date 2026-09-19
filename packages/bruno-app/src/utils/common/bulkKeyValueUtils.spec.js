const { describe, it, expect } = require('@jest/globals');

import { parsePastedKeyValuePair } from './bulkKeyValueUtils';

describe('parsePastedKeyValuePair', () => {
  describe('pairs it splits', () => {
    it('splits a quoted key and quoted value', () => {
      expect(parsePastedKeyValuePair('"authorization": "eyJhbGciOi"')).toEqual({
        name: 'authorization',
        value: 'eyJhbGciOi'
      });
    });

    it('splits a quoted key with an unquoted value', () => {
      expect(parsePastedKeyValuePair('"x-sp-tenant-slug": tom-db-per-tenant')).toEqual({
        name: 'x-sp-tenant-slug',
        value: 'tom-db-per-tenant'
      });
    });

    it('ignores a trailing comma left over from copying a line out of an object', () => {
      expect(parsePastedKeyValuePair('"authorization": "eyJhbGciOi",')).toEqual({
        name: 'authorization',
        value: 'eyJhbGciOi'
      });
    });

    it('ignores a trailing newline, which copying a line out of a file brings along', () => {
      expect(parsePastedKeyValuePair('"authorization": "eyJhbGciOi"\n')).toEqual({
        name: 'authorization',
        value: 'eyJhbGciOi'
      });
    });

    it('ignores a trailing CRLF, which is what Windows copies', () => {
      expect(parsePastedKeyValuePair('"authorization": "eyJhbGciOi",\r\n')).toEqual({
        name: 'authorization',
        value: 'eyJhbGciOi'
      });
    });

    it('ignores surrounding whitespace and indentation', () => {
      expect(parsePastedKeyValuePair('   "authorization" :  "eyJhbGciOi"  ')).toEqual({
        name: 'authorization',
        value: 'eyJhbGciOi'
      });
    });

    it('keeps colons inside the value, so JWTs and URLs survive', () => {
      expect(parsePastedKeyValuePair('"graphql-endpoint": "https://example.com/graphql"')).toEqual({
        name: 'graphql-endpoint',
        value: 'https://example.com/graphql'
      });
    });

    it('resolves escaped quotes inside the value', () => {
      expect(parsePastedKeyValuePair('"greeting": "he said \\"hi\\""')).toEqual({
        name: 'greeting',
        value: 'he said "hi"'
      });
    });

    it('stringifies a non-string value', () => {
      expect(parsePastedKeyValuePair('"retries": 3')).toEqual({ name: 'retries', value: '3' });
    });

    it('accepts an empty value', () => {
      expect(parsePastedKeyValuePair('"authorization": ""')).toEqual({ name: 'authorization', value: '' });
    });
  });

  describe('text it leaves alone', () => {
    it('rejects a bare URL, which would otherwise split on the scheme colon', () => {
      expect(parsePastedKeyValuePair('https://example.com/graphql')).toBeNull();
    });

    it('rejects an unquoted pair, since it cannot be told apart from a URL', () => {
      expect(parsePastedKeyValuePair('authorization: eyJhbGciOi')).toBeNull();
    });

    it('rejects an unquoted key, which is not how JSON writes one', () => {
      expect(parsePastedKeyValuePair('authorization: "eyJhbGciOi"')).toBeNull();
    });

    it('rejects multi-line text', () => {
      expect(parsePastedKeyValuePair('"a": "1"\n"b": "2"')).toBeNull();
    });

    it('rejects plain text with no colon', () => {
      expect(parsePastedKeyValuePair('authorization')).toBeNull();
    });

    it('rejects a key with no value', () => {
      expect(parsePastedKeyValuePair('"authorization":')).toBeNull();
    });

    it('rejects an empty key', () => {
      expect(parsePastedKeyValuePair('"": "eyJhbGciOi"')).toBeNull();
    });

    it('rejects empty and whitespace-only input', () => {
      expect(parsePastedKeyValuePair('')).toBeNull();
      expect(parsePastedKeyValuePair('   ')).toBeNull();
    });

    it('rejects non-string input', () => {
      expect(parsePastedKeyValuePair(undefined)).toBeNull();
      expect(parsePastedKeyValuePair(null)).toBeNull();
    });
  });
});
