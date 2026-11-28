import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import { parse } from 'svelte/compiler';
import ts from 'typescript';

const pageSource = readFileSync(fileURLToPath(new URL('./+page.svelte', import.meta.url)), 'utf8');

type ScriptDeclarator = {
    id: { type: string; name?: string };
    init: { start: number; end: number };
};

type ScriptStatement = {
    type: string;
    declarations?: ScriptDeclarator[];
};

/**
 * The move callback is deliberately kept in the Svelte page because it updates
 * page-local feedback state. Extract its actual expression from the Svelte
 * script AST so the fetch/refresh behavior can be exercised without mocking or
 * reimplementing the callback. These are integration-focused checks of its real
 * request and error-recovery paths.
 */
function createMoveHandler(
    fetchImpl: typeof globalThis.fetch,
    refreshTierList: () => Promise<void>
) {
    const ast = parse(pageSource) as unknown as {
        instance?: { content: { body: ScriptStatement[] } };
    };
    const declaration = ast.instance?.content.body.find((statement: ScriptStatement) =>
        statement.type === 'VariableDeclaration'
        && statement.declarations?.some((item: ScriptDeclarator) => item.id.type === 'Identifier' && item.id.name === 'onDropItem')
    );
    if (!declaration || declaration.type !== 'VariableDeclaration' || !declaration.declarations) {
        throw new Error('onDropItem callback not found in tier-list page');
    }

    const declarator = declaration.declarations.find(
        (item: ScriptDeclarator) => item.id.type === 'Identifier' && item.id.name === 'onDropItem'
    )!;
    const callback = pageSource.slice(declarator.init.start, declarator.init.end);
    const javascript = ts.transpileModule(`const onDropItem = ${callback}; return { onDropItem, get error() { return moveError; } };`, {
        compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.None }
    }).outputText;
    const factory = new Function(
        'fetch',
        'refreshTierList',
        'store',
        `let moveError = ''; ${javascript}`
    ) as (fetchImpl: typeof globalThis.fetch, refresh: () => Promise<void>, store: unknown) => {
        onDropItem: (artifactId: number, sourceTierId: number | null, targetTierId: number | null, targetPosition: number) => Promise<void>;
        error: string;
    };

    return factory(fetchImpl, refreshTierList, { tierList: { id: 42 } });
}

const move = [71, null, 9, 2] as const;

describe('tier-list move feedback integration', () => {
    it('binds move failures to a visible alert in the page', () => {
        expect(pageSource).toMatch(/<p[^>]*role="alert"[^>]*>\{moveError\}<\/p>/);
    });

    it('shows failure after a non-OK move response and does not refresh', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: false });
        const refresh = vi.fn().mockResolvedValue(undefined);
        const handler = createMoveHandler(fetchMock, refresh);

        await handler.onDropItem(...move);

        expect(handler.error).toBe('Unable to move this item. Please try again.');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(fetchMock).toHaveBeenCalledWith('/api/tierlist/42/move', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ artifactId: 71, targetTierId: 9, targetPosition: 2 })
        });
        expect(refresh).not.toHaveBeenCalled();
    });

    it('shows failure after a rejected network request and does not refresh', async () => {
        const fetchMock = vi.fn().mockRejectedValue(new TypeError('Network unavailable'));
        const refresh = vi.fn().mockResolvedValue(undefined);
        const handler = createMoveHandler(fetchMock, refresh);

        await handler.onDropItem(...move);

        expect(handler.error).toBe('Unable to move this item. Please try again.');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(refresh).not.toHaveBeenCalled();
    });

    it('clears prior move feedback and refreshes after an accepted move', async () => {
        const fetchMock = vi.fn()
            .mockResolvedValueOnce({ ok: false })
            .mockResolvedValueOnce({ ok: true });
        const refresh = vi.fn().mockResolvedValue(undefined);
        const handler = createMoveHandler(fetchMock, refresh);

        await handler.onDropItem(...move);
        expect(handler.error).toBe('Unable to move this item. Please try again.');

        await handler.onDropItem(...move);

        expect(handler.error).toBe('');
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(refresh).toHaveBeenCalledTimes(1);
    });

    it('distinguishes an accepted move from a failed follow-up refresh', async () => {
        const fetchMock = vi.fn().mockResolvedValue({ ok: true });
        const refresh = vi.fn().mockRejectedValue(new Error('Refresh failed'));
        const handler = createMoveHandler(fetchMock, refresh);

        await handler.onDropItem(...move);

        expect(handler.error).toBe('Item moved, but the list could not be refreshed.');
        expect(fetchMock).toHaveBeenCalledTimes(1);
        expect(refresh).toHaveBeenCalledTimes(1);
    });
});
