<script lang="ts">
    import { resolve } from "$app/paths";
    import { Button, Heading, P } from "flowbite-svelte";
</script>

<svelte:head>
    <title>Sign out - ThePile</title>
</svelte:head>

<div class="max-w-sm mx-auto space-y-4 p-4">
    <Heading tag="h1">Sign out</Heading>
    <P>Confirm you want to sign out of ThePile.</P>
    <form method="POST" action={resolve("/signout")}>
        <Button type="submit">Confirm sign out</Button>
    </form>
</div>