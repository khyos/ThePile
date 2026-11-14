<script lang="ts">
    import BarChart from '#lib/ui/BarChart.svelte';

    export let bars: { label: string; showLabel: boolean; value: number }[];
</script>

<div class="w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest text-center mb-8">Completions per month</p>
    <div class="bg-white/5 rounded-2xl p-4">
        <BarChart {bars} color="#a78bfa" height={240} />
    </div>
</div>
