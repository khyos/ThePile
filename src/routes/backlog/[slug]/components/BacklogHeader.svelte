<script lang="ts">
    import { FilterOutline, PlusOutline } from "flowbite-svelte-icons";
    import { onMount } from "svelte";
    import { TimeUtil } from "#lib/util/TimeUtil";
    import { backlogStore } from "../stores/BacklogStore";
    import { openDrawer, pageStore } from "../stores/PageStore";

    export let canEdit: boolean;

    let sentinel: HTMLElement;
    let isStuck = false;

    $: items = $backlogStore.backlog.backlogItems;
    $: totalTime = items.reduce((total, item) => total + item.artifact.duration, 0);
    $: formattedTotalTime = TimeUtil.formatDuration(totalTime);

    onMount(() => {
        const observer = new IntersectionObserver(
            ([entry]) => { isStuck = !entry.isIntersecting; },
            { threshold: [1] }
        );
        observer.observe(sentinel);
        return () => observer.disconnect();
    });
</script>

<li bind:this={sentinel} class="h-px -mb-px" aria-hidden="true"></li>
<li class="backlog-header" class:stuck={isStuck}>
    <div class="heading-wrap">
        <h3 title={$backlogStore.backlog.title}>{$backlogStore.backlog.title}</h3>
        <div class="header-summary" title={`${formattedTotalTime} \u00b7 ${items.length} Total`}>
            <span>{formattedTotalTime}</span>
            <span aria-hidden="true">&middot;</span>
            <span>{items.length} Total</span>
        </div>
    </div>
    <div class="header-actions">
        <button
            type="button"
            class="header-action"
            aria-label="Filters"
            title="Filters"
            aria-controls="sidebar1"
            aria-expanded={$pageStore.openDrawer && $pageStore.selectedTab === "filters"}
            onclick={() => openDrawer("filters")}
        >
            <span aria-hidden="true"><FilterOutline class="h-4 w-4" /></span>
        </button>
        {#if canEdit}
            <button
                type="button"
                class="header-action"
                aria-label="Add to backlog"
                title="Add to backlog"
                aria-controls="sidebar1"
                aria-expanded={$pageStore.openDrawer && $pageStore.selectedTab === "add"}
                onclick={() => openDrawer("add")}
            >
                <span aria-hidden="true"><PlusOutline class="h-4 w-4" /></span>
            </button>
            <button
                type="button"
                class="header-action"
                aria-label="Order by fight"
                title="Order by fight"
                aria-controls="sidebar1"
                aria-expanded={$pageStore.openDrawer && $pageStore.selectedTab === "order"}
                onclick={() => openDrawer("order")}
            >
                <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M3 3h4l10 10-4 4L3 7V3Zm9 15 6-6m-3 3 5 5m-2 2 4-4" />
                    <path d="M3 3h4l10 10-4 4L3 7V3Zm9 15 6-6m-3 3 5 5m-2 2 4-4" transform="translate(24 0) scale(-1 1)" />
                </svg>
            </button>
        {/if}
    </div>
</li>

<style>
    .backlog-header {
        position: sticky;
        top: 0;
        z-index: 10;
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        justify-content: space-between;
        gap: 8px 16px;
        padding: 8px 12px;
        border-bottom: 1px solid #e2e8f0;
        border-radius: 7px 7px 0 0;
        background: linear-gradient(110deg, #f8fafc, #ffffff);
        transition: box-shadow 150ms ease;
    }

    .stuck {
        box-shadow: 0 4px 8px #00000014;
    }

    .heading-wrap {
        display: flex;
        flex: 1 1 240px;
        flex-wrap: wrap;
        align-items: baseline;
        gap: 4px 8px;
        min-width: 0;
    }

    h3 {
        color: var(--app-text);
        font-size: 16px;
        font-weight: 600;
        overflow-wrap: anywhere;
    }

    .header-summary {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px;
        color: var(--app-muted);
        font-size: 12px;
        font-weight: 400;
    }

    .header-actions {
        display: flex;
        flex-shrink: 0;
        gap: 6px;
        margin-left: auto;
    }

    .header-action {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border: 1px solid #cbd5e1;
        border-radius: 7px;
        color: var(--app-accent);
        background: #f1f5f9;
        font-size: 12px;
        font-weight: 500;
        cursor: pointer;
    }

    .header-action:hover {
        color: var(--app-accent);
        background: #e2e8f0;
    }

    .header-action:focus-visible {
        outline: 2px solid var(--app-accent-focus);
        outline-offset: 2px;
    }

    :global(.dark) .backlog-header {
        border-color: #303d4f;
        background: linear-gradient(110deg, #182431, #121b29);
    }

    :global(.dark) .header-action {
        border-color: #364254;
        color: var(--app-accent);
        background: #202e3e;
    }

    :global(.dark) .header-action:hover {
        color: var(--app-accent);
        background: #2e4055;
    }

    @media (max-width: 639px) {
        .backlog-header {
            flex-wrap: nowrap;
        }

        .heading-wrap {
            flex: 1;
            flex-wrap: nowrap;
        }

        h3 {
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .header-summary {
            display: block;
            flex: 1;
            min-width: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
        }

        .header-summary span + span {
            margin-left: 4px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .backlog-header {
            transition: none;
        }
    }
</style>
