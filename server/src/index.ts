import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import z from 'zod';


const WIDGET_URI = 'ui://flashcards-widget';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		
		const server = new McpServer({
			name: 'Flashcards Server',
			version: '1.0',
		});

		registerAppResource(server, 'Flashcards Widget', WIDGET_URI, { description: 'Flashcards Widget' }, async () => {
			const html = await env.ASSETS.fetch(new URL('http://hello/index.html'));
			return {
				contents: [
					{
						uri: WIDGET_URI,
						text: await html.text(),
						mimeType: RESOURCE_MIME_TYPE,
            _meta: {
              ui: {
                csp: {
									connectDomains: ['https://*.workers.dev'],                  
                  resourceDomains: [
										'https://*.workers.dev',
										'https://fonts.googleapis.com',
										'https://fonts.gstatic.com',
										'https://image.tmdb.org',
									],
                },
              },
            },
					},
				],
			};
		});

		await env.FLASHCARDS_KV.put('hello', 'world');

		// create deck, 예: 나는 일본어를 배우고 싶으니까, 20개 단어를 줘
		// list decks
		// open deck
		// mark deck(private)
		// reset deck(private)
		// delete deck(private)
		// Wokers KV 사용


		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
