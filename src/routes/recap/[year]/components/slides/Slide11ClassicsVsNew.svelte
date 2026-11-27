<script lang="ts">
    export let newCount: number;
    export let recentCount: number;
    export let classicCount: number;

    $: total = newCount + recentCount + classicCount;
    $: newPct = total > 0 ? Math.round((newCount / total) * 100) : 0;
    $: recentPct = total > 0 ? Math.round((recentCount / total) * 100) : 0;
    $: classicPct = total > 0 ? 100 - newPct - recentPct : 0;
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Classics vs new releases</p>

    {#if total > 0}
        <div class="relative h-6 rounded-full overflow-hidden bg-white/10 mb-6 flex">
            <div
                class="h-full bg-violet-500 transition-all"
                style="width: {classicPct}%"
            ></div>
            <div
                class="h-full bg-sky-400 transition-all"
                style="width: {recentPct}%"
            ></div>
            <div
                class="h-full bg-amber-400 transition-all"
                style="width: {newPct}%"
            ></div>
        </div>

        <div class="grid grid-cols-3 gap-4">
            <div class="bg-violet-500/20 rounded-2xl p-5">
                <p class="text-violet-300 text-xs uppercase tracking-wider mb-2">Classics</p>
                <p class="text-white text-4xl font-black">{classicCount}</p>
                <p class="text-white/40 text-xs mt-1">{classicPct}%</p>
            </div>
            <div class="bg-sky-400/20 rounded-2xl p-5">
                <p class="text-sky-300 text-xs uppercase tracking-wider">Recent</p>
                <p class="text-white text-4xl font-black">{recentCount}</p>
                <p class="text-white/40 text-xs mt-1 mb-2">{recentPct}%</p>
                <p class="text-sky-300 text-xs tracking-wider">(last 10 years)</p>
            </div>
            <div class="bg-amber-400/20 rounded-2xl p-5">
                <p class="text-amber-300 text-xs uppercase tracking-wider mb-2">New releases</p>
                <p class="text-white text-4xl font-black">{newCount}</p>
                <p class="text-white/40 text-xs mt-1">{newPct}%</p>
            </div>
        </div>
    {:else}
        <p class="text-white/40">No data</p>
    {/if}
</div>
