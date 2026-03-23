import matter from 'gray-matter';
import yaml from 'js-yaml';
import TurndownService from 'turndown';

const YAML_ENGINE = {
  yaml: {
    stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
    parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
  },
};

// Lazy turndown instance
let _turndown: TurndownService | undefined;
function getTurndown(): TurndownService {
  if (!_turndown) {
    _turndown = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
  }
  return _turndown;
}

export interface ParsedMessage {
  id: string;
  date: string; // ISO
  from: string;
  to: string;
  cc?: string;
  subject: string;
  body: string;
  isHtml: boolean;
  labels: string[];
}

export interface ParsedThread {
  id: string;
  messages: ParsedMessage[];
}

export interface ConvertedThread {
  filename: string;
  content: string;
  frontmatter: Record<string, unknown>;
}

// [Owner]'s email addresses (outbound detection)
const DAN_EMAILS = new Set(['you@example.com', 'you@example.com']);

function is[Owner]Email(email: string): boolean {
  const match = email.match(/<([^>]+)>/);
  const addr = match ? match[1]! : email;
  return DAN_EMAILS.has(addr.toLowerCase());
}

function extractEmail(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/);
  return match ? match[1]!.toLowerCase() : headerValue.toLowerCase();
}

function extractAllEmails(messages: ParsedMessage[]): string[] {
  const emails = new Set<string>();
  for (const msg of messages) {
    emails.add(extractEmail(msg.from));
    for (const addr of msg.to.split(',').map(s => s.trim()).filter(Boolean)) {
      emails.add(extractEmail(addr));
    }
    if (msg.cc) {
      for (const addr of msg.cc.split(',').map(s => s.trim()).filter(Boolean)) {
        emails.add(extractEmail(addr));
      }
    }
  }
  return [...emails];
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

export function threadToMarkdown(
  thread: ParsedThread,
  contactLookup: Map<string, string>,
): ConvertedThread {
  const messages = [...thread.messages].sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );

  const firstMsg = messages[0]!;
  const lastMsg = messages[messages.length - 1]!;
  const participants = extractAllEmails(messages);
  const allLabels = [...new Set(messages.flatMap(m => m.labels))];

  // Detect client from participants
  let client: string | null = null;
  for (const email of participants) {
    const c = contactLookup.get(email);
    if (c) {
      client = c;
      break;
    }
  }

  // Direction: based on first message sender
  const direction = is[Owner]Email(firstMsg.from) ? 'Outbound' : 'Inbound';

  const dateStr = new Date(firstMsg.date).toISOString().split('T')[0]!;

  const frontmatter: Record<string, unknown> = {
    title: firstMsg.subject || '(no subject)',
    thread_id: thread.id,
    from: extractEmail(firstMsg.from),
    to: extractEmail(firstMsg.to),
    participants,
    date: dateStr,
    labels: allLabels,
    message_count: messages.length,
    last_message_date: new Date(lastMsg.date).toISOString().split('T')[0]!,
    ...(client ? { client } : {}),
    direction,
    _synced_at: new Date().toISOString(),
  };

  // Build body
  const bodyParts: string[] = [];
  for (let i = 0; i < messages.length; i++) {
    const msg = messages[i]!;
    const msgDate = new Date(msg.date).toISOString().split('T')[0]!;
    const senderName = msg.from.replace(/<[^>]+>/, '').trim() || msg.from;

    bodyParts.push(`## Message ${i + 1} — ${msgDate} (${senderName})`);
    bodyParts.push('');
    bodyParts.push(`**From:** ${msg.from}`);
    bodyParts.push(`**To:** ${msg.to}`);
    if (msg.cc) bodyParts.push(`**CC:** ${msg.cc}`);
    bodyParts.push('');

    let body = msg.body;
    if (msg.isHtml) {
      body = getTurndown().turndown(body);
    }
    // Strip signature lines
    body = body.replace(/\n--\s*\n[\s\S]*$/, '');
    bodyParts.push(body.trim());

    if (i < messages.length - 1) {
      bodyParts.push('');
      bodyParts.push('---');
      bodyParts.push('');
    }
  }

  const filename = `${dateStr}-${slugify(firstMsg.subject || 'no-subject')}-${thread.id.slice(0, 8)}.md`;

  const content = matter.stringify(`\n${bodyParts.join('\n')}\n`, frontmatter, {
    engines: YAML_ENGINE,
  });

  return { filename, content, frontmatter };
}
