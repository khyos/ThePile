import { tick } from 'svelte';

export async function focusSelectedDrawerTab(event: CustomEvent & { currentTarget: HTMLDialogElement }) {
    const drawer = event.currentTarget;
    await tick();
    const focusedElement = drawer.ownerDocument.activeElement;
    if (drawer.open && (focusedElement === drawer || focusedElement === drawer.querySelector('button[role="tab"]'))) {
        drawer.querySelector<HTMLButtonElement>('button[role="tab"][aria-selected="true"]')?.focus();
    }
}
