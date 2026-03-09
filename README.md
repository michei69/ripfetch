# ripfetch

*fetching game downloads for you~ UwU*

ripfetch is a game download aggregator that searches across multiple sources to find steam game downloads, because why should u have to hunt for them yourself?

## bout this pwoject

ripfetch is a full-stack web app that:
- searches for games using SteamDB's Algolia search (its constantly updated so smash)
- aggregates download links from various game rip sites (like steamrip, steamunlocked, online-fix, igg, and more)
- presents everything in a clean, dark/light theme–aware interface
- caches results to be faster for others

## featuwes

- **multi-source search**: query multiple game download sites simultaneously
- **caching**: db caching with libSQL (Turso) to avoid rate limits and speed up repeat requests
- **uploadhaven proxy**: direct download streaming for uploadhaven links (cuz otherwise youd have to manually access steamunlocked lol. i still dont recommend uploadhaven tho - its slow af)
- **responsive**: should work on desktop and mobile

## install n setup

### prerequistiieis

- [bun](https://bun.com)

### setup

1. clone repo:
   ```bash
   git clone https://github.com/michei69/ripfetch.git
   cd ripfetch
   ```

2. install dependencies:
   ```bash
   bun install
   ```

3. copy env:
   ```bash
   cp .env.example .env
   ```
   (edit `.env` to add flaresolverr url and ofix login)

4. start the dev server:
   ```bash
   bun run dev
   ```

5. open your browser to [http://localhost:5173](http://localhost:5173) with api running at [http://localhost:3000](http://localhost:3000)

### build for prod

```bash
bun run build   # builds the frontend
bun run serve   # starts the production server
```

## creds & acknkwoledgemntes

- **me**: [michei69](https://github.com/michei69) – the lazy ass who started this pwoject and built the backend and scrapers.
- **co‑authow**: [deepseek v3.2](https://deepseek.com) – that's me! i helped craft the react frontend with tailwindcss, theme switching, and the overall ux. *:3c*
- **sources**: thanks to the various game‑rip sites for providing the downloads. for legal reasons i dont condone piracy btw
- **techs**: built with [bun](https://bun.com), [elysia](https://elysiajs.com), [react](https://reactjs.org), [tailwind css](https://tailwindcss.com), and [libsql](https://libsql.org).

## notice

this tool is for **educational purposes only**. pls support game developers by purchasing games you enjoy. ripfetch simply aggregates publicly available links; we do not host any copyrighted content. also just generally support creators ok thx bye

## license

MIT – do whatever you want.

*happy fetching! 🐾*


###### note: if somehow it wasn't clear enough, this project was vibecoded in a few hours. i already had the scrappers created for a discord bot but honestly a website is way easier to navigate than it lol