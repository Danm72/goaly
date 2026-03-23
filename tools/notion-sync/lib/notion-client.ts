import { Client } from "@notionhq/client";
import { isFullPage } from "@notionhq/client";
import type {
  PageObjectResponse,
  QueryDatabaseResponse,
  GetPageResponse,
  ListBlockChildrenResponse,
  UpdatePageResponse,
  CreatePageResponse,
  AppendBlockChildrenResponse,
  DeleteBlockResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
import PQueue from "p-queue";

// --- Lazy client initialization ---
// Token check is deferred until first API call so that test setup files
// can set process.env.NOTION_TOKEN before the check runs.

let _client: Client | undefined;

function getClient(): Client {
  if (!_client) {
    const token = process.env["NOTION_TOKEN"];
    if (!token) {
      throw new Error(
        "NOTION_TOKEN environment variable is required. Get your token at https://www.notion.so/my-integrations"
      );
    }
    _client = new Client({ auth: token });
  }
  return _client;
}

// Exported for notion-to-md constructor (needs raw client instance)
export function getRawClient(): Client {
  return getClient();
}

// --- Rate-limiting queue ---

const queue = new PQueue({
  concurrency: 3,
  intervalCap: 3,
  interval: 1000,
});

async function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  return queue.add(fn, { throwOnTimeout: true }) as Promise<T>;
}

// --- Wrapped API methods ---

export async function queryDatabase(
  databaseId: string,
  filter?: object,
  startCursor?: string
): Promise<QueryDatabaseResponse> {
  return enqueue(() =>
    getClient().databases.query({
      database_id: databaseId,
      ...(filter ? { filter } : {}),
      ...(startCursor ? { start_cursor: startCursor } : {}),
    } as Parameters<Client["databases"]["query"]>[0])
  );
}

export async function getPage(pageId: string): Promise<GetPageResponse> {
  return enqueue(() => getClient().pages.retrieve({ page_id: pageId }));
}

export async function getBlockChildren(
  blockId: string,
  startCursor?: string
): Promise<ListBlockChildrenResponse> {
  return enqueue(() =>
    getClient().blocks.children.list({
      block_id: blockId,
      ...(startCursor ? { start_cursor: startCursor } : {}),
    })
  );
}

export async function updatePage(
  pageId: string,
  properties: object
): Promise<UpdatePageResponse> {
  return enqueue(() =>
    getClient().pages.update({
      page_id: pageId,
      properties,
    } as Parameters<Client["pages"]["update"]>[0])
  );
}

export async function createPage(
  parent: object,
  properties: object,
  children?: object[]
): Promise<CreatePageResponse> {
  return enqueue(() =>
    getClient().pages.create({
      parent,
      properties,
      ...(children ? { children } : {}),
    } as Parameters<Client["pages"]["create"]>[0])
  );
}

export async function appendBlockChildren(
  blockId: string,
  children: object[]
): Promise<AppendBlockChildrenResponse> {
  return enqueue(() =>
    getClient().blocks.children.append({
      block_id: blockId,
      children,
    } as Parameters<Client["blocks"]["children"]["append"]>[0])
  );
}

export async function deleteBlock(
  blockId: string
): Promise<DeleteBlockResponse> {
  return enqueue(() => getClient().blocks.delete({ block_id: blockId }));
}

export async function archivePage(
  pageId: string
): Promise<UpdatePageResponse> {
  return enqueue(() =>
    getClient().pages.update({
      page_id: pageId,
      archived: true,
    } as Parameters<Client["pages"]["update"]>[0])
  );
}

// --- Pagination helper ---

export async function queryAllPages(
  databaseId: string,
  filter?: object
): Promise<PageObjectResponse[]> {
  const pages: PageObjectResponse[] = [];
  let cursor: string | undefined;

  do {
    const response = await queryDatabase(databaseId, filter, cursor);
    for (const result of response.results) {
      if (isFullPage(result) && !result.archived) {
        pages.push(result);
      }
    }
    cursor = response.has_more && response.next_cursor
      ? response.next_cursor
      : undefined;
  } while (cursor);

  return pages;
}

// --- Queue stats ---

export function getQueueStats(): {
  size: number;
  pending: number;
  isPaused: boolean;
} {
  return {
    size: queue.size,
    pending: queue.pending,
    isPaused: queue.isPaused,
  };
}

// --- Type re-exports ---

export type {
  PageObjectResponse,
  QueryDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints.js";
export { isFullPage } from "@notionhq/client";
