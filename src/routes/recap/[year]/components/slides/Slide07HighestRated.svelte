<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import type { ItemRef } from '#lib/model/recap/RecapTypes';

    export let topOverall: ItemRef[];

    const TYPE_LABEL: Record<string, string> = {
        [ArtifactType.GAME]:   'Game',
        [ArtifactType.MOVIE]:  'Movie',
        [ArtifactType.TVSHOW]: 'TV Show',
        [ArtifactType.ANIME]:  'Anime',
        [ArtifactType.MANGA]:  'Manga'
    };
</script>

<div class="w-full max-w-sm overflow-y-auto max-h-screen pb-8">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-6">Highest rated</p>

    <p class="text-white/50 text-xs uppercase tracking-wider text-center mb-3">Top 5 overall</p>
    <div class="flex flex-col gap-2">
        {#each topOverall as item, i (item.id)}
            <div class="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2">
                <span class="text-white/40 text-sm w-4 shrink-0">{i + 1}</span>
                <span class="text-white/80 text-xl font-black w-10 shrink-0">{item.score}</span>
                <div class="flex-1 text-left min-w-0">
                    <p class="text-white text-sm font-semibold truncate">{item.title}</p>
                    <p class="text-white/40 text-xs">{TYPE_LABEL[item.type] ?? item.type}</p>
                </div>
            </div>
        {/each}
    </div>
</div>
