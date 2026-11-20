<script lang="ts">
    import type { ScoreBand } from '#lib/model/recap/RecapTypes';

    export let bands: ScoreBand[];

    $: total = bands.reduce((s, b) => s + b.count, 0);

    function bandColorClass(label: string): string {
        if (label === 'Unscored') return 'bg-gray-500';
        const lower = parseInt(label.split('–')[0]);
        if (lower >= 86) return 'bg-emerald-500';
        if (lower >= 66) return 'bg-blue-500';
        if (lower >= 46) return 'bg-yellow-500';
        if (lower >= 26) return 'bg-orange-500';
        return 'bg-red-500';
    }
</script>

<div class="w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-8">Score breakdown</p>
    <div class="flex flex-col gap-2">
        {#each bands as band (band.label)}
            <div class="flex items-center gap-3">
                <span class="w-16 text-right text-white/70 text-xs">{band.label}</span>
                <div class="flex-1 bg-white/10 rounded-full h-3 overflow-hidden">
                    <div
                        class="h-full rounded-full {bandColorClass(band.label)}"
                        style="width: {total > 0 ? Math.round((band.count / total) * 100) : 0}%"
                    ></div>
                </div>
                <span class="w-8 text-white font-bold text-sm text-right">{band.count}</span>
            </div>
        {/each}
    </div>
</div>
