<script lang="ts">
    export let element: HTMLElement | undefined = undefined;
</script>

<div bind:this={element} class="h-screen snap-start flex flex-col items-center justify-center px-6">
    <slot />
</div>
