<script lang="ts">
    import type { PageData } from './$types';
    import SlideWrapper from './components/SlideWrapper.svelte';
    import YearNavigator from './components/YearNavigator.svelte';
    import DotIndicator from './components/DotIndicator.svelte';
    import Slide01Opening from './components/slides/Slide01Opening.svelte';
    import SlideEmpty from './components/slides/SlideEmpty.svelte';
    import Slide02GrandTotal from './components/slides/Slide02GrandTotal.svelte';
    import Slide03ByType from './components/slides/Slide03ByType.svelte';
    import Slide04TopGenres from './components/slides/Slide04TopGenres.svelte';
    import Slide05Monthly from './components/slides/Slide05Monthly.svelte';
    import Slide06YearComparison from './components/slides/Slide06YearComparison.svelte';
    import Slide07HighestRated from './components/slides/Slide07HighestRated.svelte';
    import Slide08ScoreDist from './components/slides/Slide08ScoreDist.svelte';
    import Slide10Longest from './components/slides/Slide10Longest.svelte';
    import Slide11ClassicsVsNew from './components/slides/Slide11ClassicsVsNew.svelte';
    import Slide12Closing from './components/slides/Slide12Closing.svelte';
    import SlideTopByType from './components/slides/SlideTopByType.svelte';
    import SlideBingeVsBurn from './components/slides/SlideBingeVsBurn.svelte';
    import SlideRatingGenerosity from './components/slides/SlideRatingGenerosity.svelte';
    import SlideOldestByType from './components/slides/SlideOldestByType.svelte';
    import SlideAvgScoreByType from './components/slides/SlideAvgScoreByType.svelte';
    import SlideBestWeek from './components/slides/SlideBestWeek.svelte';
    import { onMount } from 'svelte';

    export let data: PageData;

    let slideElements: (HTMLElement | undefined)[] = [];
    let activeIndex = 0;
    let containerEl: HTMLElement;

    function scrollToSlide(index: number) {
        const el = slideElements[index];
        if (el) {
            el.scrollIntoView({ behavior: 'smooth' });
        }
    }

    function handleKeydown(e: KeyboardEvent) {
        if (e.key === 'ArrowDown' || e.key === 'ArrowRight') {
            e.preventDefault();
            if (activeIndex < data.slides.length - 1) scrollToSlide(activeIndex + 1);
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') {
            e.preventDefault();
            if (activeIndex > 0) scrollToSlide(activeIndex - 1);
        }
    }

    let touchStartY = 0;

    function handleTouchStart(e: TouchEvent) {
        touchStartY = e.touches[0].clientY;
    }

    function handleTouchEnd(e: TouchEvent) {
        const dy = touchStartY - e.changedTouches[0].clientY;
        if (Math.abs(dy) < 40) return;
        if (dy > 0 && activeIndex < data.slides.length - 1) {
            scrollToSlide(activeIndex + 1);
        } else if (dy < 0 && activeIndex > 0) {
            scrollToSlide(activeIndex - 1);
        }
    }

    onMount(() => {
        const observers: IntersectionObserver[] = [];

        slideElements.forEach((el, i) => {
            if (!el) return;
            const obs = new IntersectionObserver(
                (entries) => {
                    if (entries[0].isIntersecting) activeIndex = i;
                },
                { threshold: 0.5 }
            );
            obs.observe(el);
            observers.push(obs);
        });

        return () => observers.forEach(o => o.disconnect());
    });
</script>

<svelte:window on:keydown={handleKeydown} />

<!-- Dark gradient background covering the full page -->
<div
    class="fixed inset-0 bg-gradient-to-br from-gray-950 via-indigo-950 to-gray-950 -z-10"
></div>

<YearNavigator year={data.year} currentYear={data.currentYear} />
<DotIndicator count={data.slides.length} {activeIndex} onDotClick={scrollToSlide} />

<main
    bind:this={containerEl}
    class="h-screen overflow-y-scroll snap-y snap-mandatory"
    on:touchstart={handleTouchStart}
    on:touchend={handleTouchEnd}
>
    {#each data.slides as slide, i (i)}
        <SlideWrapper bind:element={slideElements[i]}>
            {#if slide.kind === 'opening'}
                <Slide01Opening year={slide.year} />
            {:else if slide.kind === 'empty'}
                <SlideEmpty year={slide.year} />
            {:else if slide.kind === 'grand_total'}
                <Slide02GrandTotal totalCount={slide.totalCount} totalDuration={slide.totalDuration} />
            {:else if slide.kind === 'by_type'}
                <Slide03ByType counts={slide.counts} mediaType={slide.mediaType} />
            {:else if slide.kind === 'top_genres'}
                <Slide04TopGenres genres={slide.genres} />
            {:else if slide.kind === 'monthly'}
                <Slide05Monthly bars={slide.bars} />
            {:else if slide.kind === 'year_comparison'}
                <Slide06YearComparison current={slide.current} prior={slide.prior} />
            {:else if slide.kind === 'highest_rated'}
                <Slide07HighestRated topOverall={slide.topOverall} />
            {:else if slide.kind === 'top_by_type'}
                <SlideTopByType {slide} />
            {:else if slide.kind === 'score_dist'}
                <Slide08ScoreDist bands={slide.bands} />
            {:else if slide.kind === 'longest'}
                <Slide10Longest items={slide.items} />
            {:else if slide.kind === 'classics_vs_new'}
                <Slide11ClassicsVsNew newCount={slide.newCount} recentCount={slide.recentCount} classicCount={slide.classicCount} />
            {:else if slide.kind === 'binge_vs_burn'}
                <SlideBingeVsBurn {slide} />
            {:else if slide.kind === 'rating_generosity'}
                <SlideRatingGenerosity {slide} />
            {:else if slide.kind === 'oldest_by_type'}
                <SlideOldestByType {slide} />
            {:else if slide.kind === 'avg_score_by_type'}
                <SlideAvgScoreByType {slide} />
            {:else if slide.kind === 'best_week'}
                <SlideBestWeek {slide} />
            {:else if slide.kind === 'closing'}
                <Slide12Closing totalCount={slide.totalCount} year={slide.year} />
            {/if}
        </SlideWrapper>
    {/each}
</main>
