<script lang="ts">
    import { ArtifactType } from '#lib/model/Artifact';
    import type { TypeCount } from '#lib/model/recap/RecapTypes';
    import BarChart from '#lib/ui/BarChart.svelte';

    export let counts: TypeCount[];
    export let mediaType: ArtifactType;

    const TYPE_LABEL: Record<string, string> = {
        [ArtifactType.GAME]:   'Games',
        [ArtifactType.MOVIE]:  'Movies',
        [ArtifactType.TVSHOW]: 'TV Shows',
        [ArtifactType.ANIME]:  'Anime',
        [ArtifactType.MANGA]:  'Manga'
    };

    $: countBars = counts.map(tc => ({ label: TYPE_LABEL[tc.type] ?? tc.type, showLabel: true, value: tc.count }));
    $: hourBars = counts.map(tc => ({ label: TYPE_LABEL[tc.type] ?? tc.type, showLabel: true, value: Math.round(tc.totalDuration / 3600) }));
</script>

<div class="w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-2">Your media type</p>
    <p class="text-white text-3xl font-black text-center mb-8">{TYPE_LABEL[mediaType] ?? mediaType}</p>

    <div class="mb-6">
        <p class="text-white/60 text-xs uppercase tracking-widest text-center mb-2">Items finished</p>
        <BarChart bars={countBars} color="#8b5cf6" height={180} />
    </div>

    <div>
        <p class="text-white/60 text-xs uppercase tracking-widest text-center mb-2">Hours spent</p>
        <BarChart bars={hourBars} color="#3b82f6" height={180} />
    </div>
</div>
