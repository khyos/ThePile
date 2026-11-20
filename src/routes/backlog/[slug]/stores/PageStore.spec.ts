import { beforeEach, describe, expect, it } from 'vitest';
import { get } from 'svelte/store';
import { openDrawer, pageStore, type BacklogPageStore } from './PageStore';

const tabs: BacklogPageStore['selectedTab'][] = ['filters', 'add', 'order'];

describe('backlog drawer shortcuts', () => {
    beforeEach(() => {
        pageStore.set({
            openDrawer: false,
            selectedTab: 'filters',
            isCopiedToastVisible: true,
            showMoveToBacklog: false,
            showMoveToRank: true
        });
    });

    it.each(tabs)('opens the drawer directly on %s without resetting other page state', (tab) => {
        openDrawer(tab);

        expect(get(pageStore)).toMatchObject({
            openDrawer: true,
            selectedTab: tab,
            isCopiedToastVisible: true,
            showMoveToRank: true
        });
    });

    it('switches tabs and keeps the drawer open when the same shortcut is used again', () => {
        openDrawer('add');
        openDrawer('order');
        openDrawer('order');

        expect(get(pageStore)).toMatchObject({
            openDrawer: true,
            selectedTab: 'order'
        });
    });
});
