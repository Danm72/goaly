import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import matter from 'gray-matter';
import yaml from 'js-yaml';

const YAML_ENGINE = {
  yaml: {
    parse: (str: string) => yaml.load(str, { schema: yaml.JSON_SCHEMA }) as object,
    stringify: (obj: object) => yaml.dump(obj, { schema: yaml.JSON_SCHEMA, lineWidth: -1 }),
  },
};

/**
 * Build email→client lookup from notion-mirror/contacts/ markdown files.
 * Returns a Map<lowercased-email, client-name>.
 */
export function buildContactLookup(contactsDir: string): Map<string, string> {
  const lookup = new Map<string, string>();

  let files: string[];
  try {
    files = readdirSync(contactsDir).filter(f => f.endsWith('.md'));
  } catch {
    return lookup; // Return empty if dir doesn't exist
  }

  for (const file of files) {
    const content = readFileSync(join(contactsDir, file), 'utf-8');
    const parsed = matter(content, { engines: YAML_ENGINE });

    const email = parsed.data['email'];
    const client = parsed.data['client'];

    if (typeof email === 'string' && typeof client === 'string') {
      lookup.set(email.toLowerCase(), client);
    }
  }

  return lookup;
}

/**
 * Detect client from a list of participant email addresses.
 * Returns the first matching client name or null.
 */
export function detectClient(
  participants: string[],
  contactLookup: Map<string, string>,
): string | null {
  for (const email of participants) {
    const client = contactLookup.get(email.toLowerCase());
    if (client) return client;
  }
  return null;
}
