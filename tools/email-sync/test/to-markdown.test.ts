import { describe, it, expect } from 'vitest';
import matter from 'gray-matter';
import yaml from 'js-yaml';
import { threadToMarkdown } from '../lib/to-markdown.js';
import type { ParsedThread, ParsedMessage } from '../lib/to-markdown.js';

const YAML_ENGINE = {
  yaml: {
    parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
    stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
  },
};

function makeMessage(overrides: Partial<ParsedMessage> = {}): ParsedMessage {
  return {
    id: 'msg1',
    date: '2026-03-01T10:00:00Z',
    from: 'Alice <alice@example.com>',
    to: '[Owner] <you@example.com>',
    subject: 'Test Subject',
    body: 'Hello from Alice',
    isHtml: false,
    labels: ['INBOX'],
    ...overrides,
  };
}

function makeThread(messages: ParsedMessage[], id = 'thread123abc'): ParsedThread {
  return { id, messages };
}

function parseFrontmatter(content: string): Record<string, unknown> {
  return matter(content, { engines: YAML_ENGINE }).data;
}

describe('threadToMarkdown', () => {
  it('converts a single-message thread to markdown', () => {
    const thread = makeThread([makeMessage()]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.filename).toContain('test-subject');
    expect(result.filename).toContain('thread12');
    expect(result.filename).toMatch(/\.md$/);
    expect(result.content).toContain('Hello from Alice');
  });

  it('converts a multi-message thread with correct message headers', () => {
    const msg1 = makeMessage({ id: 'msg1', date: '2026-03-01T10:00:00Z', body: 'First message' });
    const msg2 = makeMessage({
      id: 'msg2',
      date: '2026-03-02T10:00:00Z',
      from: '[Owner] <you@example.com>',
      to: 'Alice <alice@example.com>',
      body: 'Reply from [Owner]',
    });
    const thread = makeThread([msg1, msg2]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.content).toContain('## Message 1');
    expect(result.content).toContain('## Message 2');
    expect(result.content).toContain('First message');
    expect(result.content).toContain('Reply from [Owner]');
    // Messages separated by ---
    expect(result.content).toContain('---');
  });

  it('sets frontmatter fields correctly', () => {
    const thread = makeThread([makeMessage()]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    expect(fm['title']).toBe('Test Subject');
    expect(fm['thread_id']).toBe('thread123abc');
    expect(fm['from']).toBe('alice@example.com');
    expect(fm['to']).toBe('you@example.com');
    expect(fm['date']).toBe('2026-03-01');
    expect(fm['message_count']).toBe(1);
    expect(fm['last_message_date']).toBe('2026-03-01');
    expect(fm['labels']).toEqual(['INBOX']);
    expect(fm['_synced_at']).toBeDefined();
  });

  it('detects Outbound direction when [Owner] sends first message', () => {
    const msg = makeMessage({ from: '[Owner] <you@example.com>', to: 'Alice <alice@example.com>' });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    expect(fm['direction']).toBe('Outbound');
  });

  it('detects Outbound for you@example.com alias', () => {
    const msg = makeMessage({ from: '[Owner] <you@example.com>', to: 'Alice <alice@example.com>' });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    expect(fm['direction']).toBe('Outbound');
  });

  it('detects Inbound direction when external email sends first', () => {
    const msg = makeMessage({ from: 'Alice <alice@example.com>', to: '[Owner] <you@example.com>' });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    expect(fm['direction']).toBe('Inbound');
  });

  it('converts HTML body via turndown', () => {
    const msg = makeMessage({ body: '<p>Hello <strong>World</strong></p>', isHtml: true });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.content).toContain('Hello **World**');
    expect(result.content).not.toContain('<p>');
  });

  it('preserves plain text body as-is', () => {
    const msg = makeMessage({ body: 'Plain text here\nwith newlines', isHtml: false });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.content).toContain('Plain text here\nwith newlines');
  });

  it('strips signature lines (-- followed by content)', () => {
    const msg = makeMessage({ body: 'Main body\n\n-- \n[Your Name]\nFounder', isHtml: false });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.content).toContain('Main body');
    expect(result.content).not.toContain('[Your Name]');
    expect(result.content).not.toContain('Founder');
  });

  it('generates correct filename with date, slug, and thread ID prefix', () => {
    const msg = makeMessage({ date: '2026-02-15T12:00:00Z', subject: 'Weekly Update: Project Status!' });
    const thread = makeThread([msg], 'abc12345xyz');
    const result = threadToMarkdown(thread, new Map());

    expect(result.filename).toBe('2026-02-15-weekly-update-project-status-abc12345.md');
  });

  it('handles no subject gracefully', () => {
    const msg = makeMessage({ subject: '' });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    expect(fm['title']).toBe('(no subject)');
    expect(result.filename).toContain('no-subject');
  });

  it('does not coerce date strings to Date objects in frontmatter (JSON_SCHEMA)', () => {
    const thread = makeThread([makeMessage()]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    // date should be a string, not a Date object
    expect(typeof fm['date']).toBe('string');
    expect(typeof fm['last_message_date']).toBe('string');
  });

  it('detects client from contact lookup', () => {
    const lookup = new Map([['alice@example.com', 'Acme Corp']]);
    const thread = makeThread([makeMessage()]);
    const result = threadToMarkdown(thread, lookup);
    const fm = parseFrontmatter(result.content);

    expect(fm['client']).toBe('Acme Corp');
  });

  it('does not include client field when no contact matches', () => {
    const thread = makeThread([makeMessage()]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);

    expect(fm['client']).toBeUndefined();
  });

  it('extracts all unique participant emails across messages', () => {
    const msg1 = makeMessage({
      from: 'Alice <alice@example.com>',
      to: '[Owner] <you@example.com>',
      cc: 'Bob <bob@test.com>',
    });
    const msg2 = makeMessage({
      id: 'msg2',
      from: '[Owner] <you@example.com>',
      to: 'Alice <alice@example.com>, Carol <carol@test.com>',
    });
    const thread = makeThread([msg1, msg2]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);
    const participants = fm['participants'] as string[];

    expect(participants).toContain('alice@example.com');
    expect(participants).toContain('you@example.com');
    expect(participants).toContain('bob@test.com');
    expect(participants).toContain('carol@test.com');
    // No duplicates
    const uniqueSet = new Set(participants);
    expect(uniqueSet.size).toBe(participants.length);
  });

  it('merges labels from all messages (deduplicated)', () => {
    const msg1 = makeMessage({ labels: ['INBOX', 'IMPORTANT'] });
    const msg2 = makeMessage({ id: 'msg2', labels: ['INBOX', 'SENT'] });
    const thread = makeThread([msg1, msg2]);
    const result = threadToMarkdown(thread, new Map());
    const fm = parseFrontmatter(result.content);
    const labels = fm['labels'] as string[];

    expect(labels).toContain('INBOX');
    expect(labels).toContain('IMPORTANT');
    expect(labels).toContain('SENT');
  });

  it('sorts messages chronologically regardless of input order', () => {
    const msg1 = makeMessage({ id: 'msg1', date: '2026-03-02T10:00:00Z', body: 'Second chronologically' });
    const msg2 = makeMessage({ id: 'msg2', date: '2026-03-01T10:00:00Z', body: 'First chronologically' });
    // Input order reversed
    const thread = makeThread([msg1, msg2]);
    const result = threadToMarkdown(thread, new Map());

    const msg1Pos = result.content.indexOf('First chronologically');
    const msg2Pos = result.content.indexOf('Second chronologically');
    expect(msg1Pos).toBeLessThan(msg2Pos);
  });

  it('includes CC in message body when present', () => {
    const msg = makeMessage({ cc: 'Bob <bob@test.com>' });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.content).toContain('**CC:** Bob <bob@test.com>');
  });

  it('omits CC line when not present', () => {
    const msg = makeMessage({ cc: undefined });
    const thread = makeThread([msg]);
    const result = threadToMarkdown(thread, new Map());

    expect(result.content).not.toContain('**CC:**');
  });
});
