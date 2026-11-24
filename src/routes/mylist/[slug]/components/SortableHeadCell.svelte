<script lang="ts">
    import { TableHeadCell } from "flowbite-svelte";
    import { UserListOrder, UserListOrderLabel } from "#lib/model/UserList";

    export let type: UserListOrder;
    export let activeType: UserListOrder;
    export let direction: 'asc' | 'desc';
    export let onSort: (type: UserListOrder) => void;
    export let label: string = UserListOrderLabel[type];

    $: isActive = activeType === type;
    $: ariaSort = (isActive ? (direction === 'asc' ? 'ascending' : 'descending') : 'none') as 'ascending' | 'descending' | 'none';
</script>

<TableHeadCell aria-sort={ariaSort}>
    <button type="button" class="flex items-center gap-1" onclick={() => onSort(type)}>
        {label}
        {#if isActive}
            <span aria-hidden="true">{direction === 'asc' ? '▲' : '▼'}</span>
        {/if}
    </button>
</TableHeadCell>
