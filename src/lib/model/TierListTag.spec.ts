import { describe, expect, it } from 'vitest';
import { ArtifactType } from './Artifact';
import { Game } from './game/Game';
import { TierList } from './TierList';
import { TierListItem } from './TierListItem';
import { TierListTag } from './TierListTag';

/**
 * Contract: Tier-list tag data shape
 *
 * - Tags are reusable definitions with id, name, and display color.
 * - Multiple tags belong to a TierListItem.
 * - Assignments are attached to items and round-trip independently of artifacts.
 * - Tag filtering selects items whose own tag assignments match a tag id.
 * - Tier-list tag definitions default to an empty array.
 */

describe('TierListTag serialization', () => {
    it('round-trips id, name, and display color', () => {
        const tag = new TierListTag(7, 'Favorites', '#5b7cfa');
        const restored = TierListTag.fromJSON(tag.toJSON());

        expect(restored).toEqual({ id: 7, name: 'Favorites', color: '#5b7cfa' });
    });

    it('uses the TierListTag serialized type', () => {
        expect(new TierListTag(7, 'Favorites', '#5b7cfa').toJSON().__type).toBe('TierListTag');
    });

    it('rejects a value with the wrong serialized type', () => {
        const json = new TierListTag(7, 'Favorites', '#5b7cfa').toJSON();
        expect(() => TierListTag.fromJSON({ ...json, __type: 'WrongType' } as never)).toThrow();
    });
});

describe('TierList item tag assignments', () => {
    function makeItem(tags: TierListTag[] = []) {
        const game = new Game(100, 'The Game', ArtifactType.GAME, new Date('2025-01-01'), 60);
        return new TierListItem(game, 12, 0, tags);
    }

    it('allows a tier-list item to have multiple tags', () => {
        const favorites = new TierListTag(1, 'Favorites', '#ff0000');
        const replay = new TierListTag(2, 'Replay', '#00aa55');
        const item = makeItem([favorites, replay]);

        expect(item.tags).toEqual([favorites, replay]);
        expect(item.toJSON().tags).toEqual([favorites.toJSON(), replay.toJSON()]);
    });

    it('keeps tag assignments attached to the item rather than the artifact', () => {
        const game = new Game(100, 'The Game', ArtifactType.GAME, new Date('2025-01-01'), 60);
        const tagged = new TierListItem(game, 12, 0, [
            new TierListTag(1, 'Favorites', '#ff0000')
        ]);
        const untagged = new TierListItem(game, 12, 1, []);

        expect(tagged.artifact).toBe(untagged.artifact);
        expect(tagged.artifact.id).toBe(untagged.artifact.id);
        expect(tagged.tags.map(tag => tag.id)).toEqual([1]);
        expect(untagged.tags).toEqual([]);
    });

    it('round-trips multiple item tags through a TierList', () => {
        const tags = [
            new TierListTag(1, 'Favorites', '#ff0000'),
            new TierListTag(2, 'Replay', '#00aa55')
        ];
        const item = makeItem(tags);
        const tierList = new TierList(
            42,
            1,
            null,
            ArtifactType.GAME,
            'Games',
            true,
            [],
            [item],
            tags
        );

        const restored = TierList.fromJSON(tierList.toJSON());

        expect(restored.tags.map(tag => tag.id)).toEqual([1, 2]);
        expect(restored.unranked[0].tags.map(tag => tag.id)).toEqual([1, 2]);
        expect(restored.unranked[0].artifact.id).toBe(100);
    });

    it('defaults missing item tags to an empty list', () => {
        const item = makeItem();
        expect(item.tags).toEqual([]);
    });

    it('filters items by any matching tag assignment', () => {
        const favorites = new TierListTag(1, 'Favorites', '#ff0000');
        const replay = new TierListTag(2, 'Replay', '#00aa55');
        const items = [
            makeItem([favorites, replay]),
            makeItem([replay]),
            makeItem([])
        ];

        expect(items.filter(item => item.tags.some(tag => tag.id === 1))).toEqual([items[0]]);
        expect(items.filter(item => item.tags.some(tag => tag.id === 2))).toEqual([items[0], items[1]]);
        expect(items.filter(item => item.tags.some(tag => tag.id === 999))).toEqual([]);
    });

    it('defaults tier-list tag definitions to an empty array', () => {
        const tierList = new TierList(42, 1, null, ArtifactType.GAME, 'Games');
        expect(tierList.tags).toEqual([]);
    });

    it('filtering a tier and unranked pool does not mutate or reorder underlying lists', () => {
        const favorite = new TierListTag(1, 'Favorites', '#ff0000');
        const replay = new TierListTag(2, 'Replay', '#00aa55');
        const first = makeItem([favorite, replay]);
        const second = makeItem([replay]);
        const third = makeItem([]);
        const tierItems = [first, second, third];
        const unrankedItems = [third, first, second];
        const tierSnapshot = [...tierItems];
        const unrankedSnapshot = [...unrankedItems];

        const tierFiltered = tierItems.filter(item => item.tags.some(tag => tag.id === favorite.id));
        const unrankedFiltered = unrankedItems.filter(item => item.tags.some(tag => tag.id === replay.id));

        expect(tierFiltered).toEqual([first]);
        expect(unrankedFiltered).toEqual([first, second]);
        expect(tierItems).toEqual(tierSnapshot);
        expect(unrankedItems).toEqual(unrankedSnapshot);
        expect(tierItems.map(item => item.position)).toEqual([0, 0, 0]);
    });
});
