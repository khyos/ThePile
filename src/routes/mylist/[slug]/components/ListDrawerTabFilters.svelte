<script lang="ts">
    import {
        Label,
        MultiSelect,
        Range,
        TabItem
    } from "flowbite-svelte";
    import DoubleRange from "#lib/ui/DoubleRange.svelte";
    import { ArtifactType } from "#lib/model/Artifact";
    import { UserArtifactStatus } from "#lib/model/UserArtifact";
    import type { Genre } from "#lib/model/Genre";
    import type { Platform } from "#lib/model/game/Platform";
    import { userListStore } from "../stores/UserListStore";

    export let genres: Genre[] = [];
    export let platforms: Platform[] = [];

    $: userListStoreInst = $userListStore;

    const statusItems = [
        { value: UserArtifactStatus.DROPPED, name: 'Dropped' },
        { value: UserArtifactStatus.FINISHED, name: 'Finished' },
        { value: UserArtifactStatus.ON_GOING, name: 'On going' },
        { value: UserArtifactStatus.ON_HOLD, name: 'On hold' },
        { value: UserArtifactStatus.WISHLIST, name: 'Wishlist' },
    ];

    let genreItems = genres.map((genre) => { return { value: genre.id, name: genre.title } }) ;
    let platformItems = platforms.map((platform) => { return { value: platform.id, name: platform.title } }) ;

    const formatDurationDisplay = (duration: number) => {
        if (userListStoreInst.userList.artifactType === ArtifactType.GAME || userListStoreInst.userList.artifactType === ArtifactType.TVSHOW) {
            if (duration === userListStoreInst.userListFilters.duration.absoluteMax) return "No limit";
            return `${duration}h`;
        } else if (userListStoreInst.userList.artifactType === ArtifactType.MOVIE) {
            if (duration === userListStoreInst.userListFilters.duration.absoluteMax) return "No limit";
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            return `${hours}h ${minutes}m`;
        }
    };
</script>

<TabItem key="filters" title="Filters" class="w-full">
    <Label class="block mb-1 mt-2">Filter Genre</Label>
    <MultiSelect items={genreItems} bind:value={$userListStore.userListFilters.genres.included} />
    <Label class="block mb-1 mt-2">Exclude Genre</Label>
    <MultiSelect items={genreItems} bind:value={$userListStore.userListFilters.genres.excluded} />
    <Label class="block mb-1 mt-2">Status</Label>
    <MultiSelect items={statusItems} bind:value={$userListStore.userListFilters.status.included} />
    <Label class="block mb-1 mt-2"
        >Score: {$userListStore.userListFilters.score.min} to {$userListStore.userListFilters.score.max}</Label
    >
    <DoubleRange
        min={0}
        max={100}
        step={1}
        bind:minValue={$userListStore.userListFilters.score.min}
        bind:maxValue={$userListStore.userListFilters.score.max}
    />
    <Label class="block mb-1 mt-2"
        >Release Date: {$userListStore.userListFilters.releaseDate.min} to {$userListStore.userListFilters.releaseDate.max}</Label
    >
    <DoubleRange
        min={$userListStore.userListFilters.releaseDate.absoluteMin}
        max={$userListStore.userListFilters.releaseDate.absoluteMax}
        step={1}
        bind:minValue={$userListStore.userListFilters.releaseDate.min}
        bind:maxValue={$userListStore.userListFilters.releaseDate.max}
    />
    <Label class="block mb-1 mt-2"
        >Start Date: {$userListStore.userListFilters.startDate.min} to {$userListStore.userListFilters.startDate.max}</Label
    >
    <DoubleRange
        min={$userListStore.userListFilters.startDate.absoluteMin}
        max={$userListStore.userListFilters.startDate.absoluteMax}
        step={1}
        bind:minValue={$userListStore.userListFilters.startDate.min}
        bind:maxValue={$userListStore.userListFilters.startDate.max}
    />
    <Label class="block mb-1 mt-2"
        >End Date: {$userListStore.userListFilters.endDate.min} to {$userListStore.userListFilters.endDate.max}</Label
    >
    <DoubleRange
        min={$userListStore.userListFilters.endDate.absoluteMin}
        max={$userListStore.userListFilters.endDate.absoluteMax}
        step={1}
        bind:minValue={$userListStore.userListFilters.endDate.min}
        bind:maxValue={$userListStore.userListFilters.endDate.max}
    />
    <Label class="block mb-1 mt-2"
        >Max Duration: {formatDurationDisplay($userListStore.userListFilters.duration.max)}</Label
    >
    <Range class="appearance-auto" min="0" max={$userListStore.userListFilters.duration.absoluteMax} step="1" bind:value={$userListStore.userListFilters.duration.max} />
    <Label class="block mb-1 mt-2">Min Rating: {$userListStore.userListFilters.rating.min}</Label>
    <Range class="appearance-auto" min="0" max="100" step="1" bind:value={$userListStore.userListFilters.rating.min} />
    {#if $userListStore.userListFilters.platforms}
        <Label class="block mb-1 mt-2">Platform</Label>
        <MultiSelect
            items={platformItems}
            bind:value={$userListStore.userListFilters.platforms.included}
        />
    {/if}
</TabItem>