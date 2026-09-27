# Repository conventions

- Read `docs/MAINTENANCE.md` for authoring and `docs/ARCHITECTURE.md` for code structure.
- Edit content in `content/*.json`, templates in `src/templates/`, and browser assets in `public/`. Root HTML/CSS/JS and `dist/` are generated; never edit them directly.
- A content record owns both its `en` and `zh` text. English remains the default, with Chinese under `/zh/`. Keep navigation, search results and language switches consistent.
- Keep existing record IDs and page URLs stable. Use `aliases` for previous page paths. Never generate member routes from display names.
- Publication `html` is authoritative; citation text and links are derived. Keep official paper titles and bibliographic information unchanged unless requested.
- Preserve the original migration archive and known source discrepancies. The import script writes to `migration/imported/`, not editable content.
- Prefer Node.js built-ins and the existing static-site architecture. Use two-space indentation, semicolons, small named functions and readable templates. Do not introduce a framework for routine content work.
- For additions, use `npm run new -- --help` and the templates in `content/templates/`.
- Run `npm run verify` after changes. For UI changes, also verify the affected desktop/mobile interactions. Keep generated output in sync before committing.
- GitHub Pages publishes `main` at the repository root using `pkuaimi.github.io`; do not add a custom domain or change hosting unless requested.
