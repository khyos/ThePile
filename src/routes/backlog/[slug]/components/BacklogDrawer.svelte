<script lang="ts">
    import { tick } from "svelte";
    import { sineIn } from "svelte/easing";
    import { 
        Drawer,
        Tabs, 
        type drawerTransitionParamTypes

    } from "flowbite-svelte";
    import BacklogDrawerTabAdd from "./BacklogDrawerTabAdd.svelte";
    import BacklogDrawerTabFilters from "./BacklogDrawerTabFilters.svelte";
    import BacklogDrawerTabOrder from "./BacklogDrawerTabOrder.svelte";
    import { pageStore } from "../stores/PageStore";
    import type { Genre } from "#lib/model/Genre";
    import type { Platform } from "#lib/model/game/Platform";
    import type { Tag } from "#lib/model/Tag";
    
    export let transitionDrawerParams: drawerTransitionParamTypes = {
        x: 320,
        duration: 200,
        easing: sineIn,
    };
    export let canEdit: boolean;
    export let genres: Genre[] = [];
    export let backlogTags: Tag[] = [];
    export let platforms: Platform[] = [];

    // Event Callbacks
    export let onMoveBacklogItem: (srcRank: number, targetRank: number) => Promise<void>;
    export let onFetchPrices: () => Promise<void>;
    export let onCreateTierList: (() => Promise<void>) | undefined = undefined;

    const focusSelectedTab = async (event: CustomEvent & { currentTarget: HTMLDialogElement }) => {
        const drawer = event.currentTarget;
        await tick();
        const focusedElement = drawer.ownerDocument.activeElement;
        if (drawer.open && (focusedElement === drawer || focusedElement === drawer.querySelector('button[role="tab"]'))) {
            drawer.querySelector<HTMLButtonElement>('button[role="tab"][aria-selected="true"]')?.focus();
        }
    };
</script>

<Drawer
    placement="right"
    transitionParams={transitionDrawerParams}
    bind:open={$pageStore.openDrawer}
    onintrostart={focusSelectedTab}
    id="sidebar1"
    class="app-drawer w-full backdrop:bg-black/25"
>
    <Tabs
        bind:selected={$pageStore.selectedTab}
        tabStyle="full"
    >
        <BacklogDrawerTabFilters
            {genres}
            {backlogTags}
            {platforms}
            {onFetchPrices}
            {canEdit}
            {onCreateTierList}
        />
        <BacklogDrawerTabAdd
            {canEdit}
        />
        <BacklogDrawerTabOrder
            canEdit={canEdit}
            {onMoveBacklogItem}
        />
    </Tabs>
</Drawer>