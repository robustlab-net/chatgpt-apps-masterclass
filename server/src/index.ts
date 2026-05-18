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

/** bukoi, Bukoi, BUKOI → Bukoi */
function normalizeUsername(username: string): string {
	const trimmed = username.trim();
	if (!trimmed) return trimmed;
	return trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase();
}

function userDecksKey(username: string): string {
	return `user:${normalizeUsername(username)}:decks`;
}

function userDeckKey(username: string, deckId: string): string {
	return `user:${normalizeUsername(username)}:deck:${deckId}`;
}

/** 이전 소문자 키(user:bukoi:...) 데이터 호환 */
function legacyUserDecksKey(username: string): string {
	return `user:${username.trim().toLowerCase()}:decks`;
}

function legacyUserDeckKey(username: string, deckId: string): string {
	return `user:${username.trim().toLowerCase()}:deck:${deckId}`;
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
					username: z
						.string()
						.describe(
							"사용자명. 'bukoi', 'Bukoi'처럼 입력해도 같은 사용자입니다. 도구를 사용하기 전에 먼저 물어보세요.",
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
				const normalizedUsername = normalizeUsername(username);
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

				const decksKey = userDecksKey(normalizedUsername);

				await env.FLASHCARDS_KV.put(userDeckKey(normalizedUsername, deck.id), JSON.stringify(deck));

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
					structuredContent: { deck, username: normalizedUsername },
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
					"사용자의 플래시카드 덱 목록을 보여줍니다. 사용자명을 모르면 이 도구를 쓰기 전에 먼저 물어보세요. 'bukoi', 'Bukoi'처럼 입력해도 같은 사용자입니다.",
				inputSchema: {
					username: z
						.string()
						.describe("사용자명. 'bukoi', 'Bukoi'처럼 입력해도 같은 사용자입니다. 모르면 사용 전에 먼저 물어보세요."),
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
				const normalizedUsername = normalizeUsername(username);
				const decksKey = userDecksKey(normalizedUsername);

				let deckIds = await env.FLASHCARDS_KV.get<string[]>(decksKey, 'json');
				const legacyDecksKey = legacyUserDecksKey(username);

				if ((!deckIds || deckIds.length === 0) && legacyDecksKey !== decksKey) {
					deckIds = await env.FLASHCARDS_KV.get<string[]>(legacyDecksKey, 'json');
				}

				if (!deckIds || deckIds.length === 0) {
					return {
						content: [{ text: 'You have no decks', type: 'text' }],
						structuredContent: { decks: [], username: normalizedUsername },
					};
				}

				const decks = [];

				for (const deckId of deckIds) {
					let deck = await env.FLASHCARDS_KV.get<Deck>(userDeckKey(normalizedUsername, deckId), 'json');
					if (!deck && legacyDecksKey !== decksKey) {
						deck = await env.FLASHCARDS_KV.get<Deck>(legacyUserDeckKey(username, deckId), 'json');
						if (deck) {
							await env.FLASHCARDS_KV.put(userDeckKey(normalizedUsername, deckId), JSON.stringify(deck));
						}
					}
					if (deck) {
						const masteredCount = deck.cards.filter((card) => card.status === 'mastered').length;
						decks.push({ masteredCount, ...deck });
					}
				}

				if (legacyDecksKey !== decksKey) {
					await env.FLASHCARDS_KV.put(decksKey, JSON.stringify(deckIds));
				}

				return {
					content: [
						{
							type: 'text',
							text: `Found a total of  ${decks.length} ${JSON.stringify(decks)}`,
						},
					],
					structuredContent: { decks, username: normalizedUsername },
				};
			},
		);

		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
