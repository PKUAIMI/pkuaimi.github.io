#!/usr/bin/env python3
"""Import the archived public WordPress content without third-party dependencies.

Normal use: python3 scripts/import_site.py
To fetch a fresh source export first: python3 scripts/import_site.py --fetch
This only reads publicly available endpoints; it does not change the old site.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
from html import escape, unescape
from html.parser import HTMLParser
import json
from pathlib import Path
import re
from urllib.parse import parse_qs, quote, unquote, urlsplit, urlunsplit
from urllib.request import Request, urlopen
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'migration' / 'source'
OUT = ROOT / 'content'
ORIGIN = 'https://pkuaimi.com'
VOID = {'area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr'}
BLOCK = {'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'ul', 'ol', 'figure', 'figcaption', 'table', 'tr', 'div', 'section'}
ALLOWED = BLOCK | {'a', 'b', 'strong', 'i', 'em', 'u', 'sup', 'sub', 'br', 'hr', 'img', 'blockquote', 'pre', 'code', 'thead', 'tbody', 'th', 'td', 'small', 'dl', 'dt', 'dd', 'video', 'source', 'audio'}
DROP = {'script', 'style', 'svg', 'noscript', 'form', 'input', 'button', 'iframe'}

class Node:
    def __init__(self, tag: str, attrs=()):
        self.tag, self.attrs, self.children = tag, dict(attrs), []

    def walk(self):
        yield self
        for child in self.children:
            if isinstance(child, Node):
                yield from child.walk()

    def text(self):
        return ''.join(child.text() if isinstance(child, Node) else child for child in self.children)

class Tree(HTMLParser):
    def __init__(self, source: str):
        super().__init__(convert_charrefs=True)
        self.root = Node('root')
        self.stack = [self.root]
        self.feed(source)

    def handle_starttag(self, tag, attrs):
        node = Node(tag, attrs)
        self.stack[-1].children.append(node)
        if tag not in VOID:
            self.stack.append(node)

    def handle_startendtag(self, tag, attrs):
        self.handle_starttag(tag, attrs)
        if tag not in VOID:
            self.handle_endtag(tag)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, 0, -1):
            if self.stack[i].tag == tag:
                self.stack = self.stack[:i]
                return

    def handle_data(self, text):
        self.stack[-1].children.append(text)


def plain(node):
    def rec(n):
        if isinstance(n, str):
            return n
        content = ''.join(rec(c) for c in n.children)
        return content + ('\n' if n.tag in BLOCK or n.tag == 'br' else '')
    return re.sub(r'[ \t\r\f\v]+', ' ', rec(node)).strip()


def concise(node):
    return re.sub(r'\s+', ' ', node.text()).strip()


def canonical_media(url):
    url = unescape(url)
    parsed = urlsplit(url)
    if parsed.netloc in {'i0.wp.com', 'i1.wp.com', 'i2.wp.com'} and parsed.path.startswith('/pkuaimi.com/'):
        parsed = urlsplit('https://' + parsed.path.lstrip('/'))
    if parsed.netloc == 'pkuaimi.com' and '/wp-content/uploads/' in parsed.path:
        return urlunsplit(('https', 'pkuaimi.com', quote(unquote(parsed.path), safe='/()-._~'), '', ''))
    return url


def media_url(node):
    return canonical_media(node.attrs.get('data-orig-file') or node.attrs.get('src', ''))


def collect_images(node):
    images, seen = [], set()
    for img in node.walk():
        if img.tag != 'img' or not img.attrs.get('src'):
            continue
        url = media_url(img)
        if url in seen:
            continue
        seen.add(url)
        images.append({'url': url, 'alt': img.attrs.get('alt') or img.attrs.get('data-image-title', ''),
                       'width': img.attrs.get('width'), 'height': img.attrs.get('height')})
    return images


def normalize_link(href, id_paths):
    href = unescape(href).strip()
    if re.match(r'(?i)\s*(javascript|data|vbscript):', href):
        return ''
    parsed = urlsplit(href)
    if parsed.netloc in {'pkuaimi.com', 'www.pkuaimi.com'}:
        if '/wp-content/uploads/' in parsed.path:
            return canonical_media(href)
        page_id = parse_qs(parsed.query).get('page_id', [None])[0]
        if page_id and page_id in id_paths:
            return id_paths[page_id] + ('#' + parsed.fragment if parsed.fragment else '')
        if parsed.path.startswith('/wp-'):
            return ''
        return (parsed.path or '/') + ('?' + parsed.query if parsed.query else '') + ('#' + parsed.fragment if parsed.fragment else '')
    if parsed.netloc.endswith('wp.com') and '/pkuaimi.com/wp-content/uploads/' in parsed.path:
        return canonical_media(href)
    return href


def render(node, id_paths, include_images=True):
    if isinstance(node, str):
        return escape(node)
    tag, attrs = node.tag, node.attrs
    if tag in DROP:
        return ''
    if tag == 'a' and (attrs.get('href') == '#' or '/wp-login.php' in attrs.get('href', '')):
        return ''  # Empty social placeholders and editor sign-in are not public content.
    if tag == 'img':
        if not include_images or not attrs.get('src'):
            return ''
        alt = attrs.get('alt') or attrs.get('data-image-title', '')
        return '<img src="{}" alt="{}" loading="lazy" decoding="async">'.format(escape(media_url(node), quote=True), escape(alt, quote=True))
    content = ''.join(render(c, id_paths, include_images) for c in node.children)
    if tag == 'root':
        return content
    if tag == 'br':
        return '<br>'
    if tag == 'hr':
        return '<hr>'
    # Remove the site's old layout wrappers, inline styles, editor metadata,
    # tracking and empty elements while retaining meaningful formatting.
    if tag not in ALLOWED or tag in {'div', 'section'}:
        if not content.strip():
            return ''
        return content + ('\n' if tag in {'div', 'section'} else '')
    if not re.sub(r'<[^>]*>|\s|&nbsp;', '', content) and '<img ' not in content and tag not in {'td', 'th'}:
        return ''
    outattrs = {}
    if tag == 'a':
        href = normalize_link(attrs.get('href', ''), id_paths)
        if not href:
            return content
        outattrs['href'] = href
        if href.startswith('http'):
            outattrs['rel'] = 'noopener noreferrer'
    elif tag in {'td', 'th'}:
        outattrs = {k: attrs[k] for k in ['colspan', 'rowspan', 'scope'] if k in attrs}
    elif tag in {'video', 'audio', 'source'}:
        outattrs = {k: attrs[k] for k in ['src', 'type', 'controls'] if k in attrs}
    if attrs.get('id'):
        outattrs['id'] = attrs['id']
    joined = ''.join(' {}="{}"'.format(k, escape(v or '', quote=True)) for k, v in outattrs.items())
    return '<{}{}>{}</{}>'.format(tag, joined, content, tag) + ('\n' if tag in BLOCK else '')


def cleaned(node, id_paths, include_images=True):
    value = render(node, id_paths, include_images)
    value = re.sub(r'[ \t]+', ' ', value)
    value = re.sub(r'\n\s*\n+', '\n', value)
    value = re.sub(r'(?:<br>\s*){3,}', '<br><br>', value)
    return value.strip()


def write_json(name, data):
    (OUT / name).write_text(json.dumps(data, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')


def fetch_json(path):
    with urlopen(Request(ORIGIN + path, headers={'User-Agent': 'AIMI-public-site-migration/1.0'}), timeout=45) as response:
        return json.load(response), dict(response.headers)


def refresh_sources():
    SOURCE.mkdir(parents=True, exist_ok=True)
    for collection in ('pages', 'posts'):
        records, headers = fetch_json('/wp-json/wp/v2/' + collection + '?per_page=100&page=1')
        for page in range(2, int(headers.get('X-WP-TotalPages', headers.get('x-wp-totalpages', 1))) + 1):
            more, _ = fetch_json('/wp-json/wp/v2/' + collection + '?per_page=100&page=' + str(page))
            records.extend(more)
        (SOURCE / ('wp-' + collection + '.json')).write_text(json.dumps(records, ensure_ascii=False, indent=2) + '\n')
    for remote, local in [('sitemap.xml', 'sitemap.xml'), ('sitemap-1.xml', 'sitemap-pages.xml')]:
        with urlopen(ORIGIN + '/' + remote, timeout=45) as response:
            (SOURCE / local).write_bytes(response.read())


def first_sentence(text):
    result = re.split(r'(?<=[!！。])\s*|(?<=\.)\s+(?=[A-Z])', text, maxsplit=1)[0]
    return result if len(result) <= 280 else result[:277] + '…'


def run():
    OUT.mkdir(exist_ok=True)
    raw_pages = json.loads((SOURCE / 'wp-pages.json').read_text())
    raw_posts = json.loads((SOURCE / 'wp-posts.json').read_text())
    records = raw_pages + raw_posts
    id_paths = {str(p['id']): urlsplit(p['link']).path for p in records}
    trees = {p['id']: Tree(p['content']['rendered']).root for p in records}
    pages = []
    manifest = {}
    for p in records:
        tree = trees[p['id']]
        html = cleaned(tree, id_paths)
        page = {'id': p['id'], 'title': unescape(p['title']['rendered']), 'slug': unquote(p['slug']),
                'path': urlsplit(p['link']).path, 'sourceUrl': p['link'], 'html': html,
                'text': plain(Tree(html).root), 'images': collect_images(tree),
                'type': p['type'], 'modified': p['modified']}
        pages.append(page)
        for n in tree.walk():
            if n.tag == 'img' and n.attrs.get('src'):
                url = media_url(n)
                entry = manifest.setdefault(url, {'url': url, 'kind': 'image', 'alt': n.attrs.get('alt') or n.attrs.get('data-image-title', ''), 'sourcePages': [], 'aliases': []})
                if p['link'] not in entry['sourcePages']:
                    entry['sourcePages'].append(p['link'])
                for key in ['src', 'data-orig-file', 'data-large-file']:
                    if n.attrs.get(key) and n.attrs[key] not in entry['aliases']:
                        entry['aliases'].append(n.attrs[key])
            if n.tag == 'a':
                url = canonical_media(n.attrs.get('href', ''))
                if '/wp-content/uploads/' in url:
                    entry = manifest.setdefault(url, {'url': url, 'kind': 'image' if re.search(r'\.(png|jpe?g|gif|webp|svg)$', url, re.I) else 'download', 'alt': '', 'sourcePages': [], 'aliases': []})
                    if p['link'] not in entry['sourcePages']:
                        entry['sourcePages'].append(p['link'])
                    if n.attrs['href'] not in entry['aliases']:
                        entry['aliases'].append(n.attrs['href'])
    # News entries are the page builder's 24 top-level event containers.
    news = []
    news_root = next(n for n in trees[95].walk() if n.attrs.get('data-elementor-id') == '95')
    explicit_dates = {'ab4e894': '2026-09', '188b580': '2026-09-01', '72fe36f': '2026-09-01',
                      '9e0c8a5': '2025-09-01', 'bb603d4': '2025-08-01', '435f382': '2025-07-21',
                      'c08a9cc': '2025-07-04', '29403a8': '2025-03-12'}
    for container in news_root.children:
        if not isinstance(container, Node) or not concise(container):
            continue
        widgets = [n for n in container.walk() if n.attrs.get('data-widget_type') == 'text-editor.default']
        fragment = Node('root')
        fragment.children = widgets
        body = cleaned(fragment, id_paths)
        blocks = [n for n in fragment.walk() if n.tag in {'p', 'h2', 'h3', 'h4', 'h5', 'h6'} and concise(n)]
        heading = next((n for n in fragment.walk() if n.tag in {'h2', 'h3', 'h4', 'h5', 'h6'} and concise(n)), None)
        title = concise(heading) if heading else first_sentence(plain(fragment).split('\n')[0])
        if not title:
            title = first_sentence(concise(fragment))
        node_id = container.attrs['data-id']
        entry = {'id': 'news-' + node_id, 'title': title, 'bodyHtml': body, 'text': plain(Tree(body).root),
                 'images': collect_images(container), 'sourceUrl': ORIGIN + '/news/', 'sourceOrder': len(news)}
        if node_id in explicit_dates:
            entry['date'] = explicit_dates[node_id]
            entry['dateKind'] = 'event'  # Never inferred from image uploads or page modified time.
        news.append(entry)
    people, group = [], ''
    for n in trees[41].walk():
        if n.tag == 'h2':
            group = concise(n)
        if n.tag == 'figure':
            caption = next((x for x in n.walk() if x.tag == 'figcaption'), None)
            images = collect_images(n)
            if not caption or not images:
                continue
            anchor = next((x for x in n.walk() if x.tag == 'a' and x.attrs.get('href')), None)
            name = concise(caption)
            people.append({'id': 'person-' + str(len(people) + 1), 'name': name, 'group': group,
                           'image': images[0]['url'], 'imageAlt': name,
                           'profilePath': normalize_link(anchor.attrs['href'], id_paths) if anchor else None,
                           'sourceUrl': ORIGIN + '/%e5%85%b3%e4%ba%8e/people/'})
    publications, section = [], 'AIMI'
    for n in trees[93].walk():
        if n.tag != 'p' or not concise(n):
            continue
        citation = concise(n)
        if citation == 'Publications Before AIMI':
            section = citation
            continue
        years = re.findall(r'\b(?:19|20)\d{2}\b', citation)
        publications.append({'id': 'publication-' + str(len(publications) + 1), 'year': int(years[-1]) if years else None,
                             'section': section, 'citation': citation, 'html': cleaned(n, id_paths),
                             'links': [{'url': a.attrs['href'], 'text': concise(a)} for a in n.walk() if a.tag == 'a' and a.attrs.get('href')]})
    research, pending_images, active = [], [], None
    for n in trees[88].children:
        if not isinstance(n, Node):
            continue
        if n.tag == 'figure':
            pending_images.extend(collect_images(n))
        elif n.tag == 'p' and concise(n):
            if pending_images:
                active = {'id': 'research-' + str(len(research) + 1), 'title': concise(n), 'descriptionHtml': '', 'images': pending_images}
                research.append(active)
                pending_images = []
            elif active:
                active['descriptionHtml'] += cleaned(n, id_paths)
    sitemap = ET.parse(SOURCE / 'sitemap-pages.xml')
    sitemap_urls = [n.text for n in sitemap.findall('.//{http://www.sitemaps.org/schemas/sitemap/0.9}loc')]
    exported_urls = [p['sourceUrl'] for p in pages]
    coverage = {'sourceOrigin': ORIGIN, 'targetOrigin': 'https://pkuaimi.github.io',
                'sourceSnapshotDate': '2026-09-28', 'pageCount': len(raw_pages), 'postCount': len(raw_posts),
                'newsCount': len(news), 'peopleCount': len(people), 'publicationCount': len(publications), 'researchCount': len(research),
                'mediaCount': len(manifest), 'sitemapPageCount': len(sitemap_urls),
                'missingSitemapUrls': sorted(set(sitemap_urls) - set(exported_urls)),
                'pages': [{'id': p['id'], 'title': p['title'], 'path': p['path'], 'sourceUrl': p['sourceUrl']} for p in pages],
                'editorialNotes': [
                    'The original People category is spelled Falculty; original text retained in the content data.',
                    'Meng Li joining news says 2026-04-01 in Chinese and 2025-04-01 in English. Both original statements retained; no event date assigned.',
                    'The Contact page lists 240 Pathology Building, No.38 Xueyuan Road; three member profiles also contain the address 北京市昌平区北大产业园12号楼405 and weekday office hours. All original addresses retained.',
                    'The Physics in Medicine & Biology news English headline says provisional acceptance, while its Chinese headline and English body say accepted. Original wording retained.',
                    'The news page has no per-item publication timestamps. Only dates stated explicitly within event text are included, with dateKind=event. Source order is retained.',
                    'Original English and Chinese member-name capitalization is retained. Names and spellings are not silently standardized.',
                    'WordPress editor login, empty social-media placeholder links, theme layout, scripts, and analytics are omitted from the public static content.',
                    'External research, DOI, paper, institutional news, WeChat, GitHub and scholar links remain external. No external sites have been cloned.'
                ]}
    for name, data in [('pages.json', pages), ('news.json', news), ('people.json', people), ('publications.json', publications),
                       ('research.json', research), ('media-manifest.json', list(manifest.values())), ('migration-inventory.json', coverage)]:
        write_json(name, data)
    print(json.dumps({k: coverage[k] for k in ['pageCount', 'postCount', 'newsCount', 'peopleCount', 'publicationCount', 'researchCount', 'mediaCount', 'missingSitemapUrls']}, ensure_ascii=False))

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--fetch', action='store_true', help='refresh public source API exports before importing')
    args = parser.parse_args()
    if args.fetch:
        refresh_sources()
    run()
