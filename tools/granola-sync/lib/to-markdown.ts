import matter from 'gray-matter';
import yaml from 'js-yaml';
import { createHash } from 'node:crypto';
import type { GranolaMeetingDetail } from './granola-client.js';

export interface ConvertedMeeting {
  filename: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

// Client auto-detection from title and attendees
// Maps known patterns to client/project names
const CLIENT_PATTERNS: Array<{ pattern: RegExp; client: string }> = [
  { pattern: /[coach]|coaching/i, client: 'Executive Development' },
  { pattern: /client-b|sports/i, client: 'Client-B' },
  { pattern: /client-a/i, client: 'Client-A' },
  { pattern: /client-c/i, client: 'Client-C' },
  { pattern: /client-d/i, client: 'Client-D' },
  { pattern: /client-g|contact-10/i, client: 'Client-G' },
];

function detectClient(title: string, attendees: string[]): string | null {
  const searchText = [title, ...attendees].join(' ');
  for (const { pattern, client } of CLIENT_PATTERNS) {
    if (pattern.test(searchText)) return client;
  }
  return null;
}

export function meetingToMarkdown(meeting: GranolaMeetingDetail): ConvertedMeeting {
  const dateStr = new Date(meeting.date).toISOString().split('T')[0]!;
  const hasTranscript = Boolean(meeting.transcript);

  const transcriptChecksum = hasTranscript && meeting.transcript
    ? `sha256:${createHash('sha256').update(meeting.transcript).digest('hex')}`
    : undefined;

  const client = detectClient(meeting.title, meeting.attendees);

  const frontmatter: Record<string, unknown> = {
    title: meeting.title,
    meeting_id: meeting.id,
    date: dateStr,
    attendees: meeting.attendees,
    ...(meeting.duration_minutes !== undefined ? { duration_minutes: meeting.duration_minutes } : {}),
    ...(client ? { client } : {}),
    transcript_status: hasTranscript ? 'complete' : 'pending',
    ...(transcriptChecksum ? { transcript_checksum: transcriptChecksum } : {}),
    _synced_at: new Date().toISOString(),
  };

  // Build body sections
  const bodyParts: string[] = [];

  if (meeting.summary) {
    bodyParts.push('## AI Summary');
    bodyParts.push('');
    bodyParts.push(meeting.summary);
    bodyParts.push('');
  }

  if (meeting.transcript) {
    bodyParts.push('## Transcript');
    bodyParts.push('');
    bodyParts.push(meeting.transcript);
    bodyParts.push('');
  }

  if (meeting.action_items && meeting.action_items.length > 0) {
    bodyParts.push('## Action Items');
    bodyParts.push('');
    for (const item of meeting.action_items) {
      bodyParts.push(`- ${item}`);
    }
    bodyParts.push('');
  }

  const filename = `${dateStr}-${slugify(meeting.title)}-${meeting.id.slice(0, 8)}.md`;

  const content = matter.stringify(
    bodyParts.length > 0 ? `\n${bodyParts.join('\n')}\n` : '',
    frontmatter,
    {
      engines: {
        yaml: {
          stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
          parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
        },
      },
    }
  );

  return { filename, content, frontmatter };
}
