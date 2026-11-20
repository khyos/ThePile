<script lang="ts">
    import { resolve } from "$app/paths";
    import {
        RocketSolid,
        ClapperboardPlaySolid,
        ImageSolid,
        StarSolid,
        BookOpenSolid
    } from "flowbite-svelte-icons";
    import { ArtifactType } from "#lib/model/Artifact";

    const categories = [
        { type: ArtifactType.GAME, label: "Games", icon: RocketSolid },
        { type: ArtifactType.MOVIE, label: "Movies", icon: ClapperboardPlaySolid },
        { type: ArtifactType.TVSHOW, label: "TV Shows", icon: ImageSolid },
        { type: ArtifactType.ANIME, label: "Anime", icon: StarSolid },
        { type: ArtifactType.MANGA, label: "Manga", icon: BookOpenSolid }
    ];

    const sections = [
        {
            id: "current",
            title: "Current Backlogs",
            description: "What you're actively enjoying right now",
            route: "/backlog/current/[slug]"
        },
        {
            id: "future",
            title: "Coming Soon",
            description: "Upcoming releases to look forward to",
            route: "/backlog/future/[slug]"
        }
    ] as const;
</script>

<svelte:head>
    <title>ThePile - Your Entertainment Hub</title>
    <meta name="description" content="Rank your entertainment backlog and decide what's next. Explore your current games, movies, TV shows, anime and manga, or discover upcoming releases." />
</svelte:head>

<div class="home">
    <div class="hero">
        <img src="/logo-med.png" class="hero-logo" width="104" height="104" alt="ThePile Logo" />
        <h1>Welcome to <span class="brand-accent">ThePile</span></h1>
        <p>Rank your backlog &bull; Decide what's next</p>
    </div>

    <div class="backlog-grid">
        {#each sections as section (section.id)}
            <section class="backlog-card" aria-labelledby="{section.id}-title">
                <div class="section-icon {section.id}" aria-hidden="true">
                    {#if section.id === "current"}
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
                            <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="2" />
                            <path d="M10 7.5 16 12l-6 4.5V7.5Z" fill="currentColor" />
                        </svg>
                    {:else}
                        <RocketSolid class="h-7 w-7" />
                    {/if}
                </div>
                <h2 id="{section.id}-title">{section.title}</h2>
                <p class="section-description">{section.description}</p>
                <div class="section-divider" aria-hidden="true"></div>

                <div class="category-grid">
                    {#each categories as category (category.type)}
                        {@const Icon = category.icon}
                        <a
                            href={resolve(section.route, { slug: category.type })}
                            class="category-tile {category.type}"
                        >
                            <span class="category-watermark" aria-hidden="true">
                                <Icon class="h-16 w-16" />
                            </span>
                            <span class="category-icon" aria-hidden="true">
                                <Icon class="h-4 w-4" />
                            </span>
                            <span>{category.label}</span>
                        </a>
                    {/each}
                </div>
            </section>
        {/each}
    </div>
</div>

<style>
    .home {
        min-height: calc(100svh - var(--header-space));
        padding: 36px 20px;
        background:
            radial-gradient(ellipse at 100% 0%, #ffdec34d, transparent 34%),
            radial-gradient(ellipse at 0% 100%, #ffd6ce66, transparent 32%),
            linear-gradient(125deg, #f7fafc, #f4f4fc 50%, #ebedfa);
    }

    .hero {
        margin-bottom: 24px;
        text-align: center;
    }

    .hero-logo {
        margin: 0 auto 16px;
        object-fit: contain;
        filter: drop-shadow(0 12px 14px #a33b252b);
    }

    h1 {
        margin: 0 0 4px;
        font-size: clamp(30px, 4vw, 44px);
        font-weight: 750;
        letter-spacing: -1.4px;
        line-height: 1.25;
    }

    .hero p {
        color: var(--app-muted);
        font-size: 18px;
        line-height: 1.6;
    }

    .backlog-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 24px;
        max-width: 620px;
        margin: 0 auto;
    }

    .backlog-card {
        position: relative;
        overflow: hidden;
        padding: 22px;
        border: 1px solid #ffffffb3;
        border-radius: 13px;
        background: #ffffffed;
        box-shadow: 0 14px 24px #252b481f;
        text-align: center;
    }

    .section-icon {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 48px;
        height: 48px;
        margin: 0 auto 12px;
        border-radius: 15px;
    }

    .current {
        color: #40984f;
        background: linear-gradient(135deg, #d6edd8, #bce2c5);
        box-shadow: 0 7px 17px #75be7933;
    }

    .future {
        color: white;
        background: linear-gradient(135deg, #8684ec, #2eafd0);
        box-shadow: 0 7px 17px #7283d940;
    }

    h2 {
        font-size: 20px;
        font-weight: 700;
        letter-spacing: -0.5px;
        line-height: 1.4;
    }

    .section-description {
        margin-top: 3px;
        color: var(--app-muted);
        font-size: 12px;
        line-height: 1.6;
    }

    .section-divider {
        width: 48px;
        height: 2px;
        margin: 10px auto 18px;
        border-radius: 2px;
        background: #e8e9ef;
    }

    .category-grid {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
        gap: 10px;
    }

    .category-tile {
        position: relative;
        display: flex;
        overflow: hidden;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        gap: 5px;
        min-height: 64px;
        border: 1px solid #ffffff1a;
        border-radius: 10px;
        color: white;
        font-size: 13px;
        font-weight: 600;
        line-height: 1.4;
        transition: transform 160ms ease, box-shadow 160ms ease;
    }

    .category-tile:hover {
        transform: translateY(-2px);
        box-shadow: 0 7px 14px #1d25432b;
    }

    .category-tile:focus-visible {
        outline: 3px solid var(--app-text);
        outline-offset: 3px;
    }

    .category-tile > span:not(.category-watermark) {
        position: relative;
    }

    .category-watermark {
        position: absolute;
        right: -9px;
        bottom: -8px;
        opacity: 0;
        transform: rotate(-12deg);
    }

    .game {
        --tile-glow: #305be940;
        background: linear-gradient(125deg, #3275e5, #342da6);
    }

    .movie {
        --tile-glow: #b91cd940;
        background: linear-gradient(125deg, #9553ed, #c807a8);
    }

    .tvshow {
        --tile-glow: #20bb9140;
        background: linear-gradient(125deg, #2db6a7, #15946d);
    }

    .anime {
        --tile-glow: #ff652d40;
        background: linear-gradient(125deg, #ff8b1c, #ff373e);
    }

    .manga {
        --tile-glow: #e929a440;
        grid-column: 1 / -1;
        justify-self: center;
        width: calc((100% - 10px) / 2);
        background: linear-gradient(125deg, #fa5486, #e51cc1);
    }

    :global(.dark) .home {
        padding-top: 12px;
        background:
            radial-gradient(ellipse at 50% 15%, #b55b1712, transparent 30%),
            #0b111e;
    }

    :global(.dark) .hero-logo {
        filter: drop-shadow(0 0 28px #ef721a59);
    }

    :global(.dark) .backlog-card {
        border-color: #ffffff0d;
        background: linear-gradient(155deg, #1b2335, #171f30);
        box-shadow: 0 16px 28px #00000040, 0 -8px 24px #f16c3912;
    }

    :global(.dark) .backlog-card::before {
        position: absolute;
        inset: 0 0 auto;
        height: 3px;
        background: linear-gradient(90deg, #ff983f, #f35271);
        box-shadow: 0 0 30px 7px #f5764933;
        content: "";
    }

    :global(.dark) .current {
        color: #8feb6a;
        background: linear-gradient(135deg, #42635399, #274c4380);
        box-shadow: 0 0 24px #69d66e26, inset 0 0 0 1px #b4ffc21a;
    }

    :global(.dark) .future {
        color: #ff895d;
        background: linear-gradient(135deg, #664b4f99, #49313f99);
        box-shadow: 0 0 24px #f4775326, inset 0 0 0 1px #ffc6a31a;
    }

    :global(.dark) .section-divider {
        background: #ffffff14;
    }

    :global(.dark) .category-tile {
        box-shadow: 0 5px 18px var(--tile-glow), inset 0 0 0 1px #ffffff0a;
    }

    :global(.dark) .category-watermark {
        opacity: 0.12;
    }

    @media (max-width: 639px) {
        .home {
            padding: 30px 20px 40px;
        }

        :global(.dark) .home {
            padding-top: 24px;
        }

        .hero p {
            font-size: 15px;
        }

        .backlog-grid {
            grid-template-columns: 1fr;
            max-width: 320px;
            gap: 20px;
        }
    }

    @media (prefers-reduced-motion: reduce) {
        .category-tile {
            transition: none;
        }

        .category-tile:hover {
            transform: none;
        }
    }
</style>
