<script lang="ts">
    import { goto } from '$app/navigation';
    import { resolve } from '$app/paths';
    import { ArtifactType } from '#lib/model/Artifact';
    import { getLinkTypeLabel, getLinkTypesByArtifactType } from '#lib/model/Link';
    import {
        Table,
        TableBody,
        TableBodyCell,
        TableBodyRow,
        TableHead,
        TableHeadCell,
    } from 'flowbite-svelte';
    import { CheckCircleSolid, LinkOutline, SearchOutline } from 'flowbite-svelte-icons';
    import type { PageData } from './$types';

    export let data: PageData;

    type BulkLinkRow = {
        id: number;
        title: string;
        inputValue: string;
        searchLoading: boolean;
        candidates: { id: string; name: string; date?: string }[];
        showCandidates: boolean;
        saveLoading: boolean;
        done: boolean;
        error: string | null;
    };

    const artifactTypeOptions = [
        { value: ArtifactType.GAME, name: 'Games' },
        { value: ArtifactType.MOVIE, name: 'Movies' },
        { value: ArtifactType.TVSHOW, name: 'TV Shows' },
        { value: ArtifactType.ANIME, name: 'Anime' },
        { value: ArtifactType.MANGA, name: 'Manga' },
    ];

    let selectedType: string = data.type;
    let selectedLinkType: string = data.linkType;
    let rows: BulkLinkRow[] = [];

    $: availableLinkTypes = selectedType
        ? getLinkTypesByArtifactType(selectedType as ArtifactType).map(lt => ({
              value: lt,
              name: getLinkTypeLabel(lt),
          }))
        : [];

    $: {
        selectedType = data.type;
        selectedLinkType = data.linkType;
        rows = data.artifacts.map(a => ({
            id: a.id,
            title: a.title,
            inputValue: '',
            searchLoading: false,
            candidates: [],
            showCandidates: false,
            saveLoading: false,
            done: false,
            error: null,
        }));
    }

    function onTypeChange() {
        selectedLinkType = '';
        // eslint-disable-next-line svelte/no-navigation-without-resolve
        goto(resolve('/tools/bulk-link') + '?' + new URLSearchParams({ type: selectedType, linkType: '' }));
    }

    function onLinkTypeChange() {
        if (selectedType && selectedLinkType) {
            // eslint-disable-next-line svelte/no-navigation-without-resolve
            goto(resolve('/tools/bulk-link') + '?' + new URLSearchParams({ type: selectedType, linkType: selectedLinkType }));
        }
    }

    async function search(row: BulkLinkRow) {
        row.searchLoading = true;
        row.showCandidates = false;
        row.candidates = [];
        rows = rows;
        try {
            const params = new URLSearchParams({
                artifactType: selectedType,
                linkType: selectedLinkType,
                query: row.title,
            });
            const res = await fetch(`/api/artifacts/link-candidates?${params}`);
            if (res.ok) {
                const body = await res.json();
                row.candidates = body.results ?? [];
                row.showCandidates = true;
            }
        } catch {
            // silent failure — candidates stay empty
        } finally {
            row.searchLoading = false;
            rows = rows;
        }
    }

    function selectCandidate(row: BulkLinkRow, candidate: { id: string; name: string; date?: string }) {
        row.inputValue = candidate.id;
        row.showCandidates = false;
        rows = rows;
    }

    async function save(row: BulkLinkRow) {
        row.error = null;
        row.saveLoading = true;
        rows = rows;
        try {
            const res = await fetch(`/api/${selectedType}/${row.id}/link`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ type: selectedLinkType, url: row.inputValue }),
            });
            if (res.ok) {
                row.done = true;
            } else {
                const body = await res.json().catch(() => ({}));
                row.error = body?.message ?? `Error ${res.status}`;
            }
        } catch {
            row.error = 'Network error.';
        } finally {
            row.saveLoading = false;
            rows = rows;
        }
    }

    $: pendingRows = rows.filter(r => !r.done);
</script>

<svelte:head>
    <title>ThePile - Bulk Link</title>
</svelte:head>

<div class="p-4 max-w-6xl mx-auto">
    <h1 class="text-2xl font-bold mb-2 dark:text-white">Bulk Link</h1>
    <p class="text-sm text-gray-500 dark:text-gray-400 mb-6">
        Find all entries of a given type that are missing a specific external link, then add them in bulk.
    </p>

    <!-- Selector bar -->
    <div class="flex flex-wrap items-center gap-4 mb-6">
        <div class="flex items-center gap-2">
            <label for="artifact-type-select" class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Artifact type
            </label>
            <select
                id="artifact-type-select"
                bind:value={selectedType}
                on:change={onTypeChange}
                class="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
                <option value="">Choose type…</option>
                {#each artifactTypeOptions as opt (opt.value)}
                    <option value={opt.value}>{opt.name}</option>
                {/each}
            </select>
        </div>

        <div class="flex items-center gap-2">
            <label for="link-type-select" class="text-sm font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">
                Link type
            </label>
            <select
                id="link-type-select"
                bind:value={selectedLinkType}
                on:change={onLinkTypeChange}
                disabled={!selectedType}
                class="rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <option value="">Choose link…</option>
                {#each availableLinkTypes as opt (opt.value)}
                    <option value={opt.value}>{opt.name}</option>
                {/each}
            </select>
        </div>
    </div>

    {#if !selectedType || !selectedLinkType}
        <div class="flex items-center gap-2 p-4 rounded-lg bg-blue-50 dark:bg-blue-900 border border-blue-200 dark:border-blue-700">
            <LinkOutline class="w-5 h-5 text-blue-600 dark:text-blue-300 shrink-0" />
            <p class="text-blue-700 dark:text-blue-200 text-sm">
                Select an artifact type and a link type to see entries with missing links.
            </p>
        </div>
    {:else if rows.length === 0}
        <div class="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700">
            <CheckCircleSolid class="w-5 h-5 text-green-600 dark:text-green-300" />
            <p class="text-green-700 dark:text-green-200">
                No missing links — every entry already has this link type.
            </p>
        </div>
    {:else}
        {#if pendingRows.length === 0}
            <div class="flex items-center gap-2 p-4 rounded-lg bg-green-50 dark:bg-green-900 border border-green-200 dark:border-green-700 mb-6">
                <CheckCircleSolid class="w-5 h-5 text-green-600 dark:text-green-300" />
                <p class="text-green-700 dark:text-green-200">All done!</p>
            </div>
        {/if}

        <Table>
            <TableHead>
                <TableHeadCell>Title</TableHeadCell>
                <TableHeadCell>Link value</TableHeadCell>
                <TableHeadCell></TableHeadCell>
            </TableHead>
            <TableBody>
                {#each rows as row (row.id)}
                    <TableBodyRow class={row.done ? 'opacity-50' : ''}>
                        <TableBodyCell>
                            <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
                            <a href="/{selectedType}/{row.id}" class="font-medium text-blue-600 dark:text-blue-400 hover:underline">{row.title}</a>
                        </TableBodyCell>
                        <TableBodyCell>
                            {#if row.done}
                                <span class="text-gray-400 dark:text-gray-500 text-sm">{row.inputValue}</span>
                            {:else}
                                <div class="relative">
                                    <input
                                        type="text"
                                        bind:value={row.inputValue}
                                        placeholder="Paste or search for an ID…"
                                        class="w-full rounded border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm text-gray-900 dark:text-white px-2 py-1 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                    />
                                    {#if row.showCandidates && row.candidates.length > 0}
                                        <ul class="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 shadow-lg text-sm">
                                            {#each row.candidates as candidate (candidate.id)}
                                                <li>
                                                    <button
                                                        type="button"
                                                        class="w-full text-left px-3 py-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-900 dark:text-white"
                                                        on:click={() => selectCandidate(row, candidate)}
                                                    >
                                                        {candidate.name}{#if candidate.date} <span class="text-gray-400">({candidate.date})</span>{/if}
                                                    </button>
                                                </li>
                                            {/each}
                                        </ul>
                                    {/if}
                                    {#if row.showCandidates && row.candidates.length === 0}
                                        <p class="text-xs text-gray-500 dark:text-gray-400 mt-1">No results found</p>
                                    {/if}
                                </div>
                            {/if}
                        </TableBodyCell>
                        <TableBodyCell>
                            {#if row.done}
                                <div class="flex items-center gap-1 text-green-600 dark:text-green-400">
                                    <CheckCircleSolid class="w-4 h-4" />
                                    <span class="text-sm">Done</span>
                                </div>
                            {:else}
                                <div class="flex flex-col gap-1">
                                    <div class="flex items-center gap-2">
                                        <button
                                            type="button"
                                            class="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={row.searchLoading}
                                            on:click={() => search(row)}
                                        >
                                            <SearchOutline class="w-3 h-3 mr-1" />
                                            {row.searchLoading ? 'Searching…' : 'Search'}
                                        </button>
                                        <button
                                            type="button"
                                            class="inline-flex items-center px-2.5 py-1.5 text-xs font-medium rounded bg-primary-600 text-white hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!row.inputValue || row.saveLoading}
                                            on:click={() => save(row)}
                                        >
                                            <LinkOutline class="w-3 h-3 mr-1" />
                                            {row.saveLoading ? 'Saving…' : 'Save'}
                                        </button>
                                    </div>
                                    {#if row.error}
                                        <p class="text-xs text-red-500">{row.error}</p>
                                    {/if}
                                </div>
                            {/if}
                        </TableBodyCell>
                    </TableBodyRow>
                {/each}
            </TableBody>
        </Table>
    {/if}
</div>
