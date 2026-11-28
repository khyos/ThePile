<script lang="ts">
    import { Button } from "flowbite-svelte";
    import { toPng } from "html-to-image";
    import type { PageData } from "./$types";
    import { initializeStore, refreshTierList, tierListStore } from "./stores/TierListStore";
    import TierRow from "./components/TierRow.svelte";
    import UnrankedPool from "./components/UnrankedPool.svelte";
    import TierEditor from "./components/TierEditor.svelte";
    import TierListTagEditor from "./components/TierListTagEditor.svelte";
    import AddItemModal from "./components/AddItemModal.svelte";
    import type { TierId } from "./components/dnd";
    import type { TierListItem } from "#lib/model/TierListItem";
    import type { IArtifactSummary } from "#lib/server/model/TierListUtil";

    export let data: PageData;

    initializeStore(data.tierList);

    $: store = $tierListStore;

    let showEditor = false;
    let showAddItemModal = false;
    let filterTagId: number | null = null;
    let boardEl: HTMLElement;
    let unrankedEl: HTMLElement;
    let addedSummaries: IArtifactSummary[] = [];
    let removalCandidates: IArtifactSummary[] = [];
    let tagChangeError = '';
    let moveError = '';

    const onDropItem = async (artifactId: number, _sourceTierId: TierId, targetTierId: TierId, targetPosition: number) => {
        try {
            const response = await fetch(`/api/tierlist/${store.tierList.id}/move`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artifactId, targetTierId, targetPosition })
            });
            if (!response.ok) {
                moveError = 'Unable to move this item. Please try again.';
                return;
            }
        } catch {
            moveError = 'Unable to move this item. Please try again.';
            return;
        }

        moveError = '';
        try {
            await refreshTierList();
        } catch {
            moveError = 'Item moved, but the list could not be refreshed.';
        }
    };

    const patchTiers = async (tiers: { id?: number; label: string; color: string; position: number }[]) => {
        const response = await fetch(`/api/tierlist/${store.tierList.id}/tiers`, {
            method: "PATCH",
            body: JSON.stringify({ tiers })
        });
        if (!response.ok) {
            return;
        }
        await refreshTierList();
    };

    const createTag = async (name: string, color: string) => {
        const response = await fetch(`/api/tierlist/${store.tierList.id}/tag`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, color })
        });
        if (!response.ok) {
            throw new Error('Unable to create tag');
        }
        await refreshTierList();
    };

    const onTagChange = async (artifactId: number, tagId: number, assigned: boolean): Promise<boolean> => {
        let response: Response;
        try {
            response = await fetch(`/api/tierlist/${store.tierList.id}/tag`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ artifactId, tagId, assigned })
            });
        } catch {
            tagChangeError = 'Unable to update this tag. Please try again.';
            return false;
        }
        if (!response.ok) {
            tagChangeError = 'Unable to update this tag. Please try again.';
            return false;
        }
        tagChangeError = '';
        try {
            await refreshTierList();
        } catch {
            tagChangeError = 'Tag updated, but the list could not be refreshed.';
        }
        return true;
    };

    const filterItems = (items: TierListItem[]): TierListItem[] => filterTagId === null
        ? items
        : items.filter(item => item.tags.some(tag => tag.id === filterTagId));

    const onTagFilterChange = (event: Event) => {
        const value = (event.currentTarget as HTMLSelectElement).value;
        filterTagId = value === '' ? null : Number(value);
    };

    const onUpdateTier = async (tierId: number, label: string, color: string) => {
        const tiers = store.tierList.tiers.map((tier, index) => ({
            id: tier.id,
            label: tier.id === tierId ? label : tier.label,
            color: tier.id === tierId ? color : tier.color,
            position: index
        }));
        await patchTiers(tiers);
    };

    const onSaveTiers = async (tiers: { id?: number; label: string; color: string; position: number }[]) => {
        await patchTiers(tiers);
        showEditor = false;
    };

    const refreshFromBacklog = async () => {
        const response = await fetch(`/api/tierlist/${store.tierList.id}/refresh`, { method: "POST" });
        if (!response.ok) {
            return;
        }
        const result = await response.json();
        addedSummaries = result.added;
        removalCandidates = result.removalCandidates;
        await refreshTierList();
    };

    const unlinkFromBacklog = async () => {
        if (!confirm('Are you sure? This cannot be undone.')) {
            return;
        }
        const response = await fetch(`/api/tierlist/${store.tierList.id}/unlink`, { method: "POST" });
        if (!response.ok) {
            return;
        }
        await refreshTierList();
    };

    const confirmRemoval = async (artifactId: number) => {
        await fetch(`/api/tierlist/${store.tierList.id}/item`, {
            method: "DELETE",
            body: JSON.stringify({ artifactId })
        });
        removalCandidates = removalCandidates.filter(candidate => candidate.id !== artifactId);
        await refreshTierList();
    };

    const removeItem = async (artifactId: number) => {
        await fetch(`/api/tierlist/${store.tierList.id}/item`, {
            method: "DELETE",
            body: JSON.stringify({ artifactId })
        });
        await refreshTierList();
    };

    const exportPng = async () => {
        boardEl
            .querySelectorAll(".drop-before, .drop-after, .drop-end")
            .forEach((el) => el.classList.remove("drop-before", "drop-after", "drop-end"));
        // The Unranked pool is part of the on-screen board (drop target) but
        // should not appear in the exported image.
        unrankedEl.style.display = "none";
        try {
            const dataUrl = await toPng(boardEl);
            const link = document.createElement("a");
            link.download = `${store.tierList.title || "tierlist"}.png`;
            link.href = dataUrl;
            link.click();
        } finally {
            unrankedEl.style.display = "";
        }
    };
</script>

<div class="space-y-4">
    <div class="flex justify-between items-center">
        <h1 class="text-2xl font-extrabold dark:text-white">{store.tierList.title}</h1>
        {#if data.canEdit}
            <div class="flex gap-2">
                <Button size="sm" color="light" onclick={() => (showEditor = !showEditor)}>Edit tiers &amp; tags</Button>
                {#if !store.tierList.isStandalone}
                    <Button size="sm" color="light" onclick={refreshFromBacklog}>Refresh from backlog</Button>
                    <Button size="sm" color="primary" onclick={unlinkFromBacklog}>Unlink from backlog</Button>
                {/if}
                {#if store.tierList.isStandalone}
                    <Button size="sm" color="light" onclick={() => (showAddItemModal = true)}>Add item</Button>
                {/if}
                <Button size="sm" onclick={exportPng}>Export PNG</Button>
            </div>
        {/if}
    </div>

    {#if data.canEdit && showEditor}
        <TierEditor tiers={store.tierList.tiers} onSave={onSaveTiers} />
        <TierListTagEditor tags={store.tierList.tags} onCreate={createTag} />
    {/if}

    <div class="flex flex-wrap items-center gap-2">
        <label for="tier-list-tag-filter" class="text-sm dark:text-white">Filter by tag</label>
        <select
            id="tier-list-tag-filter"
            class="rounded border border-gray-300 bg-white px-2 py-1 text-sm dark:bg-gray-800 dark:text-white"
            value={filterTagId ?? ''}
            onchange={onTagFilterChange}
        >
            <option value="">All items</option>
            {#each store.tierList.tags as tag (tag.id)}
                <option value={tag.id}>{tag.name}</option>
            {/each}
        </select>
        {#if filterTagId !== null}
            <span class="text-sm text-gray-500 dark:text-gray-400">Reordering is disabled while filtering.</span>
        {/if}
    </div>
    {#if tagChangeError}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{tagChangeError}</p>
    {/if}
    {#if moveError}
        <p class="text-sm text-red-600 dark:text-red-400" role="alert">{moveError}</p>
    {/if}

    {#if data.canEdit && (addedSummaries.length > 0 || removalCandidates.length > 0)}
        <div class="border rounded p-3">
            {#if addedSummaries.length > 0}
                <p class="text-sm mb-2 dark:text-white">{addedSummaries.length} item(s) added to Unranked.</p>
            {/if}
            {#if removalCandidates.length > 0}
                <p class="text-sm mb-2 dark:text-white">These items are no longer in the backlog:</p>
                {#each removalCandidates as candidate (candidate.id)}
                    <div class="flex items-center justify-between mb-1">
                        <span class="dark:text-white">{candidate.title}</span>
                        <Button size="xs" color="red" onclick={() => confirmRemoval(candidate.id)}>Remove</Button>
                    </div>
                {/each}
            {/if}
        </div>
    {/if}

    <div bind:this={boardEl} class="bg-white dark:bg-gray-800 p-2">
        {#each store.tierList.tiers as tier (tier.id)}
            <TierRow
                {tier}
                items={filterItems(tier.items)}
                artifactType={store.tierList.artifactType}
                canEdit={data.canEdit}
                canReorder={data.canEdit && filterTagId === null}
                onDrop={onDropItem}
                {onUpdateTier}
                onRemove={store.tierList.isStandalone && data.canEdit ? removeItem : undefined}
                tagDefinitions={store.tierList.tags}
                onTagChange={data.canEdit ? onTagChange : undefined}
            />
        {/each}
        <div bind:this={unrankedEl}>
            <UnrankedPool
                items={filterItems(store.tierList.unranked)}
                artifactType={store.tierList.artifactType}
                canEdit={data.canEdit}
                canReorder={data.canEdit && filterTagId === null}
                onDrop={onDropItem}
                onRemove={store.tierList.isStandalone && data.canEdit ? removeItem : undefined}
                tagDefinitions={store.tierList.tags}
                onTagChange={data.canEdit ? onTagChange : undefined}
            />
        </div>
    </div>
</div>

{#if data.canEdit && store.tierList.isStandalone}
    <AddItemModal
        tierListId={store.tierList.id}
        bind:open={showAddItemModal}
        onClose={() => (showAddItemModal = false)}
        onAdded={refreshTierList}
    />
{/if}
