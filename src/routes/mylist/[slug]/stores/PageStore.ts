import type { Artifact } from '#lib/model/Artifact';
import { writable } from 'svelte/store';

export type UserListPageStore = {
    openDrawer: boolean;
    selectedTab: 'filters' | 'add';
    selectedArtifact?: Artifact;
};

export const pageStore = writable<UserListPageStore>({
    openDrawer: false,
    selectedTab: 'filters'
});
export const openDrawer = (selectedTab: UserListPageStore['selectedTab']) => {
    pageStore.update(s => ({
        ...s,
        openDrawer: true,
        selectedTab
    }));
}
