import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';

// Store mock callTool so we can control responses
const mockCallTool = vi.fn();
const mockConnect = vi.fn().mockResolvedValue(undefined);
const mockClose = vi.fn().mockResolvedValue(undefined);

// Mock the MCP SDK
vi.mock('@modelcontextprotocol/sdk/client/index.js', () => ({
  Client: vi.fn().mockImplementation(() => ({
    connect: mockConnect,
    close: mockClose,
    callTool: mockCallTool,
  })),
}));

vi.mock('@modelcontextprotocol/sdk/client/streamableHttp.js', () => ({
  StreamableHTTPClientTransport: vi.fn().mockImplementation(() => ({})),
}));

// Mock p-retry to execute immediately without retries in tests
vi.mock('p-retry', () => ({
  default: vi.fn().mockImplementation(async (fn: () => Promise<unknown>) => fn()),
}));

// Mock fs for auth token tests
vi.mock('node:fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('node:fs')>();
  return {
    ...actual,
    readFileSync: vi.fn().mockImplementation(actual.readFileSync),
  };
});

const { GranolaClient } = await import('../lib/granola-client.js');

describe('GranolaClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env['GRANOLA_TOKEN'] = 'test-token-123';
    // Default: return empty content
    mockCallTool.mockResolvedValue({ content: [] });
  });

  afterEach(() => {
    delete process.env['GRANOLA_TOKEN'];
  });

  describe('listMeetings', () => {
    it('returns meetings from MCP response', async () => {
      const mockMeetings = [
        { id: 'meeting-1', title: 'Standup', date: '2026-03-01', attendees: ['[Owner]'], has_transcript: true },
        { id: 'meeting-2', title: 'Review', date: '2026-03-02', attendees: ['[Owner]', 'Alice'], has_transcript: false },
      ];

      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(mockMeetings) }],
      });

      const client = new GranolaClient('/tmp/test');
      const result = await client.listMeetings();

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('meeting-1');
      expect(result[1]!.title).toBe('Review');
      await client.disconnect();
    });

    it('returns empty array when no content', async () => {
      mockCallTool.mockResolvedValue({ content: [] });

      const client = new GranolaClient('/tmp/test');
      const result = await client.listMeetings();
      expect(result).toEqual([]);
      await client.disconnect();
    });

    it('returns empty array when content has no text entry', async () => {
      mockCallTool.mockResolvedValue({ content: [{ type: 'image', data: 'abc' }] });

      const client = new GranolaClient('/tmp/test');
      const result = await client.listMeetings();
      expect(result).toEqual([]);
      await client.disconnect();
    });

    it('handles response wrapped in meetings key', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ meetings: [{ id: 'm1', title: 'Test' }] }) }],
      });

      const client = new GranolaClient('/tmp/test');
      const result = await client.listMeetings();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('m1');
      await client.disconnect();
    });

    it('filters out invalid meeting objects', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify([
          { id: 'valid', title: 'Good' },
          { noId: true },
          'not an object',
          null,
        ]) }],
      });

      const client = new GranolaClient('/tmp/test');
      const result = await client.listMeetings();
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('valid');
      await client.disconnect();
    });

    it('passes since parameter when provided', async () => {
      mockCallTool.mockResolvedValue({ content: [] });

      const client = new GranolaClient('/tmp/test');
      const since = new Date('2026-03-01T00:00:00Z');
      await client.listMeetings(since);

      expect(mockCallTool).toHaveBeenCalledWith({
        name: 'get_meetings',
        arguments: { since: '2026-03-01T00:00:00.000Z' },
      });
      await client.disconnect();
    });
  });

  describe('getMeetingDetail', () => {
    it('returns meeting detail from MCP response', async () => {
      const detail = {
        id: 'meeting-1',
        title: 'Standup',
        date: '2026-03-01',
        attendees: ['[Owner]'],
        transcript: '[Owner]: Hello',
        summary: 'Quick sync',
      };
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify(detail) }],
      });

      const client = new GranolaClient('/tmp/test');
      const result = await client.getMeetingDetail('meeting-1');
      expect(result).not.toBeNull();
      expect(result!.id).toBe('meeting-1');
      expect(result!.transcript).toBe('[Owner]: Hello');
      await client.disconnect();
    });

    it('returns null when no content returned', async () => {
      mockCallTool.mockResolvedValue({ content: [] });

      const client = new GranolaClient('/tmp/test');
      const result = await client.getMeetingDetail('some-id');
      expect(result).toBeNull();
      await client.disconnect();
    });

    it('returns null for invalid response shape', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify({ noId: true }) }],
      });

      const client = new GranolaClient('/tmp/test');
      const result = await client.getMeetingDetail('some-id');
      expect(result).toBeNull();
      await client.disconnect();
    });
  });

  describe('queryMeetings', () => {
    it('returns matching meetings', async () => {
      mockCallTool.mockResolvedValue({
        content: [{ type: 'text', text: JSON.stringify([{ id: 'q1', title: 'Match' }]) }],
      });

      const client = new GranolaClient('/tmp/test');
      const result = await client.queryMeetings('coaching');
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('q1');
      await client.disconnect();
    });

    it('returns empty array when no results', async () => {
      mockCallTool.mockResolvedValue({ content: [] });

      const client = new GranolaClient('/tmp/test');
      const result = await client.queryMeetings('nonexistent');
      expect(result).toEqual([]);
      await client.disconnect();
    });
  });

  describe('disconnect', () => {
    it('is safe to call multiple times', async () => {
      const client = new GranolaClient('/tmp/test');
      await client.disconnect();
      await client.disconnect(); // Should not throw
    });

    it('calls close on the MCP client', async () => {
      const client = new GranolaClient('/tmp/test');
      // Force client creation by making a call
      mockCallTool.mockResolvedValue({ content: [] });
      await client.listMeetings();
      await client.disconnect();
      expect(mockClose).toHaveBeenCalled();
    });
  });
});

describe('auth token extraction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env['GRANOLA_TOKEN'];
    mockCallTool.mockResolvedValue({ content: [] });
  });

  afterEach(() => {
    delete process.env['GRANOLA_TOKEN'];
  });

  it('prefers GRANOLA_TOKEN env var', async () => {
    process.env['GRANOLA_TOKEN'] = 'env-token';
    const client = new GranolaClient('/tmp/test');
    const result = await client.listMeetings();
    expect(result).toEqual([]);
    await client.disconnect();
  });

  it('falls back to .mcp.json Authorization header', async () => {
    const mcpConfig = {
      mcpServers: {
        granola: {
          headers: {
            Authorization: 'Bearer mcp-json-token',
          },
        },
      },
    };

    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify(mcpConfig));

    const client = new GranolaClient('/tmp/test');
    const result = await client.listMeetings();
    expect(result).toEqual([]);
    await client.disconnect();
  });

  it('falls back to .mcp.json env.GRANOLA_TOKEN', async () => {
    const mcpConfig = {
      mcpServers: {
        granola: {
          env: {
            GRANOLA_TOKEN: 'env-in-mcp-json',
          },
        },
      },
    };

    vi.mocked(readFileSync).mockReturnValueOnce(JSON.stringify(mcpConfig));

    const client = new GranolaClient('/tmp/test');
    const result = await client.listMeetings();
    expect(result).toEqual([]);
    await client.disconnect();
  });

  it('throws when no token found anywhere', async () => {
    vi.mocked(readFileSync).mockImplementationOnce(() => {
      throw new Error('ENOENT');
    });

    const client = new GranolaClient('/tmp/test');
    await expect(client.listMeetings()).rejects.toThrow('GRANOLA_TOKEN not found');
    await client.disconnect();
  });
});
