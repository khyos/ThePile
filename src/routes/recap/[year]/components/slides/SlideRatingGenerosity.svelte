<script lang="ts">
    import type { RecapSlide } from '#lib/model/recap/RecapTypes';

    export let slide: Extract<RecapSlide, { kind: 'rating_generosity' }>;

    $: diff = slide.priorAvg !== null ? Math.round((slide.currentAvg - slide.priorAvg) * 10) / 10 : null;
    $: diffLabel = diff !== null
        ? diff > 0 ? `+${diff.toFixed(1)} pts vs last year` : `${diff.toFixed(1)} pts vs last year`
        : null;
    $: verdict = diff !== null && diff > 0 ? 'You were more generous this year' : diff !== null && diff < 0 ? 'You were harder to please this year' : null;
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Rating generosity</p>

    <div class="mb-6">
        <p class="text-white/40 text-sm mb-2">Your average score</p>
        <p class="text-white text-7xl font-black">{slide.currentAvg.toFixed(1)}</p>
    </div>

    {#if diffLabel}
        <div class="bg-white/10 rounded-2xl p-4 mb-4">
            <p class="text-white/80 text-lg font-semibold">{diffLabel}</p>
        </div>
    {/if}

    {#if verdict}
        <p class="text-white/50 text-sm">{verdict}</p>
    {/if}

    {#if slide.priorAvg === null}
        <p class="text-white/30 text-xs mt-4">No prior year data to compare</p>
    {/if}
</div>
