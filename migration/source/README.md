# Public source snapshot

Retrieved on 2026-09-28 from the site's unauthenticated public endpoints:

- `wp-pages.json`: `https://pkuaimi.com/wp-json/wp/v2/pages?per_page=100` — all 10 published pages.
- `wp-posts.json`: `https://pkuaimi.com/wp-json/wp/v2/posts?per_page=100` — no published posts. News lives inside the News page.
- `sitemap.xml`: `https://pkuaimi.com/sitemap.xml`.
- `sitemap-pages.xml`: `https://pkuaimi.com/sitemap-1.xml` — the same 10 page URLs.

The original API payloads are retained for provenance and repeatable conversion. They are not required to serve the public static site. No account credentials or private content were requested or stored. `../../scripts/import_site.py` produces the editable content files from this snapshot.
