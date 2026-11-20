<script lang="ts">
    export let count: number;
    export let activeIndex: number;
    export let onDotClick: (index: number) => void;
</script>

<div class="fixed right-4 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-2">
    {#each Array.from({ length: count }, (_, i) => i) as i (i)}
        <button
            aria-label="Go to slide {i + 1}"
            on:click={() => onDotClick(i)}
            class="w-2.5 h-2.5 rounded-full transition-all duration-200 {i === activeIndex
                ? 'bg-white scale-125'
                : 'bg-white/40 hover:bg-white/70'}"
        ></button>
    {/each}
</div>
