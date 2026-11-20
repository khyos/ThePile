<script lang="ts">
    import { 
        Badge,
        Button, 
        TabItem,
        Card,
        Heading,
        P
    } from "flowbite-svelte";
    import { BacklogRankingType } from "#lib/model/Backlog";
    import { getRandomItemA, getRandomItemB, orderByFightStore, startOrderByFight, updateItemA, updateSimilarElo } from "#lib/stores/OrderByFightStore";
    import { get } from "svelte/store";
    import { CheckCircleOutline, ImageOutline, RefreshOutline, ThumbsDownOutline, ThumbsUpOutline } from "flowbite-svelte-icons";
    import type { BacklogItem } from "#lib/model/BacklogItem";
    import { backlogStore, refreshBacklog } from "../stores/BacklogStore";

    export let canEdit: boolean;

    // Event Callbacks
    export let onMoveBacklogItem: (srcRank: number, targetRank: number) => Promise<void>;

    $: store = $orderByFightStore;
    $: backlogStoreInst = $backlogStore;

    // Loading states
    let isLoading = false;

    const orderByEloFight = async (winner: string) => {
        let backlogStoreInst = get(backlogStore);
        let store = get(orderByFightStore);
        if (isLoading || !store.itemA || !store.itemB) {
            return;
        }
        isLoading = true;
        let winnerItem: BacklogItem;
        let loserItem: BacklogItem;
        if (winner === "A") {
            winnerItem = store.itemA;
            loserItem = store.itemB;
        } else {
            winnerItem = store.itemB;
            loserItem = store.itemA;
        }
        
        try {
            const response = await fetch(`/api/backlog/${backlogStoreInst.backlog.id}/elo`, {
                method: "POST",
                body: JSON.stringify({
                    winnerArtifactId: winnerItem.artifact.id,
                    loserArtifactId: loserItem.artifact.id,
                }),
            });
            if (!response.ok) {
                throw new Error(`ELO update failed (${response.status})`);
            }
            
            await refreshBacklog();
            if (store.pickType === 'random') {
                await getRandomItemA();
            } else {
                await updateItemA();
            }
            await getRandomItemB();
        } catch (error) {
            console.error("Error updating ELO rankings:", error);
        } finally {
            isLoading = false;
        }
    }

    const orderByComparisonPickHigher = async () => {
        isLoading = true;
        try {
            let store = get(orderByFightStore);
            if (!store.itemA || !store.itemB) {
                return;
            }

            orderByFightStore.update(s => ({
                ...s,
                lowestValue: store.itemB!.rank - 1
            }));

            let backlogStoreInst = get(backlogStore);
            
            if (store.itemB.rank < store.itemA.rank) {
                await onMoveBacklogItem(store.itemA.rank, store.itemB.rank);
                let newItemA = backlogStoreInst.backlog.backlogItems[store.itemB.rank - 1];
                orderByFightStore.update(s => ({
                    ...s,
                    itemA: newItemA
                }));
            }
            await getRandomItemB();
        } catch (error) {
            console.error("Error moving item higher:", error);
        } finally {
            isLoading = false;
        }
    }

    const orderByComparisonPickLower = async () => {
        isLoading = true;
        try {
            let store = get(orderByFightStore);
            if (!store.itemA || !store.itemB) {
                return;
            }

            orderByFightStore.update(s => ({
                ...s,
                highestValue: store.itemB!.rank + 2
            }));

            let backlogStoreInst = get(backlogStore);
            
            if (store.itemB.rank > store.itemA.rank) {
                await onMoveBacklogItem(store.itemA.rank, store.itemB.rank);
                let newItemA = backlogStoreInst.backlog.backlogItems[store.itemB.rank - 1];
                orderByFightStore.update(s => ({
                    ...s,
                    itemA: newItemA
                }));
            }
            await getRandomItemB();
        } catch (error) {
            console.error("Error moving item lower:", error);
        } finally {
            isLoading = false;
        }
    }

    const startRanking = async () => {
        isLoading = true;
        try {
            await startOrderByFight();
        } catch (error) {
            console.error("Error starting ranking process:", error);
        } finally {
            isLoading = false;
        }
    }

</script>

<TabItem key="order" title="Order" class="w-full" disabled={!canEdit}>
    <div>
        {#if !store.itemA || !store.itemB}
            <Card class="drawer-panel text-center p-4">
                <Heading tag="h4" class="mb-2">Backlog Ordering</Heading>
                <P class="mb-2">
                    {#if backlogStoreInst.backlog.rankingType === BacklogRankingType.RANK}
                        Arrange your backlog items in order of priority by comparing them one by one.
                    {:else}
                        Compare items head-to-head to generate ELO rankings for your backlog.
                    {/if}
                </P>
                <Button 
                    color="primary"
                    class="mx-auto" 
                    onclick={startRanking}
                    disabled={isLoading}
                >
                    <div class="flex items-center gap-2">
                        <RefreshOutline class="w-4 h-4" />
                        <span>Start Ordering</span>
                    </div>
                </Button>
            </Card>
        {:else}
            {#if backlogStoreInst.backlog.rankingType === BacklogRankingType.RANK}
                <div class="space-y-4">
                    <Card class="drawer-panel p-2 relative">
                        <div class="absolute top-2 right-2">
                            <Badge color="primary" class="font-semibold">#{store.itemA.rank}</Badge>
                        </div>
                        <Heading tag="h5" class="pb-2">Item to Order</Heading>
                        <P class="font-medium">{store.itemA.artifact.title}</P>
                    </Card>
                    
                    <Card class="drawer-panel p-2 relative">
                        <div class="absolute top-2 right-2">
                            <Badge color="primary" class="font-semibold">#{store.itemB.rank}</Badge>
                        </div>
                        <Heading tag="h5" class="pb-2">Compared to</Heading>
                        <P class="font-medium">{store.itemB.artifact.title}</P>
                    </Card>
                    
                    <div class="flex gap-2 justify-center">
                        <Button 
                            color="primary"
                            onclick={orderByComparisonPickHigher}
                            disabled={isLoading}
                        >
                            <div class="flex items-center gap-2">
                                <ThumbsUpOutline class="w-4 h-4" />
                                <span>Higher</span>
                            </div>
                        </Button>

                        <Button 
                            color="green" 
                            onclick={() => startRanking()}
                            disabled={isLoading}
                        >
                            <div class="flex items-center gap-2">
                                <CheckCircleOutline class="w-4 h-4" />
                                <span>Keep</span>
                            </div>
                        </Button>
                    
                        <Button 
                            color="primary"
                            onclick={orderByComparisonPickLower}
                            disabled={isLoading}
                        >
                            <div class="flex items-center gap-2">
                                <ThumbsDownOutline class="w-4 h-4" />
                                <span>Lower</span>
                            </div>
                        </Button>
                    </div>
                </div>
            {:else if backlogStoreInst.backlog.rankingType === BacklogRankingType.ELO}
                <section class="elo-comparison" aria-labelledby="elo-comparison-title" aria-busy={isLoading}>
                    <h2 id="elo-comparison-title">Which item do you prefer?</h2>
                    <div class="matchup">
                        {#each [
                            { side: "A", item: store.itemA, poster: store.itemAPoster },
                            { side: "B", item: store.itemB, poster: store.itemBPoster }
                        ] as contender (contender.side)}
                            <button
                                type="button"
                                class="contender"
                                aria-label={`Prefer ${contender.item.artifact.title}`}
                                onclick={() => orderByEloFight(contender.side)}
                                disabled={isLoading}
                            >
                                <span class="contender-stats">
                                    <span class="rank-badge" aria-label={`Rank ${contender.item.rank}`}># {contender.item.rank}</span>
                                    <span class="elo-badge" aria-label={`ELO ${contender.item.elo}`}>
                                        <svg aria-hidden="true" width="15" height="15" viewBox="0 0 24 24" fill="currentColor">
                                            <path d="M7 2h10v3h4v3a5 5 0 0 1-5 5h-.5a5 5 0 0 1-2.5 1.9V19h4v3H7v-3h4v-4.1A5 5 0 0 1 8.5 13H8a5 5 0 0 1-5-5V5h4V2ZM5 7v1a3 3 0 0 0 2.2 2.9A5 5 0 0 1 7 9V7H5Zm12 0v2c0 .7-.1 1.3-.2 1.9A3 3 0 0 0 19 8V7h-2Z" />
                                        </svg>
                                        <span>{contender.item.elo}</span>
                                    </span>
                                </span>
                                <span class="poster">
                                    {#if contender.poster}
                                        <img src={contender.poster} alt="" />
                                    {:else}
                                        <ImageOutline class="h-10 w-10" />
                                    {/if}
                                </span>
                                <span class="contender-title">
                                    {contender.item.artifact.title} ({new Date(contender.item.artifact.releaseDate).getFullYear()})
                                </span>
                            </button>
                        {/each}
                        <span class="versus" aria-hidden="true">VS</span>
                    </div>
                    <button type="button" class="pick-different" onclick={startRanking} disabled={isLoading}>
                        <RefreshOutline class="h-4 w-4" />
                        <span>Pick Different Items</span>
                    </button>
                    <div class="similar-elo-wrap">
                        <button
                            type="button"
                            class="similar-elo"
                            role="switch"
                            aria-checked={store.similarElo}
                            onclick={() => updateSimilarElo(!store.similarElo)}
                            disabled={isLoading}
                        >
                            <span>Pick Similar Elo</span>
                            <span class="switch-track" aria-hidden="true"><span class="switch-thumb"></span></span>
                        </button>
                    </div>
                </section>
            {/if}
        {/if}
    </div>
</TabItem>

<style>
    .elo-comparison {
        --fight-accent: var(--app-accent);
        --fight-border: #cbd5e1;
        --fight-surface: #ffffff;
        --fight-badge: #e2e8f0;
        --fight-elo-background: #fff0d6;
    }

    h2 {
        margin: 0 0 24px;
        color: var(--app-text);
        font-size: 22px;
        font-weight: 700;
        line-height: 1.3;
        text-align: center;
        text-wrap: balance;
    }

    .matchup {
        position: relative;
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 18px;
    }

    .contender {
        display: flex;
        flex-direction: column;
        gap: 6px;
        min-width: 0;
        padding: 9px;
        border: 1px solid var(--fight-border);
        border-radius: 11px;
        color: var(--app-text);
        background: var(--fight-surface);
        box-shadow: 0 6px 16px #0000000a;
        cursor: pointer;
        transition: border-color 150ms ease, box-shadow 150ms ease;
    }

    .contender:hover:not(:disabled) {
        border-color: var(--fight-accent);
        box-shadow: 0 0 18px #ee98542b;
    }

    .contender-stats {
        display: flex;
        flex-wrap: wrap;
        justify-content: space-between;
        gap: 4px;
        width: 100%;
        font-size: 14px;
        font-weight: 700;
        line-height: 1.4;
    }

    .rank-badge,
    .elo-badge {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 4px;
        padding: 2px 8px;
        border-radius: 5px;
        white-space: nowrap;
    }

    .rank-badge {
        color: var(--app-muted);
        background: var(--fight-badge);
    }

    .elo-badge {
        color: var(--fight-accent);
        background: var(--fight-elo-background);
    }

    .poster {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 100%;
        aspect-ratio: 3 / 4;
        overflow: hidden;
        border-radius: 7px;
        color: var(--app-muted);
        background: var(--fight-badge);
    }

    .poster img {
        width: 100%;
        height: 100%;
        object-fit: cover;
    }

    .contender-title {
        width: 100%;
        padding: 5px 0 3px;
        font-size: 16px;
        line-height: 1.45;
        text-align: center;
        overflow-wrap: anywhere;
    }

    .versus {
        position: absolute;
        top: 48%;
        left: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        width: 50px;
        height: 50px;
        border: 2px solid #f3b25b;
        border-radius: 50%;
        color: var(--fight-accent);
        background: #f8fafc;
        box-shadow: 0 0 20px #ee98544d;
        font-size: 18px;
        font-weight: 700;
        pointer-events: none;
        transform: translate(-50%, -50%);
    }

    .pick-different {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 10px;
        width: 100%;
        margin-top: 18px;
        padding: 12px;
        border: 1px solid var(--fight-border);
        border-radius: 9px;
        color: var(--app-text);
        background: transparent;
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
    }

    .similar-elo-wrap {
        display: flex;
        justify-content: center;
        margin-top: 20px;
    }

    .similar-elo {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 8px 10px 8px 16px;
        border: 1px solid var(--fight-border);
        border-radius: 999px;
        color: var(--app-text);
        background: var(--fight-surface);
        font-size: 16px;
        font-weight: 600;
        cursor: pointer;
    }

    .switch-track {
        display: flex;
        align-items: center;
        width: 44px;
        height: 26px;
        padding: 3px;
        border: 1px solid var(--fight-border);
        border-radius: 999px;
        background: var(--fight-badge);
        transition: background 150ms ease, box-shadow 150ms ease;
    }

    .switch-thumb {
        width: 18px;
        height: 18px;
        border-radius: 50%;
        background: var(--app-muted);
        transition: transform 150ms ease;
    }

    .similar-elo[aria-checked="true"] .switch-track {
        border-color: #f3b25b;
        background: #82521f;
        box-shadow: 0 0 15px #ee98544d;
    }

    .similar-elo[aria-checked="true"] .switch-thumb {
        background: #ffc469;
        transform: translateX(18px);
    }

    .pick-different:hover:not(:disabled),
    .similar-elo:hover:not(:disabled) {
        border-color: var(--fight-accent);
    }

    button:focus-visible {
        outline: 2px solid var(--app-accent-focus);
        outline-offset: 3px;
    }

    button:disabled {
        opacity: 0.6;
        cursor: wait;
    }

    :global(.dark) .elo-comparison {
        --fight-border: #404b59;
        --fight-surface: linear-gradient(135deg, #29343e, #1c2531);
        --fight-badge: #ffffff1a;
        --fight-elo-background: #654519;
    }

    :global(.dark) .versus {
        background: #131923;
    }

    @media (max-width: 379px) {
        h2 {
            font-size: 20px;
        }

        .contender-stats {
            font-size: 12px;
        }

        .rank-badge,
        .elo-badge {
            padding-right: 5px;
            padding-left: 5px;
        }

        .contender-title {
            font-size: 14px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .contender,
        .switch-track,
        .switch-thumb {
            transition: none;
        }
    }
</style>