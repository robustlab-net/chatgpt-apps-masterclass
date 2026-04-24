import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from '@modelcontextprotocol/ext-apps/server';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { createMcpHandler } from 'agents/mcp';
import z from 'zod';
import {
	fetchMovieByGenre,
	fetchMovieDetails,
	fetchMovieGenres,
	fetchMovieReviews,
	fetchNowPlayingMovies,
	fetchSimilarMovies,
	fetchUpcomingMovies,
	findMovies,
} from './fetcher';

const WIDGET_URI = 'ui://movies-widget';

export default {
	async fetch(request, env, ctx): Promise<Response> {
		const API_KEY = env.API_KEY;
		if (!API_KEY) {
			throw new Error('API_KEY environment variable is not set');
		}
		const server = new McpServer({
			name: 'Movies Server',
			version: '1.0',
		});

		registerAppResource(server, 'Movies Widget', WIDGET_URI, { description: 'Movies Widget' }, async () => {
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

		registerAppTool(
			server,
			'get-upcoming-movies',
			{
				title: 'Get Upcoming Movies',
				description:
					'Use this when the user wants to see the movies that are going to be released soon or in the future. Do not use this for movies that are currently playing in theaters or available for streaming.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching upcoming movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				const movies = await fetchUpcomingMovies(API_KEY);
				return {
					content: [{ text: JSON.stringify(JSON.stringify(movies)), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-now-playing-movies',
			{
				title: 'Get Now Playing Movies',
				description:
					'Use this when the user wants to see the movies that are playing right now. Do not use this for streaming movies or to check the availability of upcoming releases. Do not use this to find a specific movie.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching now playing movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				const movies = await fetchNowPlayingMovies(API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-similar-movies',
			{
				title: 'Get Similar Movies',
				description:
					'Use this when the user wants to find similar movies to a specific movie. Requires a movie ID from a previous list. Do not use before identifying a specific movie.',
				inputSchema: {
					movieId: z
						.number()
						.positive()
						.describe(
							'The ID of the movie to find similar movies for. Obtained by calling other tools first like `get-upcoming-movies` or `get-now-playing-movies`.',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching similar movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				const movies = await fetchSimilarMovies(movieId, API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-reviews',
			{
				title: 'Get Movie Reviews',
				description:
					'Use this when the user wants to find reviews about a specific movie. Requires a movie ID from a previous list. Do not use before identifying a specific movie.',
				inputSchema: {
					movieId: z
						.number()
						.positive()
						.describe(
							'The ID of the movie to find reviews for. Obtained by calling other tools first like `get-upcoming-movies` or `get-now-playing-movies`.',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					'openai/toolInvocation/invoking': 'Fetching reviews...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				const reviews = await fetchMovieReviews(movieId, API_KEY);
				return {
					content: [{ text: JSON.stringify(reviews), type: 'text' }],
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-genres',
			{
				title: 'Get Movie Genres',
				description:
					'Use this to get the list of genres ID. This should be used before calling the `get-movies-by-genre` tool. Do not use this to search for movies directly.',
				inputSchema: {},
				annotations: { readOnlyHint: true },
				_meta: {
					'openai/toolInvocation/invoking': 'Fetching genres...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async () => {
				const genres = await fetchMovieGenres(API_KEY);
				return {
					content: [{ text: JSON.stringify(genres), type: 'text' }],
				};
			},
		);

		registerAppTool(
			server,
			'get-movies-by-genre',
			{
				title: 'Get Movies by Genre',
				description:
					'Use this when the user wants to find movies by a specific genre. Use `get-movie-genres` first to get the list of genre IDs first.',
				inputSchema: {
					genreId: z
						.number()
						.positive()
						.describe(
							'The ID of the genre to find movies for. Obtained by calling `get-movie-genres` tool. (example: 28 for Action, 99 for documentary)',
						),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ genreId }) => {
				const movies = await fetchMovieByGenre(genreId, API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'find-movies',
			{
				title: 'Find Movies',
				description:
					'Use this when the user wants to find movies with TMDB discover filters and sort options, including release dates, original language, keywords, genres, companies, cast, crew, runtime, votes, and popularity. For example: find Korean-language movies released after 2025 with keyword "Parasite".',
				inputSchema: {
					keyword: z
						.string()
						.optional()
						.describe('Keyword text to search in TMDB keywords before applying discover movie with_keywords. Example: "기생충".'),
					language: z
						.string()
						.optional()
						.describe('Response language for TMDB, such as "ko-KR" or "en-US". Defaults to "en".'),
					originalLanguage: z
						.string()
						.optional()
						.describe('Original language filter. Use ISO 639-1 codes such as "ko" for Korean. Maps to with_original_language.'),
					region: z.string().optional().describe('Region filter such as "KR" or "US".'),
					sortBy: z
						.enum([
							'popularity.asc',
							'popularity.desc',
							'revenue.asc',
							'revenue.desc',
							'primary_release_date.asc',
							'primary_release_date.desc',
							'vote_average.asc',
							'vote_average.desc',
							'vote_count.asc',
							'vote_count.desc',
						])
						.optional()
						.describe('TMDB discover movie sort_by value. Defaults to popularity.desc.'),
					primaryReleaseDateGte: z
						.string()
						.optional()
						.describe('Minimum primary release date in YYYY-MM-DD format. Example: "2025-01-01".'),
					primaryReleaseDateLte: z.string().optional().describe('Maximum primary release date in YYYY-MM-DD format.'),
					releaseDateGte: z.string().optional().describe('Minimum release date in YYYY-MM-DD format.'),
					releaseDateLte: z.string().optional().describe('Maximum release date in YYYY-MM-DD format.'),
					withGenres: z.string().optional().describe('Comma or pipe separated genre IDs. Maps to with_genres.'),
					withoutGenres: z.string().optional().describe('Comma or pipe separated genre IDs to exclude. Maps to without_genres.'),
					withCompanies: z.string().optional().describe('Comma or pipe separated company IDs. Maps to with_companies.'),
					withCast: z.string().optional().describe('Comma or pipe separated person IDs for cast. Maps to with_cast.'),
					withCrew: z.string().optional().describe('Comma or pipe separated person IDs for crew. Maps to with_crew.'),
					withPeople: z.string().optional().describe('Comma or pipe separated person IDs for cast or crew. Maps to with_people.'),
					withRuntimeGte: z.number().positive().optional().describe('Minimum runtime in minutes.'),
					withRuntimeLte: z.number().positive().optional().describe('Maximum runtime in minutes.'),
					voteAverageGte: z.number().min(0).max(10).optional().describe('Minimum vote average.'),
					voteAverageLte: z.number().min(0).max(10).optional().describe('Maximum vote average.'),
					voteCountGte: z.number().nonnegative().optional().describe('Minimum vote count.'),
					voteCountLte: z.number().nonnegative().optional().describe('Maximum vote count.'),
					includeAdult: z.boolean().optional().describe('Whether to include adult movies. Defaults to false.'),
					page: z.number().int().positive().optional().describe('TMDB page number. Defaults to 1.'),
					additionalFilters: z
						.record(z.string(), z.string())
						.optional()
						.describe('Advanced TMDB discover movie filters not listed above, using exact TMDB parameter names.'),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Finding movies...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async (options) => {
				const movies = await findMovies(options, API_KEY);
				return {
					content: [{ text: JSON.stringify(movies), type: 'text' }],
					structuredContent: { movies },
				};
			},
		);

		registerAppTool(
			server,
			'get-movie-details',
			{
				title: 'Get Movie Details',
				description:
					'Use this when the user wants to see more details about a specific movie. Details like synopsis, cast, and production companies are available here. Requires a movie ID from a previous list. Do not use this tool before identifying the movie.',
				inputSchema: {
					movieId: z.number().positive().describe('The ID of the movie to find details for. Obtained by any of the list movie tools'),
				},
				annotations: { readOnlyHint: true },
				_meta: {
					ui: {
						resourceUri: WIDGET_URI,
					},
					'openai/toolInvocation/invoking': 'Fetching movie details...',
					'openai/toolInvocation/invoked': 'Done.',
				},
			},
			async ({ movieId }) => {
				const movie = await fetchMovieDetails(movieId, API_KEY);
				return {
					content: [{ text: 'stuff', type: 'text' }],
					structuredContent: { movie },
				};
			},
		);

		// @ts-ignore
		const handler = createMcpHandler(server);

		return handler(request, env, ctx);
	},
} satisfies ExportedHandler<Env>;
