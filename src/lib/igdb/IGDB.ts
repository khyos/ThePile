import { IGDB_CLIENT_ID, IGDB_CLIENT_SECRET } from "$app/env/private";
import { GameDB } from "#lib/server/model/game/GameDB";
import { PlatformDB } from "#lib/server/model/game/PlatformDB";

export type IGDBSearchGameResult = {
    id: number
    name: string
    url: string
    first_release_date?: number
    date?: string
}

export type IGDBReleaseDate = {
    id: number
    date?: number
    platform?: number
    status?: number
}

export type IGDBGame = {
    alternative_names: number[]
    cover: number
    first_release_date: number
    genres: number[]
    id: number
    name: string
    platforms: number[]
    release_dates?: IGDBReleaseDate[]
    status?: number
    storyline: string
    summary: string
    url: string
}

// IGDB games.status enum
export const IGDB_STATUS: Record<number, string> = {
    0: 'released',
    2: 'alpha',
    3: 'beta',
    4: 'early_access',
    5: 'offline',
    6: 'cancelled',
    7: 'rumored',
    8: 'delisted'
};

// IGDB release_date_statuses IDs
export const IGDB_RELEASE_DATE_STATUS: Record<number, string> = {
    1: 'alpha',
    2: 'beta',
    3: 'early_access',
    4: 'offline',
    5: 'cancelled',
    6: 'rumored',
    7: 'delisted'
};

type IGDBToken = {
    access_token: string;
    refreshAt: number;
};

let cachedToken: IGDBToken | null = null;
let authenticationRequest: Promise<{ access_token: string }> | null = null;
let igdbRequestQueue: Promise<void> = Promise.resolve();
let nextIGDBRequestAt = 0;

const wait = (milliseconds: number) => new Promise(resolve => setTimeout(resolve, milliseconds));

async function fetchIGDB(url: string, init: RequestInit): Promise<Response> {
    let releaseTurn!: () => void;
    const previousTurn = igdbRequestQueue;
    igdbRequestQueue = new Promise<void>(resolve => {
        releaseTurn = resolve;
    });

    await previousTurn;
    try {
        const delay = Math.max(0, nextIGDBRequestAt - Date.now());
        if (delay > 0) {
            await wait(delay);
        }
        nextIGDBRequestAt = Date.now() + 300;
    } finally {
        releaseTurn();
    }

    return fetch(url, init);
}

function retryDelay(response: Response, attempt: number): number {
    const retryAfter = response.headers.get('retry-after');
    const retryAfterSeconds = retryAfter === null ? Number.NaN : Number(retryAfter);
    if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
        return Math.max(250 * (2 ** attempt), retryAfterSeconds * 1000);
    }

    const retryAfterDate = retryAfter === null ? Number.NaN : Date.parse(retryAfter);
    if (Number.isFinite(retryAfterDate)) {
        return Math.max(250 * (2 ** attempt), retryAfterDate - Date.now());
    }

    return 250 * (2 ** attempt);
}

export class IGDB {
    static async authenticateIGDB(): Promise<{ access_token: string }> {
        if (cachedToken && cachedToken.refreshAt > Date.now()) {
            return { access_token: cachedToken.access_token };
        }
        if (authenticationRequest) {
            return authenticationRequest;
        }

        const request = (async () => {
            const response = await fetch("https://id.twitch.tv/oauth2/token", {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: `client_id=${IGDB_CLIENT_ID}&client_secret=${IGDB_CLIENT_SECRET}&grant_type=client_credentials`
            });
            if (!response.ok) {
                throw new Error(`IGDB authentication failed: ${response.status}`);
            }

            const token = await response.json() as { access_token?: unknown; expires_in?: unknown };
            if (typeof token.access_token !== 'string' || token.access_token.length === 0
                || typeof token.expires_in !== 'number' || !Number.isFinite(token.expires_in) || token.expires_in <= 0) {
                throw new Error('IGDB authentication returned an invalid token');
            }

            const expiresInMilliseconds = token.expires_in * 1000;
            cachedToken = {
                access_token: token.access_token,
                refreshAt: Date.now() + expiresInMilliseconds - Math.min(60_000, expiresInMilliseconds * 0.1)
            };
            return { access_token: token.access_token };
        })();
        authenticationRequest = request;

        try {
            return await request;
        } finally {
            if (authenticationRequest === request) {
                authenticationRequest = null;
            }
        }
    }

    private static clearCachedToken(accessToken: string) {
        if (cachedToken?.access_token === accessToken) {
            cachedToken = null;
        }
    }

    static getHeaders(access_token: string) {
        return {
            'Accept': 'application/json',
            'Client-ID': IGDB_CLIENT_ID,
            'Authorization': `Bearer ${access_token}`
        };
    }

    static async getGame(gameId: string): Promise<IGDBGame> {
        const { access_token } = await this.authenticateIGDB();
        const response = await fetchIGDB("https://api.igdb.com/v4/games", {
            method: 'POST',
            headers: IGDB.getHeaders(access_token),
            body: `fields alternative_names,category,cover,first_release_date,genres,name,platforms,release_dates.date,release_dates.platform,release_dates.status,status,storyline,summary,url; where id = ${gameId};`
        });
        return (await response.json())[0];
    }

    static async searchGame(query: string): Promise<IGDBSearchGameResult[]> {
        const { access_token } = await this.authenticateIGDB();
        const response = await fetchIGDB("https://api.igdb.com/v4/games", {
            method: 'POST',
            headers: IGDB.getHeaders(access_token),
            body: `fields name,url,first_release_date; search "${query}";`
        });
        const jsonReponse: IGDBSearchGameResult[] = await response.json();
        jsonReponse.forEach((game) => {
            if (game.first_release_date) {
                game.date = new Date(game.first_release_date * 1000).getFullYear().toString();
            }
        });
        return jsonReponse;
    }

    static async getUrlFromId(gameId: string): Promise<string> {
        const game = await this.getGame(gameId);
        return game.url;
    }

    static async getImageURL(gameId: string) {
        let token = await this.authenticateIGDB();
        let refreshedToken = false;
        let transientRetries = 0;

        while (true) {
            let response: Response;
            try {
                response = await fetchIGDB("https://api.igdb.com/v4/covers", {
                    method: 'POST',
                    headers: IGDB.getHeaders(token.access_token),
                    body: `fields alpha_channel,animated,checksum,game,game_localization,height,image_id,url,width; where game = ${gameId};`
                });
            } catch (e) {
                if (transientRetries >= 2) {
                    throw e;
                }
                await wait(250 * (2 ** transientRetries));
                transientRetries++;
                continue;
            }

            if (response.status === 401 && !refreshedToken) {
                this.clearCachedToken(token.access_token);
                token = await this.authenticateIGDB();
                refreshedToken = true;
                continue;
            }

            if ((response.status === 404 || response.status === 429 || response.status >= 500) && transientRetries < 2) {
                await wait(retryDelay(response, transientRetries));
                transientRetries++;
                continue;
            }

            if (!response.ok) {
                throw new Error(`IGDB cover lookup failed: ${response.status}`);
            }

            const covers = await response.json() as Array<{ url?: string }>;
            const url = covers[0]?.url;
            if (url) {
                const parts = url.split('/');
                const lastPart = parts[parts.length - 1];
                return `https://images.igdb.com/igdb/image/upload/t_cover_big/${lastPart}`;
            }
            return null;
        }
    }

    static async initGenres(): Promise<void> {
        const { access_token } = await this.authenticateIGDB();
        const response = await fetchIGDB("https://api.igdb.com/v4/genres", {
            method: 'POST',
            headers: IGDB.getHeaders(access_token),
            body: `fields name; limit 500;`
        });
        const genres = await response.json();
        for (const genre of genres) {
            try {
                await GameDB.addGenreDefinition(genre.id, genre.name);
            } catch (e) {
                console.error(String(e));
            } 
        }
    }

    static async initPlatforms(): Promise<void> {
        const { access_token } = await this.authenticateIGDB();
        const response = await fetchIGDB("https://api.igdb.com/v4/platforms", {
            method: 'POST',
            headers: IGDB.getHeaders(access_token),
            body: `fields name; limit 500;`
        });
        const platforms = await response.json();
        for (const platform of platforms) {
            try {
                await PlatformDB.addPlatform(platform.id, platform.name);
            } catch (e) {
                console.error(String(e));
            }
        }
    }
}
