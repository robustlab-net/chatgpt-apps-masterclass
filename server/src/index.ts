import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import z from 'zod';

const WIDGET_URI = 'ui://flashcards-widget';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const server = new McpServer({
			name: 'Flashcard Server',
			version: '1.0',
		});

		registerAppResource(server, 'Flashcard Widget', WIDGET_URI, { description: 'Flashcard Widget' }, async () => {
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

		// create deck
		registerAppTool(
			server,
			'create-deck',
			{
				title: '덱 만들기',
				description:
					'학습용 플래시카드 덱을 만들 때 사용합니다. 앞면(질문), 뒷면(답), 힌트가 포함된 카드 10~20장을 생성하세요. 이 도구를 쓰기 전에 사용자에게 username을 반드시 요청하세요.',
				inputSchema: {
					username: z.string().describe('사용자 username. 이 도구를 쓰기 전에 먼저 물어보세요.'),
					title: z.string().describe('덱 제목. 예: React 기초'),
					description: z.string().describe('이 덱이 다루는 내용을 짧게 설명하세요.'),
					cards: z
						.array(
							z.object({
								front: z.string().describe('질문 또는 앞면 텍스트'),
								back: z.string().describe('답 또는 뒷면 텍스트'),
								hint: z.string().describe('카드 힌트'),
							}),
						)
						.min(10)
						.max(20)
						.describe('플래시카드 배열 (10~20장, 가능하면 20장 권장)'),
				},
				annotations: {
					readOnlyHint: false,
				},
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ title, description, cards, username }) => {
				const cardsWithIds = cards.map((card, index) => ({
					id: `card-${Date.now()}-${index}`,
					status: 'new',
					...card,
				}));
				const deck = {
					id: `deck-${Date.now()}`,
					title,
					description,
					cards: cardsWithIds,
					createdAt: new Date().toISOString(),
				};

				const decksKey = `user:${username}:decks`;

				await env.FLASHCARDS_KV.put(`user:${username}:deck:${deck.id}`, JSON.stringify(deck));

				const existingIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');

				const deckIds = existingIds || [];

				deckIds.push(deck.id);

				await env.FLASHCARDS_KV.put(decksKey, JSON.stringify(deckIds));

				return {
					content: [
						{
							type: 'text',
							text: `${title} 덱을 만들었습니다. 카드 ${cards.length}장`,
						},
					],
					structuredContent: { deck, username },
				};
			},
		);

		// list decks

		// open deck

		// mark card (private)

		// reset deck (private)

		// delete deck

		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;