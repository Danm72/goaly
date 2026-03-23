// Vitest setup file — runs before any test files are imported.
// Sets NOTION_TOKEN so that notion-client.ts doesn't throw on import.
process.env['NOTION_TOKEN'] = 'test-token-vitest-setup';
