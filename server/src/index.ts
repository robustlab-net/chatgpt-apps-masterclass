import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import z from 'zod';

const WIDGET_URI = 'ui://flashcards-widget';

const cardSchema = z.object({
	front: z.string().describe('The question or prompt'),
	back: z.string().describe('The answer'),
	hint: z.string().describe('A hint for the card'),
	status: z.enum(['new', 'learning', 'mastered']).readonly().default('new'),
});

const deckSchema = z.object({
	title: z.string().describe("The title of the deck. e.g 'React Fundamentals'"),
	description: z.string().describe('Brief description of what this deck covers.'),
	cards: z.array(cardSchema).min(10).max(20).describe('Array of flashcards (aim for 20.'),
});

type Deck = z.infer<typeof deckSchema>;
type Card = z.infer<typeof cardSchema>;

const usernameSchema = z
	.string()
	.transform((value) => value.trim().toLowerCase());

function userDecksKey(username: string): string {
	return `user:${username}:decks`;
}

function userDeckKey(username: string, deckId: string): string {
	return `user:${username}:deck:${deckId}`;
}

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

		await env.FLASHCARDS_KV.put('hello', 'world');

		// TODO: registerAppTool — flashcard 도구들

		// create deck
		registerAppTool(
			server,
			'create-deck',
			{
				title: 'Create Deck',
				description:
					'학습용 플래시카드 덱을 만듭니다. 앞면(질문), 뒷면(답), 힌트가 있는 카드 20장을 생성하세요. 이 도구를 사용하기 전에 사용자에게 사용자명을 먼저 물어보세요.',
				inputSchema: {
					username: usernameSchema.describe(
						"사용자명. 'zaxrok', 'Zaxrok'처럼 입력해도 소문자 zaxrok으로 저장됩니다. 도구를 사용하기 전에 먼저 물어보세요.",
					),
					title: z.string().describe("덱 제목. 예: 'React 기초'"),
					description: z.string().describe('이 덱이 다루는 내용에 대한 간단한 설명.'),
					cards: z
						.array(
							z.object({
								front: z.string().describe('질문 또는 앞면 내용'),
								back: z.string().describe('답 또는 뒷면 내용'),
								hint: z.string().describe('카드 힌트'),
							}),
						)
						.min(10)
						.max(20)
						.describe('플래시카드 배열 (20장 권장).'),
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

				const decksKey = userDecksKey(username);

				await env.FLASHCARDS_KV.put(userDeckKey(username, deck.id), JSON.stringify(deck));

				const existingIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');

				const deckIds = existingIds || [];

				deckIds.push(deck.id);

				await env.FLASHCARDS_KV.put(decksKey, JSON.stringify(deckIds));

				return {
					content: [
						{
							type: 'text',
							text: `Created a ${title} deck with ${cards.length} flashcards`,
						},
					],
					structuredContent: { deck, username },
				};
			},
		);

		// list decks
		registerAppTool(
			server,
			'list-decks',
			{
				title: 'List Decks',
				description:
					"사용자의 플래시카드 덱 목록을 보여줍니다. 사용자명을 모르면 이 도구를 쓰기 전에 먼저 물어보세요. 'zaxrok', 'Zaxrok'처럼 입력해도 소문자 zaxrok으로 조회합니다.",
				inputSchema: {
					username: usernameSchema.describe(
						"사용자명. 'zaxrok', 'Zaxrok'처럼 입력해도 소문자 zaxrok으로 조회합니다. 모르면 사용 전에 먼저 물어보세요.",
					),
				},
				annotations: {
					readOnlyHint: true,
				},
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ username }) => {
				const decksKey = userDecksKey(username);

				const deckIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');

				if (!deckIds || deckIds.length === 0) {
					return {
						content: [{ text: 'You have no decks', type: 'text' }],
						structuredContent: { decks: [], username },
					};
				}

				const decks = [];

				for (const deckId of deckIds) {
					const deck = await env.FLASHCARDS_KV.get<Deck>(userDeckKey(username, deckId), 'json');
					if (deck) {
						const masteredCount = deck.cards.filter((card) => card.status === 'mastered').length;
						decks.push({ masteredCount, ...deck });
					}
				}

				return {
					content: [
						{
							type: 'text',
							text: `Found a total of  ${decks.length} ${JSON.stringify(decks)}`,
						},
					],
					structuredContent: { decks, username },
				};
			},
		);

		// open deck
		registerAppTool(
			server,
			'open-deck',
			{
				title: 'Open Deck',
				description:
					'사용자가 덱을 학습할 수 있도록 덱을 엽니다. 사용자명과 deck id가 필요합니다. 사용자명을 모르면 사용 전에 먼저 물어보세요. deck id는 list-decks로 확인할 수 있습니다.',
				inputSchema: {
					username: usernameSchema.describe(
						"사용자명. 'zaxrok', 'Zaxrok'처럼 입력해도 소문자 zaxrok으로 조회합니다. 모르면 사용 전에 먼저 물어보세요.",
					),
					deckId: z.string().describe('덱 ID. list-decks 도구로 확인할 수 있습니다.'),
				},
				annotations: {
					readOnlyHint: true,
				},
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
				},
			},
			async ({ username, deckId }) => {
				const deck = await env.FLASHCARDS_KV.get<Deck>(userDeckKey(username, deckId), 'json');

				if (!deck) {
					return {
						content: [{ text: 'Deck not found', type: 'text' }],
						structuredContent: { deck: null, username, deckId },
					};
				}

				return {
					content: [
						{
							type: 'text',
							text: `Opened "${deck.title}" (${deck.cards.length} cards)`,
						},
					],
					structuredContent: { deck, username, deckId },
				};
			},
		);

		// mark card (private)
		registerAppTool(
			server,
			'mark-card',
			{
				title: 'Mark Card',
				description: 'This is to change the status of a card.',
				inputSchema: {
					username: z.string(),
					deckId: z.string(),
					status: z.enum(['learning', 'mastered']),
					cardId: z.string(),
				},
				annotations: {
					readOnlyHint: false,
				},
				_meta: {
					ui: {
						visibility: ['app'],
					},
				},
			},
			async ({ username, deckId, cardId, status }) => {
				const deckKey = userDeckKey(username, deckId);

				const deck = await env.FLASHCARDS_KV.get<Deck>(deckKey, 'json');

				if (!deck) {
					return {
						content: [{ text: 'Error not found', type: 'text' }],
						isError: true,
					};
				}

				const card = (deck.cards as (Card & { id: string })[]).find((c) => c.id === cardId);

				if (card) {
					card.status = status;
				}

				await env.FLASHCARDS_KV.put(deckKey, JSON.stringify(deck));

				return {
					content: [
						{
							type: 'text',
							text: `Card ${cardId} has been updated to ${status} status.`,
						},
					],
					structuredContent: { deck },
				};
			},
		);

		// reset deck (private)
		registerAppTool(
			server,
			'reset-deck',
			{
				title: 'Reset Deck',
				description: 'This is to reset the progress of the deck.',
				inputSchema: {
					username: z.string(),
					deckId: z.string(),
				},
				annotations: {
					destructiveHint: true,
				},
				_meta: {
					ui: {
						visibility: ['app'],
					},
				},
			},
			async ({ username, deckId }) => {
				const deckKey = userDeckKey(username, deckId);

				const deck = await env.FLASHCARDS_KV.get<Deck>(deckKey, 'json');

				if (!deck) {
					return {
						content: [{ text: 'Error not found', type: 'text' }],
						isError: true,
					};
				}
				for (const card of deck.cards) {
					card.status = 'new';
				}

				await env.FLASHCARDS_KV.put(deckKey, JSON.stringify(deck));

				return {
					content: [
						{
							type: 'text',
							text: `Deck progress has been reset.`,
						},
					],
					structuredContent: { deck },
				};
			},
		);

		// delete deck
		registerAppTool(
			server,
			'delete-deck',
			{
				title: 'Delete Deck',
				description:
					'덱을 삭제합니다. 사용자명과 deck id가 필요합니다. 사용자명을 모르면 사용 전에 먼저 물어보세요. deck id는 list-decks로 확인할 수 있습니다.',
				inputSchema: {
					username: usernameSchema.describe(
						"사용자명. 'zaxrok', 'Zaxrok'처럼 입력해도 소문자 zaxrok으로 조회합니다. 모르면 사용 전에 먼저 물어보세요.",
					),
					deckId: z.string().describe('삭제할 덱 ID. list-decks 도구로 확인할 수 있습니다.'),
				},
				annotations: {
					destructiveHint: true,
				},
				_meta: {},
			},
			async ({ username, deckId }) => {
				const deckKey = userDeckKey(username, deckId);

				const deck = await env.FLASHCARDS_KV.get<Deck>(deckKey, 'json');

				if (!deck) {
					return {
						content: [{ text: 'Deck not found', type: 'text' }],
					};
				}

				await env.FLASHCARDS_KV.delete(deckKey);

				const decksKey = userDecksKey(username);
				const deckIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');
				if (deckIds) {
					await env.FLASHCARDS_KV.put(
						decksKey,
						JSON.stringify(deckIds.filter((id) => id !== deckId)),
					);
				}

				return {
					content: [
						{
							type: 'text',
							text: `Deleted "${deck.title}"`,
						},
					],
				};
			},
		);


		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
