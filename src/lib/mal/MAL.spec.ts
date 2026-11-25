import { afterEach, describe, expect, it, vi } from "vitest";
import { MAL } from "./MAL";

describe("MAL date ranges", () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    it.each([
        ["Nov 1990 to Mar 1995", { from: "1990-11-01", to: "1995-03-31" }],
        [" 1997 to 2006", { from: "1997-01-01", to: "2006-12-31" }],
        ["Aug 1998 to Oct 29, 2003", { from: "1998-08-01", to: "2003-10-29" }],
        ["Feb 2027", { from: "2027-02-01", to: undefined }]
    ])("parses %s", (value, expected) => {
        expect(MAL.parseDateRange(value)).toEqual(expected);
    });

    it("uses the string range for anime and manga when explicit dates are absent", async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        malId: 1,
                        title: "Anime",
                        episodes: 12,
                        score: 8,
                        aired: { string: "Aug 1998 to Oct 29, 2003" }
                    }
                })
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    data: {
                        malId: 2,
                        title: "Manga",
                        published: { string: " 1997 to 2006" }
                    }
                })
            });
        vi.stubGlobal("fetch", fetchMock);

        const anime = await MAL.getAnime("1");
        const manga = await MAL.getManga("2");

        expect(anime?.aired).toMatchObject({ from: "1998-08-01", to: "2003-10-29" });
        expect(manga?.published).toMatchObject({ from: "1997-01-01", to: "2006-12-31" });
    });

    it("preserves explicit dates and parses missing dates from the string", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: {
                    malId: 1,
                    title: "Anime",
                    episodes: 12,
                    score: 8,
                    aired: { from: "2000-02-03", string: "1997 to 2006" }
                }
            })
        }));

        const anime = await MAL.getAnime("1");

        expect(anime?.aired).toMatchObject({ from: "2000-02-03", to: "2006-12-31" });
    });
});
