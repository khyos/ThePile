<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import { TimeUtil } from '#lib/util/TimeUtil';

    export let items: { title: string; duration: number; type: ArtifactType }[];

    const TYPE_LABEL: Record<string, string> = {
        [ArtifactType.GAME]:   'Game',
        [ArtifactType.MOVIE]:  'Movie',
        [ArtifactType.TVSHOW]: 'TV Show',
        [ArtifactType.ANIME]:  'Anime',
        [ArtifactType.MANGA]:  'Manga'
    };
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Longest items</p>
    <div class="flex flex-col gap-3">
        {#each items as item, i (i)}
            <div class="flex items-center gap-3 bg-white/10 rounded-xl px-4 py-3">
                <span class="text-white/40 text-sm w-4 shrink-0">{i + 1}</span>
                <div class="flex-1 text-left min-w-0">
                    <p class="text-white font-semibold text-sm truncate">{item.title}</p>
                    <p class="text-white/40 text-xs">{TYPE_LABEL[item.type] ?? item.type}</p>
                </div>
                {#if item.duration > 0}
                    <span class="text-white font-bold text-sm shrink-0">{TimeUtil.formatDuration(item.duration)}</span>
                {:else}
                    <span class="text-white/40 text-xs shrink-0">No duration</span>
                {/if}
            </div>
        {/each}
    </div>
</div>
