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
		registerAppTool(server, 'create-deck', {
			title: 'Create Deck',
			description:
				'학습용 플래시카드 덱을 만들 때 사용합니다. 앞면(질문), 뒷면(답), 힌트가 포함된 카드 20장을 생성하고, 이 도구를 쓰기 전에 사용자에게 username을 반드시 요청하세요.',
			inputSchema: {
				username: z.string().describe('유저의 username이야, 이툴을 사용하기 전에 이결 요청해'),
				title: z.string().describe('덱의 제목이야, 예: 일본어 20개'),
				description: z.string().describe('덱의 설명이야, 예: 일본어 20개 단어를 학습하기 위한 덱'),
				cards: z.array(
					z.object({
						front: z.string().describe('카드의 앞면이야, 예: 일본어 단어'),
						back: z.string().describe('카드의 뒷면이야, 예: 영어 단어'),
						hint: z.string().describe('카드의 힌트이야, 예: 일본어 단어의 뜻'),
				}),
			).min(10).max(20).describe('카드 목록이야, 예: 일본어 20개 단어를 학습하기 위한 덱'),
			},
			annotations: {
				readOnlyHint: false,
			},
			_meta: {
				ui: {
					resourceUri: WIDGET_URI,
				},
			},
		// list decks
		// open deck
		// mark deck(private)
		// reset deck(private)
		// delete deck(private)
		// Wokers KV 사용
		}, async ({ title, description, cards, username }) => {
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
			await env.FLASHCARDS_KV.put(`user:${username}:deck:${deck.id}`, JSON.stringify(deck));
			return {
				content: `덱이 생성되었어, 제목: ${title}, 설명: ${description}, 카드 수: ${cardsWithIds.length}`,
			};
		},

		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
