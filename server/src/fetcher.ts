type TMDBParamValue = string | number | boolean | undefined;

type FindMoviesOptions = {
	keyword?: string;
	language?: string;
	originalLanguage?: string;
	region?: string;
	sortBy?: string;
	primaryReleaseDateGte?: string;
	primaryReleaseDateLte?: string;
	releaseDateGte?: string;
	releaseDateLte?: string;
	withGenres?: string;
	withoutGenres?: string;
	withCompanies?: string;
	withCast?: string;
	withCrew?: string;
	withPeople?: string;
	withRuntimeGte?: number;
	withRuntimeLte?: number;
	voteAverageGte?: number;
	voteAverageLte?: number;
	voteCountGte?: number;
	voteCountLte?: number;
	includeAdult?: boolean;
	page?: number;
	additionalFilters?: Record<string, string>;
};

type KeywordSearchResult = {
	id: number;
	name: string;
};

async function fetchFromTMDB(endpoint: string, apiKey: string, params: Record<string, TMDBParamValue> = {}) {
	const searchParams = new URLSearchParams({
		page: '1',
		include_adult: 'false',
		language: 'en',
	});
	for (const [key, value] of Object.entries(params)) {
		if (value !== undefined) {
			searchParams.set(key, String(value));
		}
	}
	const response = await fetch(`https://api.themoviedb.org/3${endpoint}?${searchParams}`, {
		headers: {
			Authorization: `Bearer ${apiKey}`,
		},
	});

	if (!response.ok) {
		throw new Error('Could not fetch from API');
	}

	return response.json();
}

async function fetchKeywordIds(keyword: string, apiKey: string, language: string) {
	const response = (await fetchFromTMDB('/search/keyword', apiKey, {
		query: keyword,
		language,
	})) as { results?: KeywordSearchResult[] };

	return response.results?.map((result) => result.id) ?? [];
}

export async function fetchUpcomingMovies(apiKey: string) {
	return fetchFromTMDB(`/movie/upcoming`, apiKey);
}
export async function fetchNowPlayingMovies(apiKey: string) {
	return fetchFromTMDB(`/movie/now_playing`, apiKey);
}
export async function fetchSimilarMovies(movieId: number, apiKey: string) {
	return fetchFromTMDB(`/movie/${movieId}/similar`, apiKey);
}
export async function fetchMovieReviews(movieId: number, apiKey: string) {
	return fetchFromTMDB(`/movie/${movieId}/reviews`, apiKey);
}
export async function fetchMovieGenres(apiKey: string) {
	return fetchFromTMDB(`/genre/movie/list`, apiKey);
}
export async function fetchMovieByGenre(genreId: number, apiKey: string) {
	return fetchFromTMDB(`/discover/movie`, apiKey, {
		with_genres: String(genreId),
		sort_by: 'popularity.desc',
	});
}

export async function findMovies(options: FindMoviesOptions, apiKey: string) {
	const language = options.language ?? 'en';
	const params: Record<string, TMDBParamValue> = {
		language,
		page: options.page,
		include_adult: options.includeAdult ?? false,
		region: options.region,
		sort_by: options.sortBy ?? 'popularity.desc',
		'primary_release_date.gte': options.primaryReleaseDateGte,
		'primary_release_date.lte': options.primaryReleaseDateLte,
		'release_date.gte': options.releaseDateGte,
		'release_date.lte': options.releaseDateLte,
		with_original_language: options.originalLanguage,
		with_genres: options.withGenres,
		without_genres: options.withoutGenres,
		with_companies: options.withCompanies,
		with_cast: options.withCast,
		with_crew: options.withCrew,
		with_people: options.withPeople,
		'with_runtime.gte': options.withRuntimeGte,
		'with_runtime.lte': options.withRuntimeLte,
		'vote_average.gte': options.voteAverageGte,
		'vote_average.lte': options.voteAverageLte,
		'vote_count.gte': options.voteCountGte,
		'vote_count.lte': options.voteCountLte,
		...options.additionalFilters,
	};

	if (options.keyword) {
		const keywordIds = await fetchKeywordIds(options.keyword, apiKey, language);
		if (keywordIds.length === 0) {
			return {
				page: 1,
				results: [],
				total_pages: 0,
				total_results: 0,
			};
		}
		params.with_keywords = keywordIds.join('|');
	}

	return fetchFromTMDB('/discover/movie', apiKey, params);
}

export async function fetchMovieDetails(movieId: number, apiKey: string) {
	return fetchFromTMDB(`/movie/${movieId}`, apiKey);
}
