import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { ArtifactType } from '#lib/model/Artifact';
import { Movie } from '#lib/model/movie/Movie';
import { openDrawer, pageStore, type UserListPageStore } from './PageStore';

const selectedArtifact = new Movie(1, 'Selected movie', ArtifactType.MOVIE, new Date('2024-01-01'), 120);
const tabs: UserListPageStore['selectedTab'][] = ['filters', 'add'];

describe('My List drawer shortcuts', () => {
    beforeEach(() => {
        pageStore.set({
            openDrawer: false,
            selectedTab: 'filters',
            selectedArtifact
        });
    });

    it.each(tabs)('opens directly on %s without clearing the selected artifact', (tab) => {
        openDrawer(tab);

        expect(get(pageStore)).toMatchObject({
            openDrawer: true,
            selectedTab: tab,
            selectedArtifact
        });
    });

    it('switches to the requested tab and stays open when a shortcut is used again', () => {
        openDrawer('add');
        openDrawer('filters');
        openDrawer('filters');

        expect(get(pageStore)).toMatchObject({
            openDrawer: true,
            selectedTab: 'filters'
        });
    });
});
