<script lang="ts">
    import type { RecapSlide } from '#lib/model/recap/RecapTypes';

    export let slide: Extract<RecapSlide, { kind: 'best_week' }>;

    const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    function formatWeek(startMs: number): string {
        const start = new Date(startMs);
        const end   = new Date(startMs + 6 * 24 * 60 * 60 * 1000);
        const sm = MONTH_SHORT[start.getMonth()];
        const em = MONTH_SHORT[end.getMonth()];
        if (sm === em) {
            return `${sm} ${start.getDate()} – ${end.getDate()}`;
        }
        return `${sm} ${start.getDate()} – ${em} ${end.getDate()}`;
    }

    $: weekLabel = formatWeek(slide.weekStart);
</script>

<div class="text-center w-full max-w-sm">
    <p class="text-white/60 text-sm uppercase tracking-widest mb-8">Your best week</p>

    <div class="bg-white/10 rounded-2xl p-8 mb-6">
        <p class="text-white/50 text-sm mb-2">{weekLabel}</p>
        <p class="text-white text-7xl font-black">{slide.count}</p>
        <p class="text-white/60 text-lg mt-2">{slide.count === 1 ? 'item' : 'items'} finished</p>
    </div>

    <p class="text-white/40 text-sm">That was your most productive 7-day stretch</p>
</div>
