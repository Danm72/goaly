import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import matter from 'gray-matter';
import { meetingToMarkdown } from '../lib/to-markdown.js';
import type { GranolaMeetingDetail } from '../lib/granola-client.js';

// Fix _synced_at to a stable value for snapshot tests
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-03-04T10:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

function makeMeeting(overrides: Partial<GranolaMeetingDetail> = {}): GranolaMeetingDetail {
  return {
    id: 'abc12345-6789-0000-1111-222233334444',
    title: 'Weekly standup',
    date: '2026-03-01T09:00:00Z',
    attendees: ['[Your Name]', 'Alice Smith'],
    duration_minutes: 30,
    summary: 'Discussed project timeline.',
    transcript: '[Owner]: Hello\nAlice: Hi there',
    action_items: ['Follow up on timeline', 'Share docs'],
    ...overrides,
  };
}

describe('meetingToMarkdown', () => {
  it('produces a valid markdown file with frontmatter', () => {
    const result = meetingToMarkdown(makeMeeting());
    const parsed = matter(result.content);

    expect(parsed.data['title']).toBe('Weekly standup');
    expect(parsed.data['meeting_id']).toBe('abc12345-6789-0000-1111-222233334444');
    // gray-matter parses YAML dates as Date objects
    const dateVal = parsed.data['date'];
    const dateStr = dateVal instanceof Date ? dateVal.toISOString().split('T')[0] : String(dateVal);
    expect(dateStr).toBe('2026-03-01');
    expect(parsed.data['attendees']).toEqual(['[Your Name]', 'Alice Smith']);
    expect(parsed.data['duration_minutes']).toBe(30);
    expect(parsed.data['transcript_status']).toBe('complete');
    expect(parsed.data['transcript_checksum']).toMatch(/^sha256:/);
  });

  it('generates a slugified filename with date and meeting ID prefix', () => {
    const result = meetingToMarkdown(makeMeeting());
    expect(result.filename).toMatch(/^2026-03-01-weekly-standup-abc12345\.md$/);
  });

  it('includes AI Summary section', () => {
    const result = meetingToMarkdown(makeMeeting());
    expect(result.content).toContain('## AI Summary');
    expect(result.content).toContain('Discussed project timeline.');
  });

  it('includes Transcript section', () => {
    const result = meetingToMarkdown(makeMeeting());
    expect(result.content).toContain('## Transcript');
    expect(result.content).toContain('[Owner]: Hello');
    expect(result.content).toContain('Alice: Hi there');
  });

  it('includes Action Items section', () => {
    const result = meetingToMarkdown(makeMeeting());
    expect(result.content).toContain('## Action Items');
    expect(result.content).toContain('- Follow up on timeline');
    expect(result.content).toContain('- Share docs');
  });

  it('handles meeting with no transcript (pending)', () => {
    const result = meetingToMarkdown(makeMeeting({
      transcript: undefined,
    }));
    const parsed = matter(result.content);

    expect(parsed.data['transcript_status']).toBe('pending');
    expect(parsed.data['transcript_checksum']).toBeUndefined();
    expect(result.content).not.toContain('## Transcript');
  });

  it('handles meeting with no summary', () => {
    const result = meetingToMarkdown(makeMeeting({
      summary: undefined,
    }));
    expect(result.content).not.toContain('## AI Summary');
  });

  it('handles meeting with no action items', () => {
    const result = meetingToMarkdown(makeMeeting({
      action_items: [],
    }));
    expect(result.content).not.toContain('## Action Items');
  });

  it('handles meeting with undefined action items', () => {
    const result = meetingToMarkdown(makeMeeting({
      action_items: undefined,
    }));
    expect(result.content).not.toContain('## Action Items');
  });

  it('omits duration_minutes when not provided', () => {
    const result = meetingToMarkdown(makeMeeting({
      duration_minutes: undefined,
    }));
    const parsed = matter(result.content);
    expect(parsed.data['duration_minutes']).toBeUndefined();
  });

  it('generates different checksums for different transcripts', () => {
    const r1 = meetingToMarkdown(makeMeeting({ transcript: 'Version A' }));
    const r2 = meetingToMarkdown(makeMeeting({ transcript: 'Version B' }));

    const parsed1 = matter(r1.content);
    const parsed2 = matter(r2.content);

    expect(parsed1.data['transcript_checksum']).not.toBe(parsed2.data['transcript_checksum']);
  });

  it('truncates long titles in slugified filename to 60 chars', () => {
    const longTitle = 'A'.repeat(100);
    const result = meetingToMarkdown(makeMeeting({ title: longTitle }));
    // Date prefix + slug (max 60) + meeting ID prefix + .md
    const slugPart = result.filename.split('-').slice(3, -1).join('-');
    expect(slugPart.length).toBeLessThanOrEqual(60);
  });
});

describe('client auto-detection', () => {
  it('detects Client-B from title', () => {
    const result = meetingToMarkdown(makeMeeting({ title: 'Client-B standup' }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Client-B');
  });

  it('detects Client-A from title', () => {
    const result = meetingToMarkdown(makeMeeting({ title: 'Client-A discovery call' }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Client-A');
  });

  it('detects Client-C from title', () => {
    const result = meetingToMarkdown(makeMeeting({ title: 'Call with Client-C' }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Client-C');
  });

  it('detects Executive Development from coaching keyword', () => {
    const result = meetingToMarkdown(makeMeeting({ title: 'Coaching session' }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Executive Development');
  });

  it('detects Executive Development from [Coach] in attendees', () => {
    const result = meetingToMarkdown(makeMeeting({
      title: 'Bi-weekly session',
      attendees: ['[Your Name]', '[Coach] Kaplan'],
    }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Executive Development');
  });

  it('detects Client-D from title', () => {
    const result = meetingToMarkdown(makeMeeting({ title: 'Client-D catch-up' }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Client-D');
  });

  it('detects Client-G from contact-10 in attendees', () => {
    const result = meetingToMarkdown(makeMeeting({
      title: 'Intro call',
      attendees: ['[Your Name]', 'Contact-10'],
    }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBe('Client-G');
  });

  it('returns no client when no pattern matches', () => {
    const result = meetingToMarkdown(makeMeeting({
      title: 'Random internal meeting',
      attendees: ['[Your Name]', 'Someone Else'],
    }));
    const parsed = matter(result.content);
    expect(parsed.data['client']).toBeUndefined();
  });
});
