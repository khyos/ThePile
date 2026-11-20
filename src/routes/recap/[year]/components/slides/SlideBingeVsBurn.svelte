<script lang="ts">
    import type { RecapSlide } from '#lib/model/recap/RecapTypes';

    export let slide: Extract<RecapSlide, { kind: 'binge_vs_burn' }>;

    $: total = slide.bingeCount + slide.midCount + slide.burnCount;
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Binge vs slow burn</p>

    <div class="grid grid-cols-3 gap-3">
        <div class="bg-amber-500/20 rounded-2xl p-5">
            <p class="text-amber-300 text-xs uppercase tracking-wider mb-2">Binge</p>
            <p class="text-white text-4xl font-black">{slide.bingeCount}</p>
            <p class="text-white/40 text-xs mt-2">≤ 7 days</p>
        </div>
        <div class="bg-white/10 rounded-2xl p-5">
            <p class="text-white/60 text-xs uppercase tracking-wider mb-2">Mid</p>
            <p class="text-white text-4xl font-black">{slide.midCount}</p>
            <p class="text-white/40 text-xs mt-2">1 wk–1 mo</p>
        </div>
        <div class="bg-violet-500/20 rounded-2xl p-5">
            <p class="text-violet-300 text-xs uppercase tracking-wider mb-2">Slow burn</p>
            <p class="text-white text-4xl font-black">{slide.burnCount}</p>
            <p class="text-white/40 text-xs mt-2">&gt; 1 month</p>
        </div>
    </div>

    {#if total > 0}
        <p class="text-white/30 text-xs mt-6">based on {total} tracked items</p>
    {/if}
</div>
