<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import { TimeUtil } from '#lib/util/TimeUtil';
    import type { RecapSlide } from '#lib/model/recap/RecapTypes';

    export let slide: Extract<RecapSlide, { kind: 'top_by_type' }>;

    const TYPE_TITLE: Record<string, string> = {
        [ArtifactType.GAME]:   'Top Games',
        [ArtifactType.MOVIE]:  'Top Movies',
        [ArtifactType.TVSHOW]: 'Top TV Shows',
        [ArtifactType.ANIME]:  'Top Anime',
        [ArtifactType.MANGA]:  'Top Manga'
    };
</script>

<div class="w-full max-w-sm overflow-y-auto max-h-screen pb-8">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-6">
        {TYPE_TITLE[slide.mediaType] ?? slide.mediaType}
    </p>

    <div class="flex flex-col gap-2">
        {#each slide.items as item, i (item.id)}
            <div class="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-2">
                <span class="text-white/40 text-sm w-4 shrink-0">{i + 1}</span>
                <span class="text-white/80 text-xl font-black w-10 shrink-0">{item.score}</span>
                <div class="flex-1 text-left min-w-0">
                    <p class="text-white text-sm font-semibold truncate">{item.title}</p>
                    {#if item.duration > 0}
                        <p class="text-white/40 text-xs">{TimeUtil.formatDuration(item.duration)}</p>
                    {/if}
                </div>
            </div>
        {/each}
    </div>
</div>
