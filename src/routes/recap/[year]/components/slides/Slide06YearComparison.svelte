<script lang="ts">
    import { TimeUtil } from '#lib/util/TimeUtil';
    import type { YearSummary } from '#lib/model/recap/RecapTypes';

    export let current: YearSummary;
    export let prior: YearSummary | null;

    $: countDiff = prior !== null ? current.totalCount - prior.totalCount : null;
    $: durationDiff = prior !== null ? current.totalDuration - prior.totalDuration : null;
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Year over year</p>

    {#if prior === null}
        <p class="text-white text-2xl font-light mb-4">First year tracked!</p>
        <p class="text-white/60">Come back next year to see how you compare.</p>
    {:else}
        <div class="grid grid-cols-2 gap-6">
            <div class="bg-white/10 rounded-2xl p-4">
                <p class="text-white/50 text-xs uppercase tracking-wider mb-1">{prior.year}</p>
                <p class="text-white text-3xl font-bold">{prior.totalCount}</p>
                <p class="text-white/40 text-xs mt-1">{TimeUtil.formatDuration(prior.totalDuration)}</p>
            </div>
            <div class="bg-white/20 rounded-2xl p-4 ring-1 ring-white/30">
                <p class="text-white/50 text-xs uppercase tracking-wider mb-1">{current.year}</p>
                <p class="text-white text-3xl font-bold">{current.totalCount}</p>
                <p class="text-white/40 text-xs mt-1">{TimeUtil.formatDuration(current.totalDuration)}</p>
            </div>
        </div>

        {#if countDiff !== null}
            <p class="mt-6 text-lg font-semibold {countDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}">
                {countDiff >= 0 ? '+' : ''}{countDiff} items
                {countDiff >= 0 ? 'more' : 'fewer'} than last year
            </p>
        {/if}
        {#if durationDiff !== null && Math.abs(durationDiff) > 3600}
            <p class="text-white/50 text-sm mt-1">
                {durationDiff >= 0 ? '+' : ''}{TimeUtil.formatDuration(Math.abs(durationDiff))} in time
            </p>
        {/if}
    {/if}
</div>
