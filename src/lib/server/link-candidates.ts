import { HLTB } from '#lib/hltb/HLTB';
import { IGDB } from '#lib/igdb/IGDB';
import { ITAD } from '#lib/itad/ITAD';
import { Letterboxd } from '#lib/letterboxd/Letterboxd';
import { MAL } from '#lib/mal/MAL';
import { MangaBaka } from '#lib/mangabaka/MangaBaka';
import { MetaCritic } from '#lib/metacritic/MetaCritic';
import { ArtifactType } from '#lib/model/Artifact';
import type { Candidate } from '#lib/model/Candidate';
import { LinkType } from '#lib/model/Link';
import { OpenCritic } from '#lib/opencritic/OpenCritic';
import { RottenTomatoes } from '#lib/rottentomatoes/RottenTomatoes';
import { SensCritique } from '#lib/senscritique/SensCritique';
import { Steam } from '#lib/steam/Steam';
import { TMDB } from '#lib/tmdb/TMDB';

export function fromResults(results: unknown[] | null | undefined): Candidate[] {
    if (!results) return [];
    return results.flatMap(r => {
        if (typeof r !== 'object' || r === null) return [];
        const rec = r as Record<string, unknown>;
        const id = rec.id != null ? String(rec.id) : '';
        if (!id || id === 'undefined') return [];
        const name = typeof rec.name === 'string' ? rec.name : '';
        const c: Candidate = { id, name };
        if (typeof rec.date === 'string' && rec.date) c.date = rec.date;
        return [c];
    });
}

export async function getCandidates(artifactType: string, linkType: string, query: string): Promise<Candidate[]> {
    try {
        if (artifactType === ArtifactType.GAME) {
            if (linkType === LinkType.IGDB) return fromResults(await IGDB.searchGame(query));
            if (linkType === LinkType.HLTB) return fromResults(await HLTB.searchGame(query));
            if (linkType === LinkType.SENSCRITIQUE) return fromResults(await SensCritique.searchGame(query));
            if (linkType === LinkType.METACRITIC) return fromResults(await MetaCritic.searchGame(query));
            if (linkType === LinkType.OPENCRITIC) return fromResults(await OpenCritic.searchGame(query));
            if (linkType === LinkType.STEAM) return fromResults(await Steam.searchGame(query));
            if (linkType === LinkType.ITAD) return fromResults(await ITAD.searchGame(query));
        } else if (artifactType === ArtifactType.MOVIE) {
            if (linkType === LinkType.TMDB) return fromResults(await TMDB.searchMovie(query));
            if (linkType === LinkType.SENSCRITIQUE) return fromResults(await SensCritique.searchMovie(query));
            if (linkType === LinkType.METACRITIC) return fromResults(await MetaCritic.searchMovie(query));
            if (linkType === LinkType.ROTTEN_TOMATOES) return fromResults(await RottenTomatoes.searchMovie(query));
            if (linkType === LinkType.LETTERBOXD) return fromResults(await Letterboxd.searchMovie(query));
        } else if (artifactType === ArtifactType.TVSHOW) {
            if (linkType === LinkType.TMDB) return fromResults(await TMDB.searchTvshow(query));
            if (linkType === LinkType.SENSCRITIQUE) return fromResults(await SensCritique.searchTvshow(query));
            if (linkType === LinkType.METACRITIC) return fromResults(await MetaCritic.searchTvshow(query));
            if (linkType === LinkType.ROTTEN_TOMATOES) return fromResults(await RottenTomatoes.searchTvshow(query));
        } else if (artifactType === ArtifactType.ANIME) {
            if (linkType === LinkType.MAL) return fromResults(await MAL.searchAnime(query));
            if (linkType === LinkType.SENSCRITIQUE) return fromResults(await SensCritique.searchTvshow(query));
        } else if (artifactType === ArtifactType.MANGA) {
            if (linkType === LinkType.MAL) return fromResults(await MAL.searchManga(query));
            if (linkType === LinkType.SENSCRITIQUE) return fromResults(await SensCritique.searchBD(query));
            if (linkType === LinkType.MANGABAKA) return fromResults(await MangaBaka.searchManga(query));
        }
        return [];
    } catch {
        return [];
    }
}
