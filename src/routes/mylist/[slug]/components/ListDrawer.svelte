<script lang="ts">
    import { sineIn } from "svelte/easing";
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
</script>

<Drawer
    placement="right"
    transitionParams={transitionDrawerParams}
    bind:open={$pageStore.openDrawer}
    id="sidebar1"
    class="app-drawer w-full backdrop:bg-black/25"
>
    <Tabs
        tabStyle="full"
    >
        <ListDrawerTabFilters
            bind:selectedTab={$pageStore.selectedTab}
            {genres}
            {platforms}
        />
        <ListDrawerTabAdd
            bind:selectedTab={$pageStore.selectedTab}
        />
    </Tabs>
</Drawer>