import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import pRetry from 'p-retry';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const GRANOLA_MCP_URL = 'https://mcp.granola.ai/mcp';

// Types for Granola MCP responses
export interface GranolaMeeting {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  duration_minutes?: number;
  has_transcript: boolean;
}

export interface GranolaMeetingDetail {
  id: string;
  title: string;
  date: string;
  attendees: string[];
  duration_minutes?: number;
  summary?: string;
  transcript?: string;
  action_items?: string[];
  transcript_checksum?: string;
}

// Runtime type guards
function isGranolaMeeting(value: unknown): value is GranolaMeeting {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['id'] === 'string' && typeof obj['title'] === 'string';
}

function isGranolaMeetingDetail(value: unknown): value is GranolaMeetingDetail {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return typeof obj['id'] === 'string' && typeof obj['title'] === 'string';
}

// Extract auth token from .mcp.json or env
function getAuthToken(projectRoot: string): string {
  const envToken = process.env['GRANOLA_TOKEN'];
  if (envToken) return envToken;

  try {
    const mcpConfigPath = resolve(projectRoot, '.mcp.json');
    const mcpConfig = JSON.parse(readFileSync(mcpConfigPath, 'utf-8'));
    // Navigate to granola server config to find auth headers
    const granola = mcpConfig?.mcpServers?.granola;
    if (granola?.headers?.Authorization) {
      return granola.headers.Authorization.replace('Bearer ', '');
    }
    // Check if it's under a different key
    if (granola?.env?.GRANOLA_TOKEN) {
      return granola.env.GRANOLA_TOKEN;
    }
  } catch {
    // Fall through
  }

  throw new Error(
    'GRANOLA_TOKEN not found. Set GRANOLA_TOKEN env var or configure in .mcp.json'
  );
}

export class GranolaClient {
  private client: Client | null = null;
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = projectRoot;
  }

  private async getClient(): Promise<Client> {
    if (this.client) return this.client;

    const token = getAuthToken(this.projectRoot);

    const transport = new StreamableHTTPClientTransport(
      new URL(GRANOLA_MCP_URL),
      {
        requestInit: {
          headers: {
            'Authorization': `Bearer ${token}`,
          },
        },
      }
    );

    this.client = new Client({ name: 'granola-sync', version: '1.0.0' });
    await this.client.connect(transport as Transport);

    return this.client;
  }

  async listMeetings(since?: Date): Promise<GranolaMeeting[]> {
    return pRetry(async () => {
      const client = await this.getClient();

      const result = await client.callTool({
        name: 'get_meetings',
        arguments: since ? { since: since.toISOString() } : {},
      });

      // Parse the content from MCP tool result
      const content = result.content;
      if (!Array.isArray(content) || content.length === 0) return [];

      const textContent = content.find(c => (c as Record<string, unknown>)['type'] === 'text');
      if (!textContent) return [];

      const parsed = JSON.parse((textContent as Record<string, unknown>)['text'] as string);
      const meetings = Array.isArray(parsed) ? parsed : (parsed as Record<string, unknown>)['meetings'] ?? [];

      return (meetings as unknown[]).filter(isGranolaMeeting);
    }, { retries: 3 });
  }

  async getMeetingDetail(meetingId: string): Promise<GranolaMeetingDetail | null> {
    return pRetry(async () => {
      const client = await this.getClient();

      const result = await client.callTool({
        name: 'get_meeting_transcript',
        arguments: { meeting_id: meetingId },
      });

      const content = result.content;
      if (!Array.isArray(content) || content.length === 0) return null;

      const textContent = content.find(c => (c as Record<string, unknown>)['type'] === 'text');
      if (!textContent) return null;

      const parsed = JSON.parse((textContent as Record<string, unknown>)['text'] as string);

      return isGranolaMeetingDetail(parsed) ? parsed : null;
    }, { retries: 3 });
  }

  async queryMeetings(query: string): Promise<GranolaMeeting[]> {
    return pRetry(async () => {
      const client = await this.getClient();

      const result = await client.callTool({
        name: 'query_granola_meetings',
        arguments: { query },
      });

      const content = result.content;
      if (!Array.isArray(content) || content.length === 0) return [];

      const textContent = content.find(c => (c as Record<string, unknown>)['type'] === 'text');
      if (!textContent) return [];

      const parsed = JSON.parse((textContent as Record<string, unknown>)['text'] as string);
      const meetings = Array.isArray(parsed) ? parsed : [];

      return (meetings as unknown[]).filter(isGranolaMeeting);
    }, { retries: 3 });
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
    }
  }
}

// Pre-flight check
export async function checkGranolaAccess(projectRoot: string): Promise<void> {
  const client = new GranolaClient(projectRoot);
  try {
    await client.listMeetings(); // Will throw if auth fails
    await client.disconnect();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Granola MCP access check failed: ${msg}`);
  }
}
