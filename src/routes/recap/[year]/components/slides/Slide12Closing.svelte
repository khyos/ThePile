<script lang="ts">
    export let totalCount: number;
    export let year: number;
</script>

<div class="text-center">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-4">That wraps up</p>
    <h2 class="text-6xl font-black text-white mb-6">{year}</h2>
    <p class="text-white/80 text-xl mb-8">
        {totalCount} {totalCount === 1 ? 'item' : 'items'} finished
    </p>
    <!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
    <a href="/" class="inline-block px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors text-sm">Back to your backlog</a>
</div>
