<script lang="ts">
    import {
        Dropdown,
        DropdownGroup,
        DropdownHeader,
        DropdownItem,
        NavBrand,
        NavHamburger,
        NavLi,
        NavUl,
        Navbar,
    } from "flowbite-svelte";
    import { resolve } from "$app/paths";
    import { page } from "$app/state";
    import type { Snippet } from "svelte";
    import "../app.css";
    import type { LayoutData } from "./$types";
    import { ChevronDownOutline, UserSolid } from "flowbite-svelte-icons";

    let { data, children }: { data: LayoutData; children: Snippet } = $props();

    const menus = [
        {
            name: "Games",
            path: "game",
            items: [
                { name: "Search", href: resolve("/game") },
                { name: "Create", href: resolve("/game/create") },
                { name: "My List", href: resolve("/mylist/[slug]", { slug: "game" }) }
            ]
        },
        {
            name: "Movies",
            path: "movie",
            items: [
                { name: "Search", href: resolve("/movie") },
                { name: "Create", href: resolve("/movie/create") },
                { name: "My List", href: resolve("/mylist/[slug]", { slug: "movie" }) }
            ]
        },
        {
            name: "TV Shows",
            path: "tvshow",
            items: [
                { name: "Search", href: resolve("/tvshow") },
                { name: "Create", href: resolve("/tvshow/create") },
                { name: "On Going", href: resolve("/ongoing/[slug]", { slug: "tvshow" }) },
                { name: "My List", href: resolve("/mylist/[slug]", { slug: "tvshow" }) }
            ]
        },
        {
            name: "Anime",
            path: "anime",
            items: [
                { name: "Search", href: resolve("/anime") },
                { name: "Create", href: resolve("/anime/create") },
                { name: "On Going", href: resolve("/ongoing/[slug]", { slug: "anime" }) },
                { name: "My List", href: resolve("/mylist/[slug]", { slug: "anime" }) }
            ]
        },
        {
            name: "Manga",
            path: "manga",
            items: [
                { name: "Search", href: resolve("/manga") },
                { name: "Create", href: resolve("/manga/create") },
                { name: "On Going", href: resolve("/ongoing/[slug]", { slug: "manga" }) },
                { name: "My List", href: resolve("/mylist/[slug]", { slug: "manga" }) }
            ]
        }
    ];
</script>

<div class="site-header">
    <Navbar fluid breakpoint="lg" class="site-navbar" navContainerClass="site-nav-container">
        <NavBrand href={resolve("/")}>
            <img src="/logo-small.png" class="me-2 h-8 w-8" alt="ThePile Logo" />
            <span class="brand-name">The<span class="brand-accent">Pile</span></span>
        </NavBrand>
        <div class="nav-controls flex items-center gap-2 lg:order-2">
            <NavHamburger class="lg:hidden" />
            <button id="avatar-menu" class="account-button" type="button" aria-label="Account menu">
                <UserSolid class="h-5 w-5" />
            </button>
        </div>
        <Dropdown placement="bottom-end" triggeredBy="#avatar-menu">
            {#if data.user.id >= 0}
                <DropdownHeader>
                    <span class="block text-sm">{data.user.username}</span>
                </DropdownHeader>
                <DropdownGroup>
                    <DropdownItem href={resolve("/profile")}>Profile</DropdownItem>
                    <DropdownItem href={resolve("/stats")}>Stats</DropdownItem>
                    <DropdownItem href={resolve("/recap/[year]", { year: String(new Date().getFullYear()) })}>Year Recap</DropdownItem>
                    <DropdownItem href={resolve("/tools")}>Tools</DropdownItem>
                    <DropdownItem class="p-0">
                        <form method="POST" action={resolve("/signout")}>
                            <button type="submit" class="block w-full cursor-pointer px-4 py-2 text-left">Sign out</button>
                        </form>
                    </DropdownItem>
                </DropdownGroup>
            {:else}
                <DropdownGroup>
                    <DropdownItem href={resolve("/signin")}>Sign in</DropdownItem>
                    <DropdownItem href={resolve("/signup")}>Sign up</DropdownItem>
                </DropdownGroup>
            {/if}
        </Dropdown>
        <NavUl activeUrl={page.url.pathname} class="site-menu" classes={{ ul: "site-menu-list" }}>
            <NavLi href={resolve("/")} aria-current={page.route.id === "/" ? "page" : undefined} class="site-nav-link">Home</NavLi>
            <NavLi href={resolve("/backlog")} aria-current={page.route.id?.startsWith("/backlog") ? "page" : undefined} class="site-nav-link">Backlogs</NavLi>
            <NavLi href={resolve("/tierlist")} aria-current={page.route.id?.startsWith("/tierlist") ? "page" : undefined} class="site-nav-link">Tier Lists</NavLi>
            {#each menus as menu (menu.path)}
                <NavLi id="{menu.path}-menu" class="site-nav-link">
                    {menu.name}<ChevronDownOutline class="ms-1 inline h-3 w-3" />
                </NavLi>
                <Dropdown simple triggeredBy="#{menu.path}-menu" class="min-w-32">
                    {#each menu.items as item (item.name)}
                        <DropdownItem href={item.href}>{item.name}</DropdownItem>
                    {/each}
                </Dropdown>
            {/each}
        </NavUl>
    </Navbar>
</div>
<main class="app-content" class:home-page={page.route.id === "/"}>
    {@render children()}
</main>

<style>
    .site-header {
        position: relative;
        z-index: 50;
        border-bottom: 1px solid #e6e8ee;
        background: #ffffffed;
    }

    .site-header :global(.site-navbar) {
        padding: 0 32px;
    }

    .site-header :global(.site-nav-container) {
        min-height: 63px;
    }

    .brand-name {
        white-space: nowrap;
        font-size: 20px;
        font-weight: 750;
        letter-spacing: -0.6px;
    }

    .account-button {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 32px;
        height: 32px;
        border-radius: 50%;
        color: #626b7b;
        background: #edf0f5;
        cursor: pointer;
    }

    .account-button:hover {
        color: var(--app-text);
        background: #e6e9f0;
    }

    .site-header :global(button:focus-visible),
    .site-header :global(a:focus-visible) {
        outline: 2px solid var(--app-accent-focus);
        outline-offset: 3px;
    }

    .site-header :global(.site-nav-link) {
        position: relative;
        color: var(--app-text);
        font-weight: 400;
        cursor: pointer;
    }

    .site-header :global(.site-nav-link:hover),
    .site-header :global(.site-nav-link[aria-current="page"]) {
        color: #c86a45;
        background: transparent;
    }

    :global(.dark) .site-header {
        margin: 16px 32px;
        border: 1px solid #2b354b;
        border-radius: 9px;
        background: linear-gradient(110deg, #182133, #151d2e);
        box-shadow: 0 5px 16px #00000033, inset 0 0 0 1px #ffffff03;
    }

    :global(.dark) .site-header :global(.site-nav-container) {
        min-height: 54px;
    }

    :global(.dark) .site-header :global(.site-nav-link) {
        color: #c6cbd5;
    }

    :global(.dark) .site-header :global(.site-nav-link:hover),
    :global(.dark) .site-header :global(.site-nav-link[aria-current="page"]) {
        color: #fa896e;
    }

    :global(.dark) .account-button {
        color: #bfc7d6;
        background: #ffffff0a;
    }

    :global(.dark) .account-button:hover {
        color: white;
        background: #ffffff14;
    }

    @media (min-width: 1024px) {
        .site-header :global(.site-menu-list) {
            gap: 8px;
            padding: 0;
        }

        .site-header :global(.site-nav-link) {
            padding: 22px 8px;
            font-size: 13px;
        }

        .site-header :global(.site-nav-link[aria-current="page"])::after {
            position: absolute;
            bottom: 3px;
            left: calc(50% - 2px);
            width: 4px;
            height: 4px;
            border-radius: 50%;
            background: #ee9167;
            content: "";
        }

        :global(.dark) .site-header :global(.site-nav-link) {
            padding-block: 16px;
        }

        :global(.dark) .site-header :global(.site-nav-link[aria-current="page"])::after {
            display: none;
        }
    }

    @media (max-width: 639px) {
        .site-header :global(.site-navbar) {
            padding-inline: 16px;
        }

        :global(.dark) .site-header {
            margin: 12px;
        }

        .nav-controls {
            gap: 4px;
        }
    }
</style>
