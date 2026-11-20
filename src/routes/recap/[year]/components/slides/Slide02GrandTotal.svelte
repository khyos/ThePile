<script lang="ts">
    import { TimeUtil } from '#lib/util/TimeUtil';

    export let totalCount: number;
    export let totalDuration: number;
</script>

<div class="text-center">
    <p class="text-white/60 text-lg mb-6 uppercase tracking-widest">This year you finished</p>
    <p class="text-8xl font-black text-white mb-2">{totalCount}</p>
    <p class="text-white/80 text-2xl mb-8">
        {totalCount === 1 ? 'item' : 'items'}
    </p>
    {#if totalDuration > 0}
        <p class="text-white/60 text-lg">That is {TimeUtil.formatDuration(totalDuration)} of your life</p>
    {/if}
</div>
