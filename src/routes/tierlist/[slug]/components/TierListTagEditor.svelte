<script lang="ts">
    import { Button, Input } from "flowbite-svelte";
    import type { TierListTag } from "#lib/model/TierListTag";

    export let tags: TierListTag[];
    export let onCreate: (name: string, color: string) => Promise<void>;

    let name = '';
    let color = '#5b7cfa';
    let saving = false;
    let errorMessage: string | null = null;

    const create = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) return;
        saving = true;
        errorMessage = null;
        try {
            await onCreate(trimmedName, color);
            name = '';
        } catch {
            errorMessage = 'Unable to create tag. Check that the name is unique.';
        } finally {
            saving = false;
        }
    };
</script>

<div class="border rounded p-3 mb-3">
    <h4 class="text-lg font-medium mb-2 dark:text-white">Tags</h4>
    <div class="flex flex-wrap gap-2 mb-3">
        {#each tags as tag (tag.id)}
            <span class="rounded border px-2 py-1 text-sm font-medium" style={`color: ${tag.color}; border-color: ${tag.color};`}>
                {tag.name}
            </span>
        {/each}
        {#if tags.length === 0}
            <span class="text-sm text-gray-500 dark:text-gray-400">No tags created yet.</span>
        {/if}
    </div>
    <form class="flex flex-wrap items-center gap-2" on:submit|preventDefault={create}>
        <Input class="max-w-xs flex-grow" bind:value={name} maxlength={32} placeholder="Tag name" />
        <input aria-label="Tag color" type="color" bind:value={color} class="h-8 w-10 p-0 border-0 bg-transparent" />
        <Button size="xs" color="primary" type="submit" disabled={saving || !name.trim()}>
            {saving ? 'Creating...' : 'Create tag'}
        </Button>
    </form>
    {#if errorMessage}
        <p class="text-red-500 text-sm mt-2">{errorMessage}</p>
    {/if}
</div>
