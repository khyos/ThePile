<script lang="ts">
    import { getLinkTypeLabel, getLinkTypesByArtifactType, isLinkTypeRemovable, Link, LinkType } from "#lib/model/Link";
    import { ArtifactType } from "#lib/model/Artifact";
    import type { Candidate } from "#lib/model/Candidate";
    import { openLink } from "#lib/services/LinkService";
    import { artifactItemStore, refreshArtifact } from "#lib/stores/ArtifactItemStore";
    import {
        Label,
        Button,
        Modal,
        Input,
        Select,
        Spinner,
        P,
    } from "flowbite-svelte";
    import {
        PlusOutline,
        RefreshOutline,
        LinkOutline,
        EditOutline,
    } from "flowbite-svelte-icons";
    import { onMount } from "svelte";

    export let canEdit: boolean = false;

    $: artifactItemStoreInst = $artifactItemStore;
    $: artifact = artifactItemStoreInst.artifact;
    $: editLinkRemovable = editLinkType != null && isLinkTypeRemovable(artifact.type, editLinkType);

    let openAddLink = false;
    let openEditLink = false;
    let addLinkType: LinkType | null = null;
    let addLinkUrl: string | undefined = undefined;
    let editLinkType: LinkType | null = null;
    let editLinkUrl: string | undefined = undefined;
    let unboundLinkTypes: { value: LinkType; name: string }[] = [];

    let refreshingAllLinks = false;
    let refreshingLinks: Record<string, boolean> = {};
    let addingLink = false;

    let addSearchQuery: string = '';
    let addCandidates: Candidate[] = [];
    let addSearchLoading: boolean = false;
    let addSearchDone: boolean = false;

    let editSearchQuery: string = '';
    let editCandidates: Candidate[] = [];
    let editSearchLoading: boolean = false;
    let editSearchDone: boolean = false;
    let editPendingCandidate: Candidate | null = null;

    onMount(() => refreshLinkTypes());

    function refreshLinkTypes() {
        unboundLinkTypes = getLinkTypesByArtifactType(artifact.type)
            .filter(linkType => !artifact.links.some((link) => link.type === linkType))
            .map(linkType => ({
                value: linkType,
                name: getLinkTypeLabel(linkType),
            }));
    }

    function refreshLinksData(linksToRefresh: Link[]) {
        if (linksToRefresh.length === artifact.links.length) {
            refreshingAllLinks = true;
        } else {
            linksToRefresh.forEach(link => {
                refreshingLinks[link.type] = true;
            });
        }

        const types = linksToRefresh.map(link => link.type);
        fetch(`/api/${artifact.type.toLowerCase()}/${artifact.id}/link`, {
            method: "PUT",
            body: JSON.stringify({ types }),
        }).then(async (response) => {
            if (response.status !== 200) {
                const errorResponse = await response.json();
                alert(`Error while refreshing links: ` + errorResponse.message);
            } else {
                refreshArtifact();
            }
        }).catch(error => {
            console.error(`Error while refreshing links`, error);
            alert(`Error while refreshing links`);
        }).finally(() => {
            refreshingAllLinks = false;
            linksToRefresh.forEach(link => {
                refreshingLinks[link.type] = false;
            });
        });
    }

    function isLinkInputIncomplete(linkType: LinkType | null, linkUrl?: string) {
        return !linkType || !linkUrl;
    }

    async function addLink() {
        if (addingLink) return;
        addingLink = true;
        try {
            const response = await fetch(`/api/${artifact.type.toLowerCase()}/${artifact.id}/link`, {
                method: "POST",
                body: JSON.stringify({
                    type: addLinkType,
                    url: addLinkUrl,
                }),
            });
            if (response.status !== 200) {
                alert("Failed to add link");
                return;
            }
            refreshArtifact();
            refreshLinkTypes();
            openAddLink = false;
            addLinkType = null;
            addLinkUrl = undefined;
        } catch (error) {
            console.error("Error adding link:", error);
            alert("Failed to add link");
        } finally {
            addingLink = false;
        }
    }

    function openAddLinkModal() {
        addSearchQuery = artifact.title;
        addCandidates = [];
        addSearchLoading = false;
        addSearchDone = false;
        addLinkType = null;
        addLinkUrl = undefined;
        openAddLink = true;
    }

    function openEditLinkModal(link: Link) {
        editLinkType = link.type;
        editLinkUrl = link.url;
        editSearchQuery = artifact.title;
        editCandidates = [];
        editSearchLoading = false;
        editSearchDone = false;
        editPendingCandidate = null;
        openEditLink = true;
    }

    function updateLink() {
        fetch(`/api/${artifact.type.toLowerCase()}/${artifact.id}/link`, {
            method: "PATCH",
            body: JSON.stringify({
                type: editLinkType,
                url: editLinkUrl,
            }),
        }).then((response) => {
            if (response.status !== 200) {
                alert("Failed to update link");
                return;
            }
            refreshArtifact();
            openEditLink = false;
            editLinkType = null;
            editLinkUrl = undefined;
            editCandidates = [];
            editSearchDone = false;
            editPendingCandidate = null;
        }).catch(error => {
            console.error("Error updating link:", error);
            alert("Failed to update link");
        });
    }

    async function removeLink() {
        if (!editLinkType) return;
        if (!confirm(`Are you sure you want to remove the ${getLinkTypeLabel(editLinkType)} link and its derived data?`)) {
            return;
        }
        try {
            const response = await fetch(`/api/${artifact.type.toLowerCase()}/${artifact.id}/link?type=${editLinkType}`, {
                method: "DELETE",
            });
            if (response.status !== 200) {
                alert("Failed to remove link");
                return;
            }
            refreshArtifact();
            refreshLinkTypes();
            openEditLink = false;
            editLinkType = null;
            editLinkUrl = undefined;
        } catch (error) {
            console.error("Error removing link:", error);
            alert("Failed to remove link");
        }
    }

    async function searchCandidates(modal: 'add' | 'edit') {        const linkType = modal === 'add' ? addLinkType : editLinkType;
        const query = modal === 'add' ? addSearchQuery : editSearchQuery;
        if (!linkType || !query) return;

        if (modal === 'add') {
            addSearchLoading = true; addCandidates = []; addSearchDone = false;
        } else {
            editSearchLoading = true; editCandidates = []; editSearchDone = false; editPendingCandidate = null;
        }

        try {
            const params = new URLSearchParams({ artifactType: artifact.type, linkType, query });
            const res = await fetch(`/api/artifacts/link-candidates?${params}`);
            if (res.ok) {
                const body = await res.json();
                const candidates: Candidate[] = body.results ?? [];
                if (modal === 'add') { addCandidates = candidates; addSearchDone = true; }
                else { editCandidates = candidates; editSearchDone = true; }
            } else {
                if (modal === 'add') { addCandidates = []; addSearchDone = true; }
                else { editCandidates = []; editSearchDone = true; }
            }
        } catch {
            // silent; searchDone stays false
        } finally {
            if (modal === 'add') addSearchLoading = false;
            else editSearchLoading = false;
        }
    }

    function handleLinkClick(event: MouseEvent, artifactType: ArtifactType, linkType: LinkType, linkUrl: string) {
        if (event.button === 1 || event.button === 0) {
            openLink(artifactType, linkType, linkUrl);
        }
    }
</script>

<div>
    <div class="flex items-center justify-between mb-2">
        <div class="flex items-center">
            <LinkOutline class="w-4 h-4 mr-2 text-green-500" />
            <P weight="medium" class="text-lg">Links</P>
        </div>
        {#if canEdit}
            <div class="flex space-x-2">
                <Button
                    size="xs"
                    color="primary"
                    disabled={unboundLinkTypes.length == 0}
                    onclick={openAddLinkModal}>
                    <PlusOutline class="mr-1 w-3 h-3" />Add
                </Button>
                <Button
                    size="xs"
                    color="primary"
                    disabled={refreshingAllLinks}
                    onclick={() => refreshLinksData(artifact.links)}>
                    {#if refreshingAllLinks}
                        <Spinner size="4" class="mr-1" />
                    {:else}
                        <RefreshOutline class="mr-1 w-3 h-3" />
                    {/if}
                    Refresh
                </Button>
            </div>
        {/if}
    </div>
    <div class="space-y-2 ml-6">
        {#each artifact.links as link (link.type)}
            <div class="flex items-center justify-between bg-gray-50 dark:bg-gray-800 p-2 rounded">
                <button
                    onclick={(event) => handleLinkClick(event, artifact.type, link.type, link.url)}
                    onauxclick={(event) => handleLinkClick(event, artifact.type, link.type, link.url)}
                    class="text-blue-600 hover:underline flex-1 truncate" style="text-align:left"
                >
                    <span class="font-medium">{link.type}:</span> {link.url}
                </button>
                {#if canEdit}
                    <div class="flex items-center space-x-1 ml-2">
                        <Button
                            size="xs"
                            pill
                            color="light"
                            disabled={refreshingLinks[link.type] || refreshingAllLinks}
                            onclick={() => openEditLinkModal(link)}
                        >
                            <EditOutline class="w-3 h-3" />
                        </Button>
                        <Button
                            size="xs"
                            pill
                            color="light"
                            disabled={refreshingLinks[link.type] || refreshingAllLinks}
                            onclick={() => refreshLinksData([link])}
                        >
                            {#if refreshingLinks[link.type] || refreshingAllLinks}
                                <Spinner size="4" />
                            {:else}
                                <RefreshOutline class="w-3 h-3" />
                            {/if}
                        </Button>
                    </div>
                {/if}
            </div>
        {/each}
    </div>
</div>

<Modal title="Add New Link" bind:open={openAddLink} size="sm">
    <div class="space-y-4">
        <div>
            <Label for="linkType" class="mb-2">Link Type</Label>
            <Select
                id="linkType"
                items={unboundLinkTypes}
                bind:value={addLinkType}
                placeholder="Select link type"
            />
        </div>
        <div>
            <Label for="addSearchQuery" class="mb-2">Search</Label>
            <div class="flex gap-2">
                <Input type="text" id="addSearchQuery" bind:value={addSearchQuery} class="flex-1" />
                <Button size="sm" color="light" disabled={!addLinkType || addSearchLoading} onclick={() => searchCandidates('add')}>
                    {#if addSearchLoading}<Spinner size="4" class="mr-1" />{/if}Search
                </Button>
            </div>
        </div>
        <div>
            <Label for="addLinkUrl" class="mb-2">Link ID</Label>
            <Input
                type="text"
                id="addLinkUrl"
                name="addLinkUrl"
                placeholder="Enter link identifier"
                bind:value={addLinkUrl}
            />
        </div>
        {#if addSearchDone}
            {#if addCandidates.length > 0}
                <ul class="border border-gray-200 dark:border-gray-600 rounded max-h-40 overflow-y-auto text-sm">
                    {#each addCandidates as candidate (candidate.id)}
                        <li>
                            <button type="button" class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
                                onclick={() => { addLinkUrl = candidate.id; addSearchDone = false; }}>
                                {candidate.name}{#if candidate.date} <span class="text-gray-400">({candidate.date})</span>{/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="text-sm text-gray-500 dark:text-gray-400">No results found</p>
            {/if}
        {/if}
    </div>
    {#snippet footer()}
        <Button
            color="primary"
            onclick={addLink}
            disabled={addingLink || isLinkInputIncomplete(addLinkType, addLinkUrl)}>
            {#if addingLink}<Spinner size="4" class="mr-1" />{/if}
            {addingLink ? "Adding..." : "Add Link"}
        </Button>
        <Button color="alternative" onclick={() => (openAddLink = false)} disabled={addingLink}>Cancel</Button>
    {/snippet}
</Modal>

<Modal title="Edit Link" bind:open={openEditLink} size="sm">
    <div class="space-y-4">
        <div>
            <Label for="editLinkType" class="mb-2">Link Type</Label>
            <Input
                type="text"
                id="editLinkType"
                readonly
                value={editLinkType ?? ""}
            />
        </div>
        <div>
            <Label for="editSearchQuery" class="mb-2">Search</Label>
            <div class="flex gap-2">
                <Input type="text" id="editSearchQuery" bind:value={editSearchQuery} class="flex-1" />
                <Button size="sm" color="light" disabled={editSearchLoading} onclick={() => searchCandidates('edit')}>
                    {#if editSearchLoading}<Spinner size="4" class="mr-1" />{/if}Search
                </Button>
            </div>
        </div>
        <div>
            <Label for="editLinkUrl" class="mb-2">Link ID</Label>
            <Input
                type="text"
                id="editLinkUrl"
                name="editLinkUrl"
                placeholder="Enter link identifier"
                bind:value={editLinkUrl}
            />
        </div>
        {#if editSearchDone}
            {#if editCandidates.length > 0}
                <ul class="border border-gray-200 dark:border-gray-600 rounded max-h-40 overflow-y-auto text-sm">
                    {#each editCandidates as candidate (candidate.id)}
                        <li>
                            <button type="button" class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700"
                                onclick={() => { editPendingCandidate = candidate; editSearchDone = false; }}>
                                {candidate.name}{#if candidate.date} <span class="text-gray-400">({candidate.date})</span>{/if}
                            </button>
                        </li>
                    {/each}
                </ul>
            {:else}
                <p class="text-sm text-gray-500 dark:text-gray-400">No results found</p>
            {/if}
        {/if}
        {#if editPendingCandidate}
            <div class="text-sm bg-yellow-50 dark:bg-yellow-900 border border-yellow-200 dark:border-yellow-700 rounded p-2 flex items-center justify-between gap-2">
                <span>Replace <strong>{editLinkUrl}</strong> with <strong>{editPendingCandidate.name}</strong>?</span>
                <div class="flex gap-1 shrink-0">
                    <Button size="xs" color="primary" onclick={() => { const p = editPendingCandidate; if (p) { editLinkUrl = p.id; editPendingCandidate = null; editSearchDone = false; } }}>Confirm</Button>
                    <Button size="xs" color="alternative" onclick={() => { editPendingCandidate = null; }}>Cancel</Button>
                </div>
            </div>
        {/if}
    </div>
    {#snippet footer()}
        <Button
            color="primary"
            onclick={updateLink}
            disabled={isLinkInputIncomplete(editLinkType, editLinkUrl)}>
            Edit Link
        </Button>
        {#if canEdit && editLinkRemovable}
            <Button color="red" onclick={removeLink}>Remove</Button>
        {/if}
        <Button color="alternative" onclick={() => (openEditLink = false)}>Cancel</Button>
    {/snippet}
</Modal>
