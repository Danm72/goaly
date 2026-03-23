// MSW v2 request handlers for Notion API mock.

import { http, HttpResponse } from 'msw';
import {
  databaseResponses,
  blockChildrenResponse,
} from './fixtures.js';

const NOTION_API = 'https://api.notion.com/v1';

// ---------------------------------------------------------------------------
// Default handlers — one page per database, body content for each
// ---------------------------------------------------------------------------

export const handlers = [
  // POST /v1/databases/:id/query — database queries
  http.post(`${NOTION_API}/databases/:id/query`, ({ params }) => {
    const id = params['id'] as string;
    const response = databaseResponses[id];
    if (response) {
      return HttpResponse.json(response);
    }
    return HttpResponse.json(
      { object: 'error', status: 404, code: 'object_not_found', message: `Database ${id} not found` },
      { status: 404 },
    );
  }),

  // GET /v1/blocks/:id/children — block children (page body)
  http.get(`${NOTION_API}/blocks/:id/children`, ({ params }) => {
    const id = params['id'] as string;
    return HttpResponse.json(blockChildrenResponse(id));
  }),

  // GET /v1/pages/:id — page retrieval (for notion-to-md if needed)
  http.get(`${NOTION_API}/pages/:id`, ({ params }) => {
    const id = params['id'] as string;
    // Find the page across all database responses
    for (const resp of Object.values(databaseResponses)) {
      const typed = resp as { results: Array<{ id: string }> };
      const found = typed.results.find((p) => p.id === id);
      if (found) {
        return HttpResponse.json(found);
      }
    }
    return HttpResponse.json(
      { object: 'error', status: 404, code: 'object_not_found', message: `Page ${id} not found` },
      { status: 404 },
    );
  }),
];
