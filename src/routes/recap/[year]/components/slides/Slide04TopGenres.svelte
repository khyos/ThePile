<script lang="ts">
    export let genres: { name: string; count: number }[];

    const MEDALS = ['🥇', '🥈', '🥉'];
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Your top genres</p>
    <div class="flex flex-col gap-6">
        {#each genres as genre, i (genre.name)}
            <div class="flex items-center gap-4">
                <span class="text-2xl w-8">{MEDALS[i] ?? ''}</span>
                <span class="flex-1 text-white text-xl font-semibold text-left">{genre.name}</span>
                <span class="text-white/60 text-lg">{genre.count}</span>
            </div>
        {/each}
    </div>
</div>
