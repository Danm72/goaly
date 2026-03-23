import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { buildContactLookup, detectClient } from '../lib/contacts.js';

let tempDir: string;

beforeEach(() => {
  tempDir = join(tmpdir(), `contacts-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  mkdirSync(tempDir, { recursive: true });
});

afterEach(() => {
  rmSync(tempDir, { recursive: true, force: true });
});

function writeContact(filename: string, frontmatter: Record<string, string>, body = ''): void {
  const yamlLines = Object.entries(frontmatter).map(([k, v]) => `${k}: "${v}"`);
  const content = `---\n${yamlLines.join('\n')}\n---\n${body}`;
  writeFileSync(join(tempDir, filename), content, 'utf-8');
}

describe('buildContactLookup', () => {
  it('builds lookup from valid contacts with email and client', () => {
    writeContact('alice.md', { title: 'Alice Smith', email: 'alice@example.com', client: 'Acme Corp' });
    writeContact('bob.md', { title: 'Bob Jones', email: 'bob@test.com', client: 'Client-A' });

    const lookup = buildContactLookup(tempDir);
    expect(lookup.size).toBe(2);
    expect(lookup.get('alice@example.com')).toBe('Acme Corp');
    expect(lookup.get('bob@test.com')).toBe('Client-A');
  });

  it('skips contacts without email field', () => {
    writeContact('no-email.md', { title: 'No Email Person', client: 'SomeCorp' });

    const lookup = buildContactLookup(tempDir);
    expect(lookup.size).toBe(0);
  });

  it('skips contacts without client field', () => {
    writeContact('no-client.md', { title: 'Orphan Person', email: 'orphan@test.com' });

    const lookup = buildContactLookup(tempDir);
    expect(lookup.size).toBe(0);
  });

  it('normalizes email to lowercase', () => {
    writeContact('upper.md', { title: 'Upper Case', email: 'UPPER@EXAMPLE.COM', client: 'TestCo' });

    const lookup = buildContactLookup(tempDir);
    expect(lookup.get('upper@example.com')).toBe('TestCo');
    expect(lookup.has('UPPER@EXAMPLE.COM')).toBe(false);
  });

  it('returns empty map for empty directory', () => {
    const lookup = buildContactLookup(tempDir);
    expect(lookup.size).toBe(0);
  });

  it('returns empty map for non-existent directory', () => {
    const lookup = buildContactLookup('/tmp/definitely-does-not-exist-xyz123');
    expect(lookup.size).toBe(0);
  });

  it('ignores non-markdown files', () => {
    writeFileSync(join(tempDir, 'notes.txt'), 'some text', 'utf-8');
    writeFileSync(join(tempDir, 'data.json'), '{}', 'utf-8');

    const lookup = buildContactLookup(tempDir);
    expect(lookup.size).toBe(0);
  });

  it('handles multiple contacts for different clients', () => {
    writeContact('c1.md', { title: 'A', email: 'a@one.com', client: 'Client One' });
    writeContact('c2.md', { title: 'B', email: 'b@two.com', client: 'Client Two' });
    writeContact('c3.md', { title: 'C', email: 'c@one.com', client: 'Client One' });

    const lookup = buildContactLookup(tempDir);
    expect(lookup.size).toBe(3);
    expect(lookup.get('a@one.com')).toBe('Client One');
    expect(lookup.get('c@one.com')).toBe('Client One');
    expect(lookup.get('b@two.com')).toBe('Client Two');
  });
});

describe('detectClient', () => {
  it('returns client name for matching participant', () => {
    const lookup = new Map([
      ['alice@example.com', 'Acme Corp'],
      ['bob@test.com', 'Client-A'],
    ]);
    expect(detectClient(['alice@example.com'], lookup)).toBe('Acme Corp');
  });

  it('returns first matching client when multiple participants match', () => {
    const lookup = new Map([
      ['alice@example.com', 'Acme Corp'],
      ['bob@test.com', 'Client-A'],
    ]);
    expect(detectClient(['bob@test.com', 'alice@example.com'], lookup)).toBe('Client-A');
  });

  it('returns null when no participant matches', () => {
    const lookup = new Map([['alice@example.com', 'Acme Corp']]);
    expect(detectClient(['unknown@other.com'], lookup)).toBeNull();
  });

  it('returns null for empty participants list', () => {
    const lookup = new Map([['alice@example.com', 'Acme Corp']]);
    expect(detectClient([], lookup)).toBeNull();
  });

  it('matches case-insensitively', () => {
    const lookup = new Map([['alice@example.com', 'Acme Corp']]);
    expect(detectClient(['ALICE@EXAMPLE.COM'], lookup)).toBe('Acme Corp');
  });

  it('returns null with empty lookup', () => {
    expect(detectClient(['test@test.com'], new Map())).toBeNull();
  });
});
