<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import BarChart from '#lib/ui/BarChart.svelte';
    import type { RecapSlide } from '#lib/model/recap/RecapTypes';

    export let slide: Extract<RecapSlide, { kind: 'avg_score_by_type' }>;

    const TYPE_LABEL: Record<string, string> = {
        [ArtifactType.GAME]:   'Game',
        [ArtifactType.MOVIE]:  'Movie',
        [ArtifactType.TVSHOW]: 'TV',
        [ArtifactType.ANIME]:  'Anime',
        [ArtifactType.MANGA]:  'Manga'
    };

    $: bars = slide.scores.map(s => ({
        label: TYPE_LABEL[s.type] ?? s.type,
        showLabel: true,
        value: s.avg
    }));
</script>

<div class="w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-6">Average score by type</p>

    <div class="bg-white/5 rounded-2xl p-4 mb-4">
        <BarChart {bars} color="#a78bfa" height={180} />
    </div>

    <div class="flex flex-col gap-2">
        {#each slide.scores as s (s.type)}
            <div class="flex items-center justify-between px-2">
                <span class="text-white/60 text-sm">{TYPE_LABEL[s.type] ?? s.type}</span>
                <span class="text-white font-bold text-sm">{s.avg.toFixed(1)} <span class="text-white/30 font-normal text-xs">({s.count})</span></span>
            </div>
        {/each}
    </div>
</div>
