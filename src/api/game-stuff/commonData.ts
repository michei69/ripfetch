export type SearchResult = {
    title: string,
    url: string,
}

export type DownloadsResult = {
    [host: string]: {
        [name: string]: string
    }
}
export type SteamSearchResult = Array<{name: string, objectID: string, id: number, type: "app"|"bundle", small_capsule?: string}>

export type SteamInfo = {
    type: "game"|string,
    name: string,
    steam_appid: number,
    required_age: number,
    is_free: boolean,
    detailed_description: string,
    about_the_game: string,
    short_description: string,
    supported_languages: string,
    header_image: string,
    capsule_image: string,
    capsule_imagev5: string,
    website: string,
    pc_requirements?: {
        minimum?: string,
    },
    mac_requirements?: {
        minimum?: string,
    },
    linux_requirements?: {
        minimum?: string,
    },
    developers: string[],
    publishers: string[],
    price_overview?: {
        currency: "EUR"|string,
        initial: number,
        final: number,
        discount_percent: number,
        initial_formatted: string,
        final_formatted: string
    }
    package_groups: unknown[],
    platforms: {
        windows: boolean,
        mac: boolean,
        linux: boolean,
    },
    categories: Array<{
        id: number,
        description: string
    }>,
    genres: Array<{
        id: number,
        description: string
    }>,
    screenshots: Array<{
        id: number,
        path_thumbnail: string,
        path_full: string
    }>,
    movies: Array<{
        id: number,
        name: string,
        thumbnail: string,
        webm: {
            480: string,
            max: string
        },
        mp4: {
            480: string,
            max: string
        },
        highlight: boolean
    }>,
    achievements: {
        total: number,
        highlighted: Array<{
            name: string,
            path: string
        }>,
    },
    release_date: {
        coming_soon: boolean,
        date: Date
    },
    support_info: {
        url: string,
        email: string
    },
    background: string,
    background_raw: string,
    content_descriptors: {
        ids: Array<number>,
        notes: string
    },
    ratings: {
        dejus: {
            rating_generated: string,
            rating: string,
            required_age: string,
            banned: string,
            use_age_gate: string,
            descriptors: string
        },
        steam_germany: {
            rating_generated: string,
            rating: "BANNED"|string,
            required_age: string,
            banned: string,
            use_age_gate: string,
            descriptors: string
        }
    }
}

export interface IGameSource {
    displayName: string;
    search(title: string): Promise<SearchResult[]>;
    getDownloads(url: string): Promise<DownloadsResult>;
}
