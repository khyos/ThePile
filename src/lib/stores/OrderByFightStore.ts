import { ArtifactType } from '#lib/model/Artifact';
import type { BacklogItem } from '#lib/model/BacklogItem';
import { getPosterURL } from '#lib/services/ArtifactService';
import { OrderUtil } from '#lib/util/OrderUtil';
import { get, writable } from 'svelte/store';
import { backlogStore } from '../../routes/backlog/[slug]/stores/BacklogStore';
import { BacklogRankingType } from '#lib/model/Backlog';
import { pageStore } from '../../routes/backlog/[slug]/stores/PageStore';

export type OrderByFightStore = {
    artifactType: ArtifactType
    fightType: 'elo' | 'rank'
    pickType: 'locked' | 'random'
    highestValue: number
    lowestValue: number
    itemA?: BacklogItem
    itemAPoster?: string | null
    itemB?: BacklogItem
    itemBPoster?: string | null
    similarElo: boolean
};

export const orderByFightStore = writable<OrderByFightStore>({
    artifactType: ArtifactType.GAME,
    fightType: 'rank',
    pickType: 'locked',
    highestValue: 1,
    lowestValue: 0,
    similarElo: false
});

let previousItemA: BacklogItem | undefined;
let previousItemB: BacklogItem | undefined;
orderByFightStore.subscribe((store) => {
    if (store.itemA?.artifact.id !== previousItemA?.artifact.id) {
        previousItemA = store.itemA;
        updatePosterA(store);
    }
    if (store.itemB?.artifact.id !== previousItemB?.artifact.id) {
        previousItemB = store.itemB;
        updatePosterB(store);
    }
});

const updatePosterA = async (store: OrderByFightStore) => {
    if (!store.itemA) {
        return;
    }
    orderByFightStore.update(s => ({
        ...s,
        itemAPoster: undefined
    }));
    getPosterURL(store.artifactType, store.itemA.artifact.id).then((newItemAPoster) => {
        orderByFightStore.update(s => ({
            ...s,
            itemAPoster: newItemAPoster
        }));
    });
};

const updatePosterB = async (store: OrderByFightStore) => {
    if (!store.itemB) {
        return;
    }
    orderByFightStore.update(s => ({
        ...s,
        itemBPoster: undefined
    }));
    getPosterURL(store.artifactType, store.itemB.artifact.id).then((newItemBPoster) => {
        orderByFightStore.update(s => ({
            ...s,
            itemBPoster: newItemBPoster
        }));
    });
};

export const startOrderByFight = async (artifactId?: number) => {
    const pageStoreInst = get(pageStore);
    if (!pageStoreInst.openDrawer || pageStoreInst.selectedTab !== 'order') {
        pageStore.update(s => ({
            ...s,
            openDrawer: true,
            selectedTab: 'order'
        }));
    }

    const backlog = get(backlogStore).backlog;
    
    if (backlog.backlogItems.length < 2) {
        throw new Error("You can't fight alone");
    }
    orderByFightStore.update(s => ({
        ...s,
        artifactType: backlog.artifactType,
        fightType: backlog.rankingType === BacklogRankingType.RANK ? 'rank' : 'elo',
        pickType: artifactId ? 'locked' : 'random',
        highestValue: 1,
        lowestValue: backlog.backlogItems.length
    }));
    if (artifactId) {
        orderByFightStore.update(s => ({
            ...s,
            itemA: backlog.backlogItems.find(bi => bi.artifact.id === artifactId)
        }));
    } else {
        await getRandomItemA();
    }
    do {
        await getRandomItemB();
    } while (get(orderByFightStore).itemA?.artifact.id === get(orderByFightStore).itemB?.artifact.id);
};

export const getRandomItemA = async () => {
    const backlog = get(backlogStore).backlog;
    const store = get(orderByFightStore);
    const randomIndex = OrderUtil.getRandomIntegerBetween(store.highestValue - 1, store.lowestValue - 1);
    const itemA = backlog.backlogItems[randomIndex];
    orderByFightStore.update(s => ({
        ...s,
        itemA
    }));
};

export const updateItemA = async () => {
    const backlog = get(backlogStore).backlog;
    const store = get(orderByFightStore);
    const itemA = backlog.backlogItems.find(bi => bi.artifact.id === store.itemA?.artifact.id);
    orderByFightStore.update(s => ({
        ...s,
        itemA
    }));
}

export const getRandomItemB = async () => {
    const backlog = get(backlogStore).backlog;
    const store = get(orderByFightStore);
    const itemCount = backlog.backlogItems.length;

    // Clamp the search window to valid rank bounds so narrowing past the ends
    // (e.g. lowestValue reaching 0) can't produce out-of-range indices.
    const high = Math.max(1, Math.min(store.highestValue, itemCount));
    const low = Math.min(itemCount, Math.max(store.lowestValue, 1));

    let itemB: BacklogItem | undefined;
    if (store.similarElo && store.itemA) {
        const eloFiltered = backlog.backlogItems.filter(bi =>
            bi.artifact.id !== store.itemA!.artifact.id
            && bi.elo > store.itemA!.elo - 100
            && bi.elo < store.itemA!.elo + 100
        );
        if (eloFiltered.length > 0) {
            itemB = eloFiltered[OrderUtil.getRandomIntegerBetween(0, eloFiltered.length - 1)];
        }
    }
    if (!itemB) {
        // Candidates are the items inside the window, excluding itemA itself.
        // When none remain, the search is exhausted and itemB stays undefined.
        const candidates = backlog.backlogItems
            .slice(high - 1, low)
            .filter(bi => bi.artifact.id !== store.itemA?.artifact.id);
        if (candidates.length > 0) {
            itemB = candidates[OrderUtil.getRandomIntegerBetween(0, candidates.length - 1)];
        }
    }
    orderByFightStore.update(s => ({
        ...s,
        itemB
    }));
};

export const updateSimilarElo = (activated: boolean) => {
    orderByFightStore.update(s => ({
        ...s,
        similarElo: activated
    }));
}