import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Letterboxd } from './Letterboxd';
import puppeteer from 'puppeteer';

vi.mock('puppeteer');

function makeMockBrowser(textContent: string | null) {
    const mockEval = textContent !== null
        ? vi.fn().mockResolvedValue(textContent)
        : vi.fn().mockRejectedValue(new Error('No element'));
    const mockPage = {
        setUserAgent: vi.fn().mockResolvedValue(undefined),
        goto: vi.fn().mockResolvedValue(undefined),
        waitForSelector: textContent !== null
            ? vi.fn().mockResolvedValue(undefined)
            : vi.fn().mockRejectedValue(new Error('Timeout')),
        evaluate: vi.fn().mockResolvedValue(null),
        $eval: mockEval,
        content: vi.fn().mockResolvedValue('<html>page content</html>'),
    };
    const mockBrowser = {
        newPage: vi.fn().mockResolvedValue(mockPage),
        close: vi.fn().mockResolvedValue(undefined),
    };
    vi.mocked(puppeteer.launch).mockResolvedValue(mockBrowser as never);
    return { mockBrowser, mockPage, mockEval };
}

describe('Letterboxd.getRating', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    // --- Slug validation ---

    it('returns null immediately for slugs with invalid characters', async () => {
        await expect(Letterboxd.getRating('../etc/passwd')).resolves.toBeNull();
        expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    it('returns null immediately for slug with uppercase letters', async () => {
        await expect(Letterboxd.getRating('The-Godfather')).resolves.toBeNull();
        expect(puppeteer.launch).not.toHaveBeenCalled();
    });

    // --- URL construction ---

    it('navigates to the correct Letterboxd URL for the given slug', async () => {
        const { mockPage } = makeMockBrowser(null);
        await Letterboxd.getRating('the-dark-knight');
        expect(mockPage.goto).toHaveBeenCalledWith('https://letterboxd.com/film/the-dark-knight/');
        expect(mockPage.waitForSelector).toHaveBeenCalledWith('.averagerating', { timeout: 10000 });
    });

    // --- Absent / unparseable element ---

    it('returns null when .averagerating element is absent', async () => {
        makeMockBrowser(null);
        await expect(Letterboxd.getRating('some-film')).resolves.toBeNull();
    });

    it('reads the average rating from Letterboxd metadata', async () => {
        const { mockPage } = makeMockBrowser(null);
        mockPage.evaluate.mockResolvedValue('4.37 out of 5');

        await expect(Letterboxd.getRating('some-film')).resolves.toBe(87);

        expect(mockPage.waitForSelector).not.toHaveBeenCalled();
    });

    it('returns null when .averagerating text cannot be parsed as a float', async () => {
        makeMockBrowser('N/A');
        await expect(Letterboxd.getRating('some-film')).resolves.toBeNull();
    });

    // --- Boundary value normalisation (rating × 20) ---

    it('converts a 3.8-star average to 76', async () => {
        makeMockBrowser('3.8');
        await expect(Letterboxd.getRating('some-film')).resolves.toBe(76);
    });

    it('converts a 2.5-star average to 50', async () => {
        makeMockBrowser('2.5');
        await expect(Letterboxd.getRating('some-film')).resolves.toBe(50);
    });

    it('converts a 5-star average to 100', async () => {
        makeMockBrowser('5');
        await expect(Letterboxd.getRating('some-film')).resolves.toBe(100);
    });

    it('rounds fractional results (3.77 → 75)', async () => {
        makeMockBrowser('3.77');
        await expect(Letterboxd.getRating('some-film')).resolves.toBe(75);
    });

    // --- Error handling ---

    it('returns null when puppeteer.launch throws', async () => {
        vi.mocked(puppeteer.launch).mockRejectedValue(new Error('Launch failed'));
        await expect(Letterboxd.getRating('some-film')).resolves.toBeNull();
    });
});
