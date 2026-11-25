<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import type { BacklogChangeCount } from '#lib/model/recap/RecapTypes';

    export let counts: BacklogChangeCount[];
    export let year: number;

    const TYPE_LABEL: Record<string, string> = {
        [ArtifactType.GAME]: 'Games',
        [ArtifactType.MOVIE]: 'Movies',
        [ArtifactType.TVSHOW]: 'TV Shows',
        [ArtifactType.ANIME]: 'Anime',
        [ArtifactType.MANGA]: 'Manga'
    };
</script>

<div class="w-full max-w-lg">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-2">Your backlog</p>
    <h2 class="text-white text-3xl font-black text-center mb-2">Backlog changes</h2>
    <p class="text-white/50 text-sm text-center mb-8">Net changes in your backlog for {year}</p>

    <div class="grid grid-cols-4 gap-3 border-b border-white/15 pb-2 mb-2 text-white/50 text-xs uppercase tracking-wider">
        <span class="col-span-1">Type</span>
        <span class="text-right">Added</span>
        <span class="text-right">Removed</span>
        <span class="text-right">Net</span>
    </div>

    <div class="space-y-3">
        {#each counts as count (count.type)}
            <div class="grid grid-cols-4 gap-3 items-center text-sm sm:text-base">
                <span class="text-white">{TYPE_LABEL[count.type] ?? count.type}</span>
                <span class="text-right text-emerald-300">{count.added}</span>
                <span class="text-right text-rose-300">{count.removed}</span>
                <span class:text-emerald-300={count.delta > 0} class:text-rose-300={count.delta < 0} class="text-right font-bold text-white/60">
                    {count.delta > 0 ? '+' : ''}{count.delta}
                </span>
            </div>
        {/each}
    </div>

    <p class="text-white/40 text-xs text-center mt-8">Net = added − removed</p>
</div>
