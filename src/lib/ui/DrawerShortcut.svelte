<script lang="ts">
    import type { Snippet } from "svelte";

    let { label, drawerId, expanded, onclick, children }: {
        label: string;
        drawerId: string;
        expanded: boolean;
        onclick: () => void;
        children: Snippet;
    } = $props();
</script>

<button
    type="button"
    class="header-action"
    aria-label={label}
    title={label}
    aria-controls={drawerId}
    aria-expanded={expanded}
    {onclick}
>
    <span aria-hidden="true">{@render children()}</span>
</button>

<style>
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

    :global(.dark) .header-action {
        border-color: #364254;
        color: var(--app-accent);
        background: #202e3e;
    }

    :global(.dark) .header-action:hover {
        color: var(--app-accent);
        background: #2e4055;
    }
</style>
