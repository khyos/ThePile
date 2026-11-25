<script lang="ts">
    import {
        Table,
        TableBody,
        TableHead,
    } from "flowbite-svelte";
    import { FilterOutline, PlusOutline } from "flowbite-svelte-icons";
    import DrawerShortcut from "#lib/ui/DrawerShortcut.svelte";
    import type { PageData } from "./$types";
    import ListDrawer from "./components/ListDrawer.svelte";
    import CreateTierListFromListModal from "./components/CreateTierListFromListModal.svelte";
    import { TimeUtil } from "#lib/util/TimeUtil";
    import ListItemComp from "./components/ListItemComp.svelte";
    import SortableHeadCell from "./components/SortableHeadCell.svelte";
    import { openDrawer, pageStore } from "./stores/PageStore";
    import { filteredArtifacts, initializeStore, userListStore } from "./stores/UserListStore";
    import { Genre } from "#lib/model/Genre";
    import { Platform } from "#lib/model/game/Platform";
    import { ArtifactType } from "#lib/model/Artifact";
    import { UserListOrder } from "#lib/model/UserList";

    export let data: PageData;

    $: initializeStore(data.list);

    $: genres = data.genres.map(genre => Genre.fromJSON(genre));
    $: platforms = data.platforms.map(platform => Platform.fromJSON(platform));

    $: totalTime = data.list.artifacts.reduce((acc, artifact) => {
        return acc + artifact.duration;
    }, 0);

    $: orderBy = $userListStore.userListFilters.orderBy;

    let showCreateTierListModal = false;

    function onTierListCreated(id: number) {
        showCreateTierListModal = false;
        window.location.href = `/tierlist/${id}`;
    }

    function setSort(type: UserListOrder) {
        userListStore.update((store) => {
            const current = store.userListFilters.orderBy;
            const direction = current.type === type
                ? (current.direction === 'asc' ? 'desc' : 'asc')
                : 'asc';
            return {
                ...store,
                userListFilters: {
                    ...store.userListFilters,
                    orderBy: { type, direction }
                }
            };
        });
    }
</script>

<div class="flex items-center gap-4">
    <h3
        class="p-1 text-xl font-medium text-gray-900 dark:text-white"
        style="flex-grow: 1; padding-left: 1rem"
    >
        {data.list.artifactType} ({TimeUtil.formatDuration(totalTime)})
    </h3>
    <div class="flex shrink-0 gap-1.5">
        <DrawerShortcut
            label="Filters"
            drawerId="sidebar1"
            expanded={$pageStore.openDrawer && $pageStore.selectedTab === "filters"}
            onclick={() => openDrawer("filters")}
        >
            <FilterOutline class="h-4 w-4" />
        </DrawerShortcut>
        <DrawerShortcut
            label="Add to list"
            drawerId="sidebar1"
            expanded={$pageStore.openDrawer && $pageStore.selectedTab === "add"}
            onclick={() => openDrawer("add")}
        >
            <PlusOutline class="h-4 w-4" />
        </DrawerShortcut>
    </div>
</div>
<Table>
    <TableHead>
        <SortableHeadCell type={UserListOrder.TITLE} activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        <SortableHeadCell type={UserListOrder.SCORE} activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        <SortableHeadCell type={UserListOrder.STATUS} activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        <SortableHeadCell type={UserListOrder.DATE_RELEASE} activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        {#if data.list.artifactType === ArtifactType.MOVIE}
        <SortableHeadCell type={UserListOrder.DATE_START} label="Date" activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        {:else}
        <SortableHeadCell type={UserListOrder.DATE_START} activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        <SortableHeadCell type={UserListOrder.DATE_END} activeType={orderBy.type} direction={orderBy.direction} onSort={setSort} />
        {/if}
    </TableHead>
    <TableBody>
        {#each $filteredArtifacts as artifact (artifact.id)}
            <ListItemComp
                {artifact}
            />
        {/each}
    </TableBody>
</Table>

<ListDrawer
    {genres}
    {platforms}
    canCreateTierList={data.canCreateTierList}
    onCreateTierList={() => (showCreateTierListModal = true)}
/>

{#if data.canCreateTierList}
    <CreateTierListFromListModal
        bind:open={showCreateTierListModal}
        onClose={() => (showCreateTierListModal = false)}
        onCreated={onTierListCreated}
    />
{/if}