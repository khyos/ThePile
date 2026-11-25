<script lang="ts">
    import { Modal, Button, Input, Label } from "flowbite-svelte";
    import { get } from "svelte/store";
    import { filteredArtifacts, userListStore } from "../stores/UserListStore";

    let { open = $bindable(), onClose, onCreated }: {
        open: boolean;
        onClose: () => void;
        onCreated: (id: number) => void;
    } = $props();

    let title = $state('');
    let submitting = $state(false);

    async function handleSubmit() {
        if (!title.trim()) return;
        submitting = true;
        try {
            const artifactType = get(userListStore).userList.artifactType;
            const artifactIds = get(filteredArtifacts).map(artifact => artifact.id);
            const response = await fetch('/api/tierlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ artifactType, title: title.trim(), artifactIds }),
            });
            if (!response.ok) return;
            const { id } = await response.json();
            title = '';
            onCreated(id);
        } finally {
            submitting = false;
        }
    }
</script>

<Modal title="Create tier list" bind:open size="sm">
    <div class="space-y-4">
        <div>
            <Label for="create-tl-from-list-title">Title</Label>
            <Input id="create-tl-from-list-title" bind:value={title} placeholder="My tier list" />
        </div>
    </div>
    {#snippet footer()}
        <Button disabled={submitting || !title.trim()} onclick={handleSubmit}>Create</Button>
        <Button color="alternative" onclick={onClose}>Cancel</Button>
    {/snippet}
</Modal>
