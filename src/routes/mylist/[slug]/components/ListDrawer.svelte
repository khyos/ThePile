<script lang="ts">
    import { sineIn } from "svelte/easing";
    import { focusSelectedDrawerTab } from "#lib/util/DrawerUtil";
    import { 
        Drawer,
        Tabs 
    } from "flowbite-svelte";
    
    import { pageStore } from "../stores/PageStore";
    import type { Genre } from "#lib/model/Genre";
    import type { Platform } from "#lib/model/game/Platform";
    import ListDrawerTabFilters from "./ListDrawerTabFilters.svelte";
    import ListDrawerTabAdd from "./ListDrawerTabAdd.svelte";
    
    export let transitionDrawerParams = {
        x: 320,
        duration: 200,
        easing: sineIn,
    };
    export let genres: Genre[] = [];
    export let platforms: Platform[] = [];
    export let canCreateTierList: boolean = false;
    export let onCreateTierList: (() => void) | undefined = undefined;
</script>

<Drawer
    placement="right"
    transitionParams={transitionDrawerParams}
    bind:open={$pageStore.openDrawer}
    onintrostart={focusSelectedDrawerTab}
    id="sidebar1"
    class="app-drawer w-full backdrop:bg-black/25"
>
    <Tabs
        bind:selected={$pageStore.selectedTab}
        tabStyle="full"
    >
        <ListDrawerTabFilters
            {genres}
            {platforms}
            {canCreateTierList}
            {onCreateTierList}
        />
        <ListDrawerTabAdd />
    </Tabs>
</Drawer>