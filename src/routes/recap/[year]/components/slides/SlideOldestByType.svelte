<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import type { RecapSlide } from '#lib/model/recap/RecapTypes';

    export let slide: Extract<RecapSlide, { kind: 'oldest_by_type' }>;

    const TYPE_LABEL: Record<string, string> = {
        [ArtifactType.GAME]:   'Game',
        [ArtifactType.MOVIE]:  'Movie',
        [ArtifactType.TVSHOW]: 'TV Show',
        [ArtifactType.ANIME]:  'Anime',
        [ArtifactType.MANGA]:  'Manga'
    };
</script>

<div class="w-full max-w-sm overflow-y-auto max-h-screen pb-8">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-6">Oldest completions</p>
    <p class="text-white/40 text-xs text-center mb-4">Biggest gap between release and when you finished it</p>

    <div class="flex flex-col gap-3">
        {#each slide.items as item (item.type)}
            <div class="bg-white/10 rounded-xl px-4 py-3">
                <div class="flex items-center justify-between mb-1">
                    <p class="text-white/50 text-xs uppercase tracking-wider">{TYPE_LABEL[item.type] ?? item.type}</p>
                    <span class="text-amber-300 text-xs font-semibold">{item.gapYears} years later</span>
                </div>
                <p class="text-white font-semibold text-sm truncate">{item.title}</p>
                <p class="text-white/40 text-xs mt-1">Released {item.releaseYear} · Finished {item.finishedYear}</p>
            </div>
        {/each}
    </div>
</div>
