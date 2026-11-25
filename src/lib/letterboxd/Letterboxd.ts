import puppeteer from 'puppeteer';
import type { SearchResult } from '#lib/types/SearchResult';

export class Letterboxd {
    static async getRating(slug: string): Promise<number | null> {
        if (!/^[a-z0-9-]+$/.test(slug)) return null;
        let browser;
        try {
            browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.goto(`https://letterboxd.com/film/${slug}/`);
            let rawValue = await page.evaluate(() => {
                const averageRatingLabel = Array.from(document.querySelectorAll<HTMLMetaElement>('meta[name^="twitter:label"]'))
                    .find(meta => meta.content.trim().toLowerCase() === 'average rating');
                if (averageRatingLabel) {
                    const dataName = averageRatingLabel.name.replace('label', 'data');
                    const metaValue = document.querySelector<HTMLMetaElement>(`meta[name="${dataName}"]`)?.content;
                    if (metaValue) return metaValue;
                }
                return document.querySelector('.averagerating')?.textContent?.trim() ?? null;
            });
            if (!rawValue) {
                try {
                    await page.waitForSelector('.averagerating', { timeout: 10000 });
                    rawValue = await page.$eval('.averagerating', el => el.textContent?.trim() ?? null);
                } catch (e) {
                    console.error(e);
                    return null;
                }
            }
            if (!rawValue) return null;
            const normalized = Math.round(parseFloat(rawValue) * 20);
            return isNaN(normalized) ? null : normalized;
        } catch (e) {
            console.error(e);
            return null;
        } finally {
            await browser?.close();
        }
    }

    static async searchMovie(query: string): Promise<SearchResult[]> {
        let browser;
        try {
            browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
            const page = await browser.newPage();
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
            await page.goto(`https://letterboxd.com/search/films/${encodeURIComponent(query)}/`, { timeout: 20000 });
            await page.waitForSelector('a.frame[href*="/film/"]', { timeout: 10000 });
            return await page.evaluate(() => {
                const links = document.querySelectorAll<HTMLAnchorElement>('a.frame[href*="/film/"]');
                const seen = new Set<string>();
                const results: { id: string; name: string; link: string }[] = [];
                for (const a of links) {
                    const href = a.getAttribute('href');
                    if (!href || seen.has(href)) continue;
                    seen.add(href);
                    const slug = href.replace(/^\/film\//, '').replace(/\/$/, '');
                    results.push({
                        id: slug,
                        name: a.textContent?.trim() ?? slug,
                        link: `https://letterboxd.com${href}`
                    });
                }
                return results;
            });
        } catch (e) {
            console.error(e);
            return [];
        } finally {
            await browser?.close();
        }
    }
}
