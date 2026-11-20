<script lang="ts">
    export let year: number;
    export let currentYear: number;
</script>

<div class="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4">
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/recap/{year - 1}" class="text-white/70 hover:text-white transition-colors text-sm" aria-label="Previous year">&larr; {year - 1}</a>
    <span class="text-white font-semibold">{year}</span>
    {#if year < currentYear}
        <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
        <a href="/recap/{year + 1}" class="text-white/70 hover:text-white transition-colors text-sm" aria-label="Next year">{year + 1} &rarr;</a>
    {:else}
        <span class="text-white/30 text-sm cursor-not-allowed" aria-disabled="true">{year + 1} &rarr;</span>
    {/if}
</div>
