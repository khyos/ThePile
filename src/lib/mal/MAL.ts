import { AnimeDB } from "#lib/server/model/anime/AnimeDB";
import { MangaDB } from "#lib/server/model/manga/MangaDB";
import { ErrorUtil } from "#lib/util/ErrorUtil";

export interface MALDateRange {
    from?: string;
    to?: string;
    string?: string;
}

export interface MALAnime {
    malId: number;
    title: string;
    synopsis?: string;
    aired: MALDateRange;
    duration?: string;
    score?: number;
    imageUrl?: string;
    episodes: number;
    genres?: {
        malId: number;
        name: string;
    }[];
}

export interface MALManga {
    malId: number;
    title: string;
    synopsis?: string;
    status?: string;
    published?: MALDateRange;
    endDate?: string;
    volumes?: number;
    chapters?: number;
    score?: number;
    imageUrl?: string;
    genres?: {
        malId: number;
        name: string;
    }[];
    authors?: {
        malId: number;
        name: string;
    }[];
}

export interface MALAnimeEpisode {
    malId: number;
    title: string;
    aired?: string;
}

export class MAL {
    private static readonly JIKAN_BASE_URL = 'https://jikan.lucashdo.com/v1';

    // Since MAL API requires OAuth, we'll use Jikan API (unofficial MAL API) for public access
    static async searchAnime(query: string): Promise<{
        id: number;
        name: string;
        link: string;
        date?: string;
        poster?: string;
    }[]> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/anime?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`MAL search failed: ${response.status}`);
            }
            const data = await response.json();
            return data.data.map((anime: {
                malId: number;
                title: string;
                url: string;
                startDate: string;
                imageUrl: string;
            }) => ({
                id: anime.malId,
                name: anime.title,
                link: anime.url,
                date: anime.startDate,
                poster: anime.imageUrl
            }));
        } catch (error) {
            console.error('MAL search error:', error);
            return [];
        }
    }

    static async getAnime(animeId: string): Promise<MALAnime | null> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/anime/${animeId}/full`);
            if (!response.ok) {
                throw new Error(`MAL get anime failed: ${response.status}`);
            }
            const result = await response.json();
            const anime = result.data;
            const score = Math.round(anime.score * 10);

            return {
                malId: anime.malId,
                title: anime.title,
                synopsis: anime.synopsis,
                episodes: anime.episodes,
                aired: this.normalizeDateRange(anime.aired),
                duration: anime.duration,
                score: score,
                genres: anime.genres,
                imageUrl: anime.imageUrl
            };
        } catch (error) {
            console.error('MAL get anime error:', error);
            return null;
        }
    }

    static async getAnimeEpisodes(animeId: string): Promise<MALAnimeEpisode[]> {
        let page = 1;
        let episodes: MALAnimeEpisode[] = [];
        let hasNextPage = true;

        while (hasNextPage) {
            const pageData = await this.getAnimeEpisodesPage(animeId, page);
            if (pageData && pageData.episodes.length > 0) {
                episodes = episodes.concat(pageData.episodes);
                page++;
                hasNextPage = pageData.has_next_page;
            } else {
                hasNextPage = false;
            }
        }
        return episodes;
    }

    static async getAnimeEpisodesPage(animeId: string, page: number): Promise<{ episodes: MALAnimeEpisode[], has_next_page: boolean } | null> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/anime/${animeId}/episodes?page=${page}`);
            if (!response.ok) {
                if (response.status === 429) {
                    // Handle rate limiting of 3 queries per second, 60 per minutes: wait one second and retry
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    return this.getAnimeEpisodesPage(animeId, page);
                }
                throw new Error(`MAL get anime episodes failed: ${response.status}`);
            }
            const result = await response.json();
            const pagination = result.pagination;
            const episodes = result.data;

            return {
                episodes: episodes,
                has_next_page: pagination.has_next_page
            };
        } catch (error) {
            console.error('MAL get anime episodes error:', error);
            return null;
        }
    }

    static async getUrlFromId(animeId: string): Promise<string> {
        return `https://myanimelist.net/anime/${animeId}`;
    }

    static async getImageURL(animeId: string): Promise<string | null> {
        try {
            const anime = await this.getAnime(animeId);
            return anime?.imageUrl || null;
        } catch (error) {
            console.error('MAL get image error:', error);
            return null;
        }
    }

    static async initGenres(): Promise<void> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/genres/anime`);
            if (!response.ok) {
                throw new Error(`MAL genres failed: ${response.status}`);
            }
            const genres = await response.json();

            for (const genre of genres.data) {
                try {
                    await AnimeDB.addGenreDefinition(genre.malId, genre.name);
                } catch (error) {
                    console.error(ErrorUtil.getErrorMessage(error));
                }
            }
        } catch (error) {
            console.error(ErrorUtil.getErrorMessage(error));
        }
    }

    static parseDuration(durationString: string): number {
        // Parse duration strings like "24 min per ep", "2 hr 3 min", etc.
        if (!durationString) return 0;

        const hourMatch = durationString.match(/(\d+)\s*hr/);
        const minMatch = durationString.match(/(\d+)\s*min/);

        let totalMinutes = 0;
        if (hourMatch) {
            totalMinutes += parseInt(hourMatch[1]) * 60;
        }
        if (minMatch) {
            totalMinutes += parseInt(minMatch[1]);
        }

        return totalMinutes;
    }

    static parsePerEpisodeDuration(durationString?: string | null): number | null {
        if (!durationString) return null;
        // Parse duration strings like "24 min per ep"
        const match = durationString.match(/(\d+)\s*min\s*per\s*ep/);
        if (match) {
            return parseInt(match[1]);
        }
        return null;
    }

    static parseDateRange(dateRange?: string | null): { from?: string; to?: string } {
        if (!dateRange?.trim()) return {};

        const [start, end] = dateRange.trim().split(/\s+to\s+/i, 2);
        return {
            from: this.parseDate(start, false),
            to: end === undefined ? undefined : this.parseDate(end, true)
        };
    }

    private static parseDate(date: string, isEnd: boolean): string | undefined {
        const value = date.trim();
        const yearOnly = value.match(/^(\d{4})$/);
        if (yearOnly) {
            return `${yearOnly[1]}-${isEnd ? "12-31" : "01-01"}`;
        }

        const monthNames = [
            ["Jan", "January"], ["Feb", "February"], ["Mar", "March"], ["Apr", "April"],
            ["May"], ["Jun", "June"], ["Jul", "July"], ["Aug", "August"],
            ["Sep", "September"], ["Oct", "October"], ["Nov", "November"], ["Dec", "December"]
        ];
        const fullDate = value.match(/^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/);
        const monthYear = value.match(/^([A-Za-z]+)\s+(\d{4})$/);
        const match = fullDate ?? monthYear;
        if (!match) return undefined;

        const month = match[1].toLowerCase();
        const monthIndex = monthNames.findIndex(names => names.some(name => name.toLowerCase() === month));
        if (monthIndex < 0) return undefined;

        const monthNumber = String(monthIndex + 1).padStart(2, "0");
        const yearText = match[fullDate ? 3 : 2];
        const year = Number(yearText);
        const isLeapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
        const daysInMonth = [31, isLeapYear ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][monthIndex];
        if (fullDate) {
            const day = Number(match[2]);
            if (day < 1 || day > daysInMonth) return undefined;
            return `${yearText}-${monthNumber}-${String(day).padStart(2, "0")}`;
        }

        return `${yearText}-${monthNumber}-${String(isEnd ? daysInMonth : 1).padStart(2, "0")}`;
    }

    private static normalizeDateRange(range?: MALDateRange | null): MALDateRange {
        if (range?.from && range?.to) return range;

        const parsed = this.parseDateRange(range?.string);
        return {
            ...range,
            from: range?.from ?? parsed.from,
            to: range?.to ?? parsed.to
        };
    }

    static async searchManga(query: string): Promise<{
        id: number;
        name: string;
        link: string;
        date?: string;
        poster?: string;
    }[]> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/manga?q=${encodeURIComponent(query)}`);
            if (!response.ok) {
                throw new Error(`MAL manga search failed: ${response.status}`);
            }
            const data = await response.json();
            return data.data.map((manga: {
                malId: number;
                title: string;
                url: string;
                startDate: string;
                imageUrl: string;
            }) => ({
                id: manga.malId,
                name: manga.title,
                link: manga.url,
                date: manga.startDate,
                poster: manga.imageUrl
            }));
        } catch (error) {
            console.error('MAL manga search error:', error);
            return [];
        }
    }

    static async getManga(mangaId: string): Promise<MALManga | null> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/manga/${mangaId}/full`);
            if (!response.ok) {
                throw new Error(`MAL get manga failed: ${response.status}`);
            }
            const result = await response.json();
            const manga = result.data;
            const score = manga.score ? Math.round(manga.score * 10) : undefined;

            return {
                malId: manga.malId,
                title: manga.title,
                synopsis: manga.synopsis,
                status: manga.status ?? undefined,
                published: manga.published ? this.normalizeDateRange(manga.published) : undefined,
                endDate: manga.endDate ?? undefined,
                volumes: manga.volumes ?? undefined,
                chapters: manga.chapters ?? undefined,
                score: score,
                genres: manga.genres,
                imageUrl: manga.imageUrl ?? undefined,
                authors: manga.authors
            };
        } catch (error) {
            console.error('MAL get manga error:', error);
            return null;
        }
    }

    static async initMangaGenres(): Promise<void> {
        try {
            const response = await fetch(`${this.JIKAN_BASE_URL}/genres/manga`);
            if (!response.ok) {
                throw new Error(`MAL manga genres failed: ${response.status}`);
            }
            const genres = await response.json();

            for (const genre of genres.data) {
                try {
                    await MangaDB.addGenreDefinition(genre.malId, genre.name);
                } catch (error) {
                    console.error(ErrorUtil.getErrorMessage(error));
                }
            }
        } catch (error) {
            console.error(ErrorUtil.getErrorMessage(error));
        }
    }
}