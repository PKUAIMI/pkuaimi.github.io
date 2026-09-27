import fs from 'node:fs';
import path from 'node:path';
const read = name => JSON.parse(fs.readFileSync(name,'utf8'));
const config = read('site.config.json');
const pages = read('content/pages.json');
const news = read('content/news.json');
const people = read('content/people.json');
const publications = read('content/publications.json');
const projects = read('content/research.json');
const media = read('content/media-map.json');
const displayMedia = fs.existsSync('content/media-display-map.json') ? read('content/media-display-map.json') : {};
const provenance = read('content/media-provenance.json');
const imageSizes = new Map([...provenance.assets,...provenance.displayVariants].map(im=>[im.path,{width:im.width,height:im.height}]));
const out = 'dist';
fs.mkdirSync(out,{recursive:true});
const generated = new Map();
const esc = value => String(value ?? '').replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const decode = value => String(value).replace(/&#(x[0-9a-f]+|\d+);/gi,(_,n)=>String.fromCodePoint(n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n))).replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&nbsp;/g,' ');
const plain = html => decode(String(html).replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim());
const uri = value => {try{return decodeURIComponent(value).toLowerCase();}catch{return value.toLowerCase();}};
const profiles = {'Yixing Huang':'yixing-huang','Haijun Yu':'haijun-yu','Meng Li':'meng-li','Ao Wang':'ao-wang'};
const routes = new Map(pages.map(p => [uri(p.path),p.path==='/'?'/':profiles[p.title]?`/people/${profiles[p.title]}/`:`/${p.slug}/`]));
const pageRoute = p => routes.get(uri(p.path));
const mediaByPath = new Map();
for(const [url,file] of Object.entries(media)) {
 try {const u=new URL(decode(url));mediaByPath.set(uri(u.pathname.replace(/^\/pkuaimi\.com/,'')),file);}catch{}
}
const displayByPath = new Map();
for(const [url,file] of Object.entries(displayMedia)) {
 try {const u=new URL(decode(url));displayByPath.set(uri(u.pathname.replace(/^\/pkuaimi\.com/,'')),typeof file==='string'?file:file.path||file.displayPath);}catch{}
}
function localUrl(value, display=false) {
 const raw=decode(value);
 if(display && displayMedia[raw]) return typeof displayMedia[raw]==='string'?displayMedia[raw]:displayMedia[raw].path;
 if(media[raw] && !display) return media[raw];
 let url;
 try {url=new URL(raw,'https://pkuaimi.com');}catch{return raw;}
 if (['pkuaimi.com','www.pkuaimi.com','i0.wp.com','i1.wp.com','i2.wp.com'].includes(url.hostname)) {
   const pathname=uri(url.pathname.replace(/^\/pkuaimi\.com/,''));
   const asset = (display && displayByPath.get(pathname)) || media[raw] || mediaByPath.get(pathname);
   if(asset)return asset;
   if(url.searchParams.has('page_id')) {const p=pages.find(p=>String(p.id)===url.searchParams.get('page_id'));if(p)return pageRoute(p)+url.hash;}
   if(routes.has(pathname)) return routes.get(pathname)+url.hash;
   if(url.hostname==='pkuaimi.com' && raw.startsWith('/'))return raw;
 }
 return raw;
}
function dimensions(file) { const size=imageSizes.get(file);return size?.width&&size?.height?` width="${size.width}" height="${size.height}"`:''; }
function html(source) {
 return String(source||'').replace(/\b(href|src)="([^"]*)"/g,(_,attr,url)=>`${attr}="${esc(localUrl(url,attr==='src'))}"`)
 .replace(/<img\b([^>]*?)>/g, (tag,attrs)=>/\bwidth=/.test(attrs)?tag:`<img${attrs}${dimensions(decode(attrs.match(/src="([^"]*)"/)?.[1]||''))}>`)
 .replace(/<h6>([\s\S]*?)<\/h6>/g,(_,content)=>plain(content).length>100?`<p>${content}</p>`:`<h3>${content}</h3>`);
}
const picture=(source,alt='',extra='')=>`<img src="${esc(localUrl(source,true))}" alt="${esc(alt)}" loading="lazy" decoding="async"${dimensions(localUrl(source,true))} ${extra}>`;
const figure=(source,alt='',extra='')=>`<figure><a href="${esc(localUrl(source))}" aria-label="${esc('View full image: '+alt)}">${picture(source,alt,extra)}</a></figure>`;
const arrow='<span class="arrow" aria-hidden="true">↗</span>';
const straight='<span class="arrow" aria-hidden="true">→</span>';
const searchIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const navItems=[['/','Overview'],['/news/','News'],['/people/','People'],['/research/','Research'],['/publications/','Publications'],['/contact/','Contact']];
const active=(url,current)=>url==='/'?current==='/':current.startsWith(url);
function header(current){return `<a class="skip-link" href="#main">Skip to content</a>
<div class="utility"><div class="wrap"><a href="https://www.pku.edu.cn/">Peking University <span aria-hidden="true"> / </span> 北京大学</a><div class="utility-links"><a href="/contact/">Contact</a><a href="${config.github}">GitHub ↗</a></div></div></div>
<header><div class="masthead wrap"><a class="identity" href="/" aria-label="AIMI Lab home"><span class="wordmark">AIMI<span class="dot" aria-hidden="true"></span></span><span class="identity-text">Artificial Intelligence<br>for Medical Imaging<span>北京大学 · 智能医学影像实验室</span></span></a><div class="institution"><strong>Peking University</strong><br>Health Science Center<br>Institute of Medical Technology</div><button class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="primary-navigation"><span aria-hidden="true">☰</span><span data-menu-label>Menu</span></button></div>
<nav class="navigation" aria-label="Main navigation"><div class="wrap nav-inner"><span class="nav-mobile-label">AIMI Lab</span><ul class="nav-links" id="primary-navigation" data-nav-links>${navItems.map(([url,label])=>`<li><a href="${url}"${active(url,current)?' aria-current="page"':''}>${label}</a></li>`).join('')}</ul><button class="search-toggle" data-search-open aria-label="Search website">${searchIcon}<span>Search</span></button></div></nav></header>`;}
function footer(){return `<section class="contact-band" aria-label="Get in touch"><div class="wrap"><div><h2>Connecting research. Advancing care.</h2><p>Artificial Intelligence for Medical Imaging · Peking University</p></div><a class="text-link" href="/contact/">Get in touch ${straight}</a></div></section>
<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><div class="footer-brand">AIMI Lab.</div><p>${config.fullName}<br>${config.institute}<br>${config.institution}</p><p lang="zh-CN">${config.chineseName}</p></div><div><h2>Find us</h2><p>${config.address}</p><a class="text-link" href="mailto:${config.email}">${config.email} ${arrow}</a></div><div><h2>Explore</h2><ul class="footer-links">${navItems.slice(1).map(([url,label])=>`<li><a href="${url}">${label}</a></li>`).join('')}<li><a href="${config.github}">GitHub ↗</a></li></ul></div></div><div class="footer-bottom"><span>AIMI Lab · Peking University</span><a href="${config.repository}">Website source ↗</a></div></div></footer>
<dialog class="search-dialog" data-search-dialog aria-labelledby="search-title"><header><h2 id="search-title">Search AIMI Lab</h2><button class="close-search" data-search-close aria-label="Close search">×</button></header><div class="search-body"><label class="sr-only" for="site-search">Search the website</label><input id="site-search" type="search" placeholder="People, research, publications…" autocomplete="off"><p class="search-hint" data-search-status aria-live="polite">Search people, research, news and publications. 支持中文搜索。</p><ul class="search-results" data-search-results></ul></div></dialog>`;}
function layout(title,url,body,description=config.description){return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title==='Overview'?'AIMI Lab · Peking University':title+' | AIMI Lab · Peking University')}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#0c2c46"><link rel="canonical" href="${config.url}${url}"><meta property="og:title" content="${esc(title+' · AIMI Lab')}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${config.url}${url}"><meta property="og:image" content="${config.url}/assets/lab-group-2026-web.jpg"><link rel="icon" href="/assets/lab-logo.png" type="image/png"><link rel="stylesheet" href="/styles.css"><script src="/site.js" defer></script></head><body>${header(url)}${body}${footer()}</body></html>`;}
function write(file,data){generated.set(file,Buffer.isBuffer(data)?data:Buffer.from(data));}
const urlFile = url => path.join(decodeURIComponent(url).replace(/^\//,''),'index.html');
const sections={
 '/news/':['From the lab','News','Discoveries, milestones and life at AIMI. 实验室动态'],
 '/people/':['Our community','People','Meet the researchers and students advancing intelligent medical imaging.'],
 '/research/':['From methods to medicine','Research Projects','Exploring artificial intelligence across image formation, image analysis and clinical decision support.'],
 '/publications/':['Our work','Publications','Journal articles and conference contributions from AIMI and earlier research.'],
 '/contact/':['Connect with us','Contact','Institute of Medical Technology · Peking University Health Science Center']
};
function banner(title,eyebrow,description,profile=false){return `<div class="page-banner"><div class="wrap"><nav class="breadcrumbs" aria-label="Breadcrumb"><a href="/">Home</a><span aria-hidden="true">/</span>${profile?'<a href="/people/">People</a><span aria-hidden="true">/</span>':''}<span aria-current="page">${esc(title)}</span></nav><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;}
function aside(current){const isProfile=current.startsWith('/people/');return `<aside class="section-nav" aria-label="${isProfile?'People':'Explore AIMI'}"><p>${isProfile?'People':'Explore AIMI'}</p>${(isProfile?[['/people/','All members'],...Object.entries(profiles).map(([name,slug])=>[`/people/${slug}/`,name])]:navItems.slice(1)).map(([url,label])=>`<a href="${url}"${url===current?' aria-current="page"':''}>${label}<span aria-hidden="true">↗</span></a>`).join('')}<p class="aside-note">AIMI Lab<br>Institute of Medical Technology<br>Peking University</p></aside>`;}
function pageShell(url,content){const profile=!!url.startsWith('/people/')&&url!='/people/';const p=pages.find(p=>pageRoute(p)===url);const [label,title,description]=sections[url]||['Our people',p?.title||'AIMI Lab',''];return `<main id="main">${banner(title,label,description,profile)}<div class="wrap page-layout">${aside(url)}<div${profile?' class="profile-content"':''}>${content}</div></div></main>`;}
function home(){const p=pages.find(p=>p.path==='/');const paras=[...p.html.matchAll(/<p>[\s\S]*?<\/p>/g)].map(m=>m[0]).filter(t=>!/<img|Github/.test(t));return `<main id="main">
<section class="hero"><div class="hero-grid"><div class="hero-copy"><p class="eyebrow">AIMI Lab · Peking University</p><h1>Advancing intelligence<br>in <em>medical imaging.</em></h1><p class="hero-description">From fundamental research to clinical translation, we develop artificial intelligence for the next generation of precision medicine.</p><div class="hero-actions"><a class="button light" href="/research/">Explore our research ${arrow}</a><a class="text-link" href="/people/">Meet the team ${straight}</a></div></div><figure class="hero-visual"><img src="/assets/lab-group-2026-web.jpg" alt="AIMI Lab members together at a group outing" width="1920" height="1080" fetchpriority="high"><figcaption><strong>A community of curious minds.</strong><a href="/assets/lab-group-2026.jpg">View photograph ↗</a></figcaption></figure></div></section>
<div class="intro-strip"><div class="wrap"><p><strong>Artificial Intelligence for Medical Imaging</strong><br>Institute of Medical Technology, Peking University Health Science Center</p><p class="zh" lang="zh-CN">北京大学医学部医学技术研究院智能医学影像实验室<br>面向精准医学，探索人工智能与医学影像的交叉前沿。</p></div></div>
<section class="section"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">From methods to medicine</p><h2>Research at AIMI</h2><p class="section-description">Developing intelligent imaging technologies to support diagnosis, treatment planning and therapy assessment.</p></div><a class="text-link" href="/research/">All research ${straight}</a></div><div class="research-grid">${projects.map((project,i)=>`<a class="research-card" href="/research/#${project.id}"><div class="research-image">${picture(project.images[0].url,project.title)}</div><small>Research ${String(i+1).padStart(2,'0')}</small><h3>${esc(project.title)}</h3>${arrow}</a>`).join('')}</div></div></section>
<section class="section soft"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Life & discoveries</p><h2>Latest news <span lang="zh-CN" class="section-chinese">最新动态</span></h2></div><a class="text-link" href="/news/">All news ${straight}</a></div><div class="news-grid">${news.slice(0,3).map(item=>`<article class="news-card"><span class="tag">Lab news</span><h3><a href="/news/#${item.id}">${esc(item.title)}</a></h3><p>${esc(plain(item.bodyHtml).replace(item.title,'').trim().slice(0,135))}…</p><a class="text-link" href="/news/#${item.id}">Read story ${straight}</a></article>`).join('')}</div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">Knowledge in the making</p><h2>Recent publications</h2></div><a class="text-link" href="/publications/">All publications ${straight}</a></div>${publications.slice(0,3).map(p=>`<article class="publication-preview"><div class="pub-index">${p.year} <span aria-hidden="true"> / </span> PUBLICATION</div><div><a href="/publications/#${p.id}">${html(p.html)}</a></div></article>`).join('')}</div></section>
<section class="section soft" id="about"><div class="wrap"><div class="about-grid"><div><p class="eyebrow">About the lab</p><h2>At the intersection<br>of AI and medicine.</h2><p class="section-description">Artificial Intelligence for Medical Imaging<br>智能医学影像实验室</p><a class="text-link" href="/people/" style="margin-top:25px">Our people ${straight}</a></div><div class="prose">${paras.map(html).join('')}</div></div><div class="home-gallery"><figure><a href="/assets/lab-group-2025.jpg">${picture('https://pkuaimi.com/wp-content/uploads/2025/11/%E5%90%88%E5%BD%B12.jpg','AIMI Lab group photograph')}</a><figcaption>Our team · AIMI Lab</figcaption></figure><figure>${picture('https://pkuaimi.com/wp-content/uploads/2025/11/AIMI2.png','AIMI circuit-tree illustration')}<figcaption>Artificial Intelligence for Medical Imaging</figcaption></figure></div></div></section>
</main>`;}
function filterBar(kind,years=[]){return `<div class="filter-bar" data-filter data-singular="${kind==='publications'?'publication':'news item'}" data-plural="${kind==='publications'?'publications':'news items'}"><div class="filter-field">${searchIcon}<label class="sr-only" for="content-filter">Search ${kind}</label><input id="content-filter" type="search" placeholder="${kind==='publications'?'Search by title, author or keyword…':'Search lab news…'}"></div>${years.length?`<label class="sr-only" for="year-filter">Publication year</label><select id="year-filter"><option value="">All years</option>${years.map(y=>`<option value="${y}">${y}</option>`).join('')}</select>`:''}</div><p class="result-count" data-result-count aria-live="polite"></p><p class="empty-state" data-empty hidden>No matching results. Try another keyword.</p>`;}
function newsPage(){return filterBar('news')+news.map((item,i)=>{
 let body=item.bodyHtml;
 body=body.replace(/^\s*<h[1-6]>([\s\S]*?)<\/h[1-6]>/, (whole,title)=>plain(title)===item.title?'':whole);
 const pictures=(item.images||[]).filter(im=>!body.includes(im.url));
 return `<article class="news-entry" id="${item.id}" data-filter-item><span class="entry-number">AIMI NEWS <span aria-hidden="true"> / </span> ${String(i+1).padStart(2,'0')}</span><h2>${esc(item.title)}</h2><div class="prose">${html(body)}${pictures.map(im=>figure(im.url,im.alt||item.title)).join('')}</div></article>`;
}).join('');}
function peoplePage(){const groups=[...new Set(people.map(p=>p.group))];return groups.map((group,i)=>`<section class="people-group" aria-labelledby="group-${i}"><h2 class="people-group-title" id="group-${i}">${esc(group==='Falculty'?'Faculty':group)}</h2><div class="people-cards">${people.filter(p=>p.group===group).map(person=>{
 const url=person.profilePath?localUrl(person.profilePath):null;
 const tag=url?'a':'article';
 return `<${tag} class="person-card"${url?` href="${url}"`:''} id="${person.id}">${picture(person.image,person.name)}<h3>${esc(person.name)}</h3><p>${esc(group==='Falculty'?'Faculty':group)}</p>${url?`<span class="text-link">View profile ${straight}</span>`:''}</${tag}>`;
 }).join('')}</div></section>`).join('');}
function researchPage(){return projects.map(project=>`<article class="project-entry" id="${project.id}"><h2>${esc(project.title)}</h2><div class="prose">${project.images.map(im=>figure(im.url,im.alt||project.title)).join('')}${html(project.descriptionHtml)}</div></article>`).join('');}
function publicationsPage(){const years=[...new Set(publications.map(p=>p.year))].filter(Boolean).sort((a,b)=>b-a);const groups=[...new Set(publications.map(p=>p.section))];return filterBar('publications',years)+groups.map(group=>`<section data-publication-group><h2 class="publication-group">${esc(group==='AIMI'?'Publications at AIMI':group)}</h2>${publications.filter(p=>p.section===group).map(p=>`<article class="publication-item" data-filter-item data-year="${p.year}" id="${p.id}"><div class="pub-year">${p.year||''}</div><div>${html(p.html)}</div></article>`).join('')}</section>`).join('');}
function contactPage(){return `<div class="contact-details"><section><h2>Email</h2><p><a href="mailto:${config.email}">${config.email}</a></p><a class="button" href="mailto:${config.email}">Write to us ${arrow}</a></section><section><h2>Address</h2><address>${config.address}</address></section></div><div class="contact-institution"><strong>${config.fullName} (AIMI) Lab</strong><br>${config.institute}<br>${config.institution}<br><span lang="zh-CN">${config.chineseName}</span></div>`;}
for(const p of pages){
 const url=pageRoute(p);let content;
 if(url==='/')content=home();
 else {const body=url==='/news/'?newsPage():url==='/people/'?peoplePage():url==='/research/'?researchPage():url==='/publications/'?publicationsPage():url==='/contact/'?contactPage():`<div class="prose">${html(p.html)}</div>`;content=pageShell(url,body);}
 const pageHtml=layout(url==='/'?'Overview':p.title,url,content);
 write(urlFile(url),pageHtml);
 // Keep every original pathname working on the new host, with a canonical clean URL.
 if(uri(p.path)!==uri(url))write(urlFile(p.path),pageHtml);
}
write('404.html',layout('Page not found','/404.html',`<main class="not-found" id="main"><p class="eyebrow" style="justify-content:center">AIMI Lab</p><h1>404</h1><p>We couldn’t find this page. Explore the lab using the links below.</p><a class="button" href="/">Back to the homepage ${straight}</a></main>`));
const index=[...pages.filter(p=>!['News','Publications'].includes(p.title)).map(p=>({title:p.title==='AIMI'?'About AIMI Lab':p.title,url:pageRoute(p),text:plain(p.html)})),...news.map(n=>({title:n.title,url:'/news/#'+n.id,text:plain(n.bodyHtml)})),...publications.map(p=>({title:p.citation,url:'/publications/#'+p.id,text:p.citation}))];
write('search-index.json',JSON.stringify(index));
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${pages.map(p=>`<url><loc>${config.url}${pageRoute(p)}</loc></url>`).join('')}</urlset>`);
write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
write('.nojekyll','');
const copyPublic=dir=>{for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())copyPublic(full);else if(!file.name.endsWith('.part')&&file.name!=='.DS_Store')write(path.relative('public',full),fs.readFileSync(full));}};
copyPublic('public');
// Only remove files previously generated by this builder, never source files.
const previous=fs.existsSync('generated-files.json')?read('generated-files.json'):[];
for(const old of previous){if(!generated.has(old)&&!old.includes('..')&&!path.isAbsolute(old)){for(const base of ['.',out]){const full=path.join(base,old);if(fs.existsSync(full)&&fs.statSync(full).isFile())fs.unlinkSync(full);}}}
for(const [name,data] of generated){for(const base of [out,'.']){const target=path.join(base,name);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||!fs.readFileSync(target).equals(data))fs.writeFileSync(target,data);}}
fs.writeFileSync('generated-files.json',JSON.stringify([...generated.keys()].sort(),null,2)+'\n');
console.log(`Built ${pages.length} content pages, ${news.length} news items, ${people.length} people, ${publications.length} publications, ${projects.length} research projects.`);
console.log('Ready in dist/ and repository root (GitHub Pages main /).');
