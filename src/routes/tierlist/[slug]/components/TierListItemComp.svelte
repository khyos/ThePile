<script lang="ts">
    import type { ArtifactType } from "#lib/model/Artifact";
    import type { TierListItem } from "#lib/model/TierListItem";
    import type { TierListTag } from "#lib/model/TierListTag";
    import { getPosterURL } from "#lib/services/ArtifactService";
    import { onMount } from "svelte";
    import { draggable, dropzone, type TierId } from "./dnd";

    export let item: TierListItem;
    export let artifactType: ArtifactType;
    export let canEdit: boolean = false;
    export let canReorder: boolean = false;
    export let tierId: TierId;
    export let onDrop: (artifactId: number, sourceTierId: TierId, targetTierId: TierId, targetPosition: number) => void | Promise<void>;
    export let onRemove: ((artifactId: number) => void | Promise<void>) | undefined = undefined;
    export let tagDefinitions: TierListTag[] = [];
    export let onTagChange: ((artifactId: number, tagId: number, assigned: boolean) => void | boolean | Promise<void | boolean>) | undefined = undefined;

    let posterUrl: string | null = null;
    let posterLoadFailed = false;
    onMount(() => {
        getPosterURL(artifactType, item.artifact.id).then((url) => {
            if (url) {
                posterUrl = `/api/image?url=${encodeURIComponent(url)}`;
            }
        }).catch(() => {
            posterLoadFailed = true;
        });
    });
</script>

<div
    class="tier-item"
    use:draggable={{ canEdit: canReorder, artifactId: item.artifact.id, sourceTierId: tierId, sourceIndex: item.position }}
    use:dropzone={{ canEdit: canReorder, tierId, position: item.position, itemArtifactId: item.artifact.id, horizontal: true, onDrop }}
>
    {#if canEdit && onRemove !== undefined}
        <button
            class="tier-item-remove"
            onclick={() => onRemove!(item.artifact.id)}
            title="Remove"
            aria-label="Remove {item.artifact.title}"
        >×</button>
    {/if}
    {#if posterUrl && !posterLoadFailed}
        <img src={posterUrl} alt="{item.artifact.title} poster" class="tier-item-poster" onerror={() => posterLoadFailed = true} />
    {:else}
        <div class="tier-item-noposter bg-gray-200 dark:bg-gray-700">
            <span class="text-gray-400 dark:text-gray-500">No poster</span>
        </div>
    {/if}
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a class="tier-item-title" href={`/${artifactType}/${item.artifact.id}`} title={item.artifact.title}>
        {item.artifact.title}
    </a>
    {#if item.tags.length > 0}
        <div class="tier-item-tags">
            {#each item.tags as tag (tag.id)}
                <span class="tier-item-tag" style={`color: ${tag.color}; border-color: ${tag.color};`}>
                    {tag.name}
                </span>
            {/each}
        </div>
    {/if}
    {#if canEdit && tagDefinitions.length > 0 && onTagChange}
        <details class="tier-item-tag-editor">
            <summary title="Add tag" aria-label="Add or remove tags for {item.artifact.title}">+</summary>
            <div class="tier-item-tag-options">
                {#each tagDefinitions as tag (tag.id)}
                    <label>
                        <input
                            type="checkbox"
                            checked={item.tags.some(assignedTag => assignedTag.id === tag.id)}
                            onchange={async (event) => {
                                const checkbox = event.currentTarget;
                                const assigned = checkbox.checked;
                                try {
                                    const result = await onTagChange!(item.artifact.id, tag.id, assigned);
                                    if (result === false) checkbox.checked = !assigned;
                                } catch {
                                    checkbox.checked = !assigned;
                                }
                            }}
                        />
                        <span style={`color: ${tag.color};`}>{tag.name}</span>
                    </label>
                {/each}
            </div>
        </details>
    {/if}
</div>

<style>
    .tier-item {
        display: flex;
        flex-direction: column;
        align-items: center;
        box-sizing: content-box;
        width: 5rem;
        /* Horizontal gap is padding (not margin) so the space between two
           items belongs to the item's own dropzone hit area — hovering
           between two posters resolves to before/after instead of falling
           through to the container's "drop-end". Vertical margin keeps the
           spacing between wrapped rows. */
        margin: 0.25rem 0;
        padding: 0 0.25rem;
        position: relative;
    }
    .tier-item-remove {
        display: none;
        position: absolute;
        top: 0;
        right: 0;
        z-index: 10;
        background: rgba(0,0,0,0.6);
        color: white;
        border: none;
        border-radius: 50%;
        width: 1.25rem;
        height: 1.25rem;
        font-size: 0.875rem;
        line-height: 1;
        cursor: pointer;
        align-items: center;
        justify-content: center;
        padding: 0;
    }
    .tier-item:hover .tier-item-remove {
        display: flex;
    }
    .tier-item:global(.drop-before)::before,
    .tier-item:global(.drop-after)::after {
        content: "";
        position: absolute;
        top: 0;
        bottom: 0;
        width: 3px;
        border-radius: 2px;
        background-color: var(--app-accent);
        pointer-events: none;
    }
    .tier-item:global(.drop-before)::before {
        left: 0;
    }
    .tier-item:global(.drop-after)::after {
        right: 0;
    }
    .tier-item-poster {
        width: 5rem;
        height: 7rem;
        object-fit: cover;
        border-radius: 0.25rem;
    }
    .tier-item-noposter {
        width: 5rem;
        height: 7rem;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 0.25rem;
        font-size: 0.65rem;
        text-align: center;
    }
    .tier-item-title {
        font-size: 0.7rem;
        max-width: 5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        text-align: center;
    }
    .tier-item-tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 0.15rem;
        max-width: 6rem;
    }
    .tier-item-tag {
        border: 1px solid;
        border-radius: 0.25rem;
        padding: 0 0.2rem;
        font-size: 0.55rem;
        line-height: 1.1rem;
        max-width: 5.5rem;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }
    .tier-item-tag-editor {
        position: absolute;
        top: 0.1rem;
        left: 0.1rem;
        z-index: 20;
        font-size: 0.65rem;
        opacity: 0;
        visibility: hidden;
        pointer-events: none;
        transition: opacity 0.15s ease;
    }
    .tier-item-tag-editor summary {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 1.5rem;
        height: 1.5rem;
        border-radius: 50%;
        background: rgba(0, 0, 0, 0.7);
        color: white;
        font-size: 1rem;
        font-weight: 700;
        line-height: 1.5rem;
        cursor: pointer;
        list-style: none;
        margin-left: 0.3rem;
    }
    .tier-item-tag-editor summary::-webkit-details-marker {
        display: none;
    }
    .tier-item:hover .tier-item-tag-editor,
    .tier-item:focus-within .tier-item-tag-editor,
    .tier-item-tag-editor[open] {
        opacity: 1;
        visibility: visible;
        pointer-events: auto;
    }
    @media (hover: none) {
        .tier-item-tag-editor:not([open]) {
            opacity: 1;
            visibility: visible;
            pointer-events: auto;
        }
    }
    .tier-item-tag-options {
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        flex-direction: column;
        gap: 0.25rem;
        min-width: max-content;
        padding: 0.4rem;
        border: 1px solid #d1d5db;
        border-radius: 0.25rem;
        background: white;
        color: #111827;
        box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }
    .tier-item-tag-options label {
        display: flex;
        align-items: center;
        gap: 0.3rem;
        cursor: pointer;
    }
</style>
