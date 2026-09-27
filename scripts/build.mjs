import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
const read = name => JSON.parse(fs.readFileSync(name,'utf8'));
const config = read('site.config.json');
const pages = read('content/pages.json');
const news = read('content/news.json');
const people = read('content/people.json');
const publications = read('content/publications.json');
const projects = read('content/research.json');
const translations=Object.fromEntries(['pages','news','people','research'].map(kind=>[kind,read(`content/${kind}.locales.json`)]));
const ui=read('content/ui.json');
for(const key of ['fullName','institution','institute','address','description']) ui.en[key]=config[key];
let language='en';
const t=key=>{const value=ui[language][key];if(typeof value!=='string')throw new Error(`Missing ${language} UI text: ${key}`);return value;};
const localized=(kind,id)=>{const value=translations[kind][id]?.[language];if(!value)throw new Error(`Missing ${language} translation: ${kind}/${id}`);return value;};
const pageUrl=(url,lang=language)=>lang==='zh'?'/zh'+url:url;
const media = read('content/media-map.json');
const displayMedia = fs.existsSync('content/media-display-map.json') ? read('content/media-display-map.json') : {};
const provenance = read('content/media-provenance.json');
const imageSizes = new Map([...provenance.assets,...provenance.displayVariants].map(im=>[im.path,{width:im.width,height:im.height}]));
const out = 'dist';
const assetVersion = createHash('sha256').update(fs.readFileSync('public/styles.css')).update(fs.readFileSync('public/site.js')).digest('hex').slice(0,10);
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
 if(raw.startsWith('#')||raw.startsWith('/assets/'))return raw;
 if(display && displayMedia[raw]) return typeof displayMedia[raw]==='string'?displayMedia[raw]:displayMedia[raw].path;
 if(media[raw] && !display) return media[raw];
 let url;
 try {url=new URL(raw,'https://pkuaimi.com');}catch{return raw;}
 if (['pkuaimi.com','www.pkuaimi.com','i0.wp.com','i1.wp.com','i2.wp.com'].includes(url.hostname)) {
   const pathname=uri(url.pathname.replace(/^\/pkuaimi\.com/,''));
   const asset = (display && displayByPath.get(pathname)) || media[raw] || mediaByPath.get(pathname);
   if(asset)return asset;
   if(url.searchParams.has('page_id')) {const p=pages.find(p=>String(p.id)===url.searchParams.get('page_id'));if(p)return pageUrl(pageRoute(p))+url.hash;}
   if(routes.has(pathname)) return pageUrl(routes.get(pathname))+url.hash;
   if([...routes.values()].some(route=>uri(route)===pathname))return pageUrl(url.pathname)+url.search+url.hash;
   if(url.hostname==='pkuaimi.com' && raw.startsWith('/'))return raw;
 }
 return raw;
}
function dimensions(file) { const size=imageSizes.get(file);return size?.width&&size?.height?` width="${size.width}" height="${size.height}"`:''; }
function html(source) {
 return String(source||'').replace(/\b(href|src)="([^"]*)"/g,(_,attr,url)=>`${attr}="${esc(localUrl(url,attr==='src'))}"`)
 .replace(/<img\b([^>]*?)>/g, (tag,attrs)=>/\bwidth=/.test(attrs)?tag:`<img${attrs}${dimensions(decode(attrs.match(/src="([^"]*)"/)?.[1]||''))}>`)
 .replace(/<h6>([\s\S]*?)<\/h6>/g,(_,content)=>plain(content).length>100?`<p>${content}</p>`:`<h3>${content}</h3>`)
 .replace(/<(p|h[1-6])>([\s\S]*?)<\/\1>/g,(_,tag,body)=>`<${tag}${contentLang(body)}>${body}</${tag}>`);
}
const contentLang=value=>/^[\u3400-\u9fff]/.test(plain(value).replace(/^[^a-z\u3400-\u9fff]+/i,''))?' lang="zh-CN"':'';
const picture=(source,alt='',extra='')=>`<img src="${esc(localUrl(source,true))}" alt="${esc(alt)}" loading="lazy" decoding="async"${dimensions(localUrl(source,true))} ${extra}>`;
const figure=(source,alt='',extra='')=>`<figure><a href="${esc(localUrl(source))}" aria-label="${esc(t('fullImage')+alt)}">${picture(source,alt,extra)}</a></figure>`;
const arrow='<span class="arrow" aria-hidden="true">↗</span>';
const straight='<span class="arrow" aria-hidden="true">→</span>';
const searchIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></svg>';
const navItems=[['/','overview'],['/news/','news'],['/people/','people'],['/research/','research'],['/publications/','publications'],['/contact/','contact']];
const groupKeys={'Falculty':'faculty','Faculty':'faculty','Post-Doctors':'postdocs','Research Assistants':'assistants','PhD Students':'phd','Master Students':'masters','Visiting Graduate Students':'visiting','Bachelor Students':'bachelors','Alumni':'alumni'};
const active=(url,current)=>url==='/'?current==='/':current.startsWith(url);
const currentNews=()=>news.map(item=>({...item,...localized('news',item.id)}));
const currentProjects=()=>projects.map(item=>({...item,...localized('research',item.id)}));
const currentPeople=()=>people.map(item=>({...item,...localized('people',item.id)}));
function header(current){
 const other=language==='en'?'zh':'en';
 return `<a class="skip-link" href="#main">${t('skip')}</a>
<header class="site-header"><div class="wrap header-inner"><a class="identity" href="${pageUrl('/')}" aria-label="${t('homeLabel')}"><span class="wordmark">AIMI<span class="dot" aria-hidden="true"></span></span><span class="identity-text">${t('university')}<span>${t('identitySubtitle')}</span></span></a><nav class="navigation" aria-label="${t('navLabel')}"><ul class="nav-links" id="primary-navigation" data-nav-links>${navItems.map(([url,key])=>`<li><a href="${pageUrl(url)}"${active(url,current)?' aria-current="page"':''}>${t(key)}</a></li>`).join('')}</ul></nav><div class="header-actions"><a class="language-switch" data-language-switch href="${pageUrl(current,other)}" hreflang="${other==='zh'?'zh-CN':'en'}" lang="${other==='zh'?'zh-CN':'en'}" aria-label="${t('switchLabel')}">${other==='zh'?'中文':'English'}</a><button class="search-toggle" data-search-open aria-label="${t('searchOpen')}">${searchIcon}</button><button class="menu-toggle" data-menu-toggle aria-expanded="false" aria-controls="primary-navigation"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 8h16M4 16h16"/></svg><span data-menu-label class="sr-only">${t('menu')}</span></button></div></div></header>`;
}
function footer(){return `<footer class="site-footer"><div class="wrap"><div class="footer-grid"><div><a class="footer-brand" href="${pageUrl('/')}">${t('labName')}</a><p>${t('fullName')}<br>${t('institute')}<br>${t('institution')}</p></div><div><h2>${t('getInTouch')}</h2><p>${t('address')}</p><a class="text-link" href="mailto:${config.email}">${config.email} ${arrow}</a></div><nav aria-label="${t('footerNav')}"><h2>${t('explore')}</h2><ul class="footer-links">${navItems.slice(1).map(([url,key])=>`<li><a href="${pageUrl(url)}">${t(key)}</a></li>`).join('')}<li><a href="${config.github}">GitHub ↗</a></li></ul></nav></div><div class="footer-bottom"><a href="https://www.pku.edu.cn/">${t('university')}</a><a href="${config.repository}">${t('websiteSource')} ↗</a></div></div></footer>
<dialog class="search-dialog" data-search-dialog aria-labelledby="search-title"><header><h2 id="search-title">${t('searchTitle')}</h2><button class="close-search" data-search-close aria-label="${t('searchClose')}">×</button></header><div class="search-body"><label class="sr-only" for="site-search">${t('searchLabel')}</label><input id="site-search" type="search" placeholder="${t('searchPlaceholder')}" autocomplete="off"><p class="search-hint" data-search-status aria-live="polite">${t('searchHint')}</p><ul class="search-results" data-search-results></ul></div></dialog>`;}
function layout(title,url,body,description=t('description')){
 const canonical=config.url+pageUrl(url);
 const messages=JSON.stringify(Object.fromEntries(['menu','menuClose','scrollableTable','searchHint','searching','searchError','resultSingular','resultPlural','searchEmpty'].map(key=>[key,t(key)]))).replace(/</g,'\\u003c');
 return `<!doctype html>
<html lang="${language==='zh'?'zh-CN':'en'}" data-language="${language}" class="no-js"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc((url==='/'?'':title+' | ')+t('labName')+' · '+t('university'))}</title><meta name="description" content="${esc(description)}"><meta name="theme-color" content="#fafafa"><link rel="canonical" href="${canonical}"><link rel="alternate" hreflang="en" href="${config.url}${pageUrl(url,'en')}"><link rel="alternate" hreflang="zh-CN" href="${config.url}${pageUrl(url,'zh')}"><link rel="alternate" hreflang="x-default" href="${config.url}${pageUrl(url,'en')}"><meta property="og:title" content="${esc(title+' · '+t('labName'))}"><meta property="og:description" content="${esc(description)}"><meta property="og:type" content="website"><meta property="og:url" content="${canonical}"><meta property="og:locale" content="${language==='zh'?'zh_CN':'en_US'}"><meta property="og:image" content="${config.url}/assets/lab-group-2026-web.jpg"><link rel="icon" href="/assets/lab-logo.png" type="image/png"><link rel="stylesheet" href="/styles.css?v=${assetVersion}"><script type="application/json" id="ui-messages">${messages}</script><script src="/site.js?v=${assetVersion}" defer></script></head><body>${header(url)}${body}${footer()}</body></html>`;
}
function write(file,data){generated.set(file,Buffer.isBuffer(data)?data:Buffer.from(data));}
const urlFile=url=>url.endsWith('.html')?url.replace(/^\//,''):path.join(decodeURIComponent(url).replace(/^\//,''),'index.html');
const sectionInfo=url=>({
 '/news/':[t('news'),t('newsDescription')],
 '/people/':[t('people'),t('peopleDescription')],
 '/research/':[t('researchTitle'),t('researchDescription')],
 '/publications/':[t('publications'),t('publicationsDescription')],
 '/contact/':[t('contact'),t('institute')+' · '+t('institution')]
})[url];
function pageTitle(p){return p.path==='/'?t('overview'):sectionInfo(pageRoute(p))?.[0]||localized('pages',p.id).title;}
function banner(title,description,profile=false){return `<div class="page-banner"><div class="wrap"><nav class="breadcrumbs" aria-label="${t('breadcrumb')}"><a href="${pageUrl('/')}">${t('labName')}</a><span aria-hidden="true">/</span>${profile?`<a href="${pageUrl('/people/')}">${t('people')}</a><span aria-hidden="true">/</span>`:''}<span aria-current="page">${esc(title)}</span></nav><h1>${esc(title)}</h1>${description?`<p>${esc(description)}</p>`:''}</div></div>`;}
function aside(current){return `<aside class="section-nav" aria-label="${t('people')}"><p>${t('people')}</p>${[[pageUrl('/people/'),t('allMembers')],...pages.filter(p=>profiles[p.title]).map(p=>[pageUrl(pageRoute(p)),localized('pages',p.id).title])].map(([url,label])=>`<a href="${url}"${url===pageUrl(current)?' aria-current="page"':''}>${esc(label)}<span aria-hidden="true">↗</span></a>`).join('')}<p class="aside-note">${t('labName')}<br>${t('institute')}<br>${t('university')}</p></aside>`;}
function pageShell(url,content){const profile=url.startsWith('/people/')&&url!='/people/';const p=pages.find(p=>pageRoute(p)===url);const [title,description]=sectionInfo(url)||[localized('pages',p.id).title,''];return `<main id="main" class="page-${profile?'profile':url.split('/')[1]}">${banner(title,description,profile)}<div class="wrap page-layout${profile?' has-sidebar':''}">${profile?aside(url):''}<div class="${profile?'profile-content':'page-content'}">${content}</div></div></main>`;}
function newsExcerpt(item){const lead=item.bodyHtml.replace(/^\s*<h[1-6]>[\s\S]*?<\/h[1-6]>/,'').split(/<\/p>|<h[1-6]>/)[0];const text=plain(lead).replace(item.title,'').trim();const limit=language==='zh'?100:180;return text.length>limit?text.slice(0,limit)+'…':text;}
function home(){const p=pages.find(p=>p.path==='/');const paras=[...localized('pages',p.id).html.matchAll(/<p\b[^>]*>[\s\S]*?<\/p>/g)].map(m=>m[0]).filter(value=>!/<img|Github/i.test(value)&&plain(value));return `<main id="main">
<section class="lab-intro" aria-labelledby="lab-welcome"><div class="wrap lab-intro-grid"><div class="lab-intro-copy"><p class="lab-affiliation">${t('institution')}<span>${t('institute')}</span></p><h1 id="lab-welcome">${t('welcome')}</h1><p class="lab-full-name">${t('fullName')}</p><p class="lab-introduction">${t('intro')}</p><a class="lab-more" href="#about">${t('aboutLab')} ${straight}</a></div><figure class="lab-intro-visual"><a href="/assets/lab-group-2026.jpg" aria-label="${t('viewTeamPhoto')}"><img src="/assets/lab-group-2026-web.jpg" alt="${t('teamPhotoAlt')}" width="1920" height="1080" fetchpriority="high"></a><figcaption><span>${t('labName')} · ${t('university')}</span><a href="${pageUrl('/people/')}">${t('ourTeam')} ${straight}</a></figcaption></figure></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">${t('research')}</p><h2>${t('researchHeading')}</h2><p class="section-description">${t('researchSummary')}</p></div><a class="text-link" href="${pageUrl('/research/')}">${t('allResearch')} ${straight}</a></div><div class="research-grid">${currentProjects().map((project,i)=>`<a class="research-card" href="${pageUrl('/research/')}#${project.id}"><div class="research-image">${picture(project.images[0].url,project.title)}</div><div class="research-card-copy"><small>${t('researchItem')} ${String(i+1).padStart(2,'0')}</small><h3>${esc(project.title)}</h3><span class="text-link">${t('discoverProject')} ${straight}</span></div></a>`).join('')}</div></div></section>
<section class="section soft"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">${t('fromLab')}</p><h2>${t('latestNews')}</h2></div><a class="text-link" href="${pageUrl('/news/')}">${t('allNews')} ${straight}</a></div><div class="news-grid">${currentNews().slice(0,3).map(item=>`<article class="news-card">${item.images[0]?`<a class="news-card-image" href="${pageUrl('/news/')}#${item.id}" aria-label="${esc(item.title)}">${picture(item.images[0].url,'')}</a>`:''}<div class="news-card-copy"><h3><a href="${pageUrl('/news/')}#${item.id}">${esc(item.title)}</a></h3><p>${esc(newsExcerpt(item))}</p><a class="text-link" href="${pageUrl('/news/')}#${item.id}">${t('readStory')} ${straight}</a></div></article>`).join('')}</div></div></section>
<section class="section"><div class="wrap"><div class="section-heading"><div><p class="eyebrow">${t('publications')}</p><h2>${t('publicationsHeading')}</h2></div><a class="text-link" href="${pageUrl('/publications/')}">${t('allPublications')} ${straight}</a></div>${publications.slice(0,3).map(p=>`<article class="publication-preview"><div class="pub-index">${p.year}</div><div lang="en"><a href="${pageUrl('/publications/')}#${p.id}">${html(p.html)}</a></div><a class="publication-arrow" href="${pageUrl('/publications/')}#${p.id}" aria-label="${esc(t('readPublication')+p.citation)}">${straight}</a></article>`).join('')}</div></section>
<section class="section soft" id="about"><div class="wrap"><div class="about-grid"><div><p class="eyebrow">${t('aboutEyebrow')}</p><h2>${t('aboutHeading')}</h2><p class="section-description">${t('fullName')}</p><a class="text-link about-link" href="${pageUrl('/people/')}">${t('meetPeople')} ${straight}</a></div><div class="prose">${paras.map(html).join('')}</div></div><div class="home-gallery"><figure><a href="/assets/lab-group-2025.jpg">${picture('https://pkuaimi.com/wp-content/uploads/2025/11/%E5%90%88%E5%BD%B12.jpg',t('groupPhotoAlt'))}</a><figcaption>${t('ourTeam')} · ${t('labName')}</figcaption></figure><figure>${picture('https://pkuaimi.com/wp-content/uploads/2025/11/AIMI2.png',t('circuitTreeAlt'))}<figcaption>${t('fullName')}</figcaption></figure></div></div></section>
</main>`;}
function filterBar(kind,years=[]){const pubs=kind==='publications';return `<div class="filter-bar" data-filter data-singular="${t(pubs?'publicationSingular':'newsSingular')}" data-plural="${t(pubs?'publicationPlural':'newsPlural')}"><div class="filter-field">${searchIcon}<label class="sr-only" for="content-filter">${t(pubs?'searchPublications':'searchNews')}</label><input id="content-filter" type="search" placeholder="${t(pubs?'publicationsPlaceholder':'newsPlaceholder')}"></div>${years.length?`<label class="sr-only" for="year-filter">${t('publicationYear')}</label><select id="year-filter"><option value="">${t('allYears')}</option>${years.map(y=>`<option value="${y}">${y}</option>`).join('')}</select>`:''}</div><p class="result-count" data-result-count aria-live="polite"></p><p class="empty-state" data-empty hidden>${t('empty')}</p>`;}
function newsPage(){return filterBar('news')+currentNews().map((item,i)=>{
 let body=item.bodyHtml.replace(/^\s*<h[1-6]>([\s\S]*?)<\/h[1-6]>/,(whole,title)=>plain(title)===item.title?'':whole);
 const pictures=(item.images||[]).filter(im=>!body.includes(im.url));
 const gallery=pictures.length?`<div class="news-gallery">${pictures.map(im=>figure(im.url,item.title)).join('')}</div>`:'';
 return `<article class="news-entry" id="${item.id}" data-filter-item><span class="entry-number">${t('newsLabel')} <span aria-hidden="true"> / </span> ${String(i+1).padStart(2,'0')}</span><h2>${esc(item.title)}</h2><div class="prose">${html(body.replace(/<h[2-6]>/g,'<h3>').replace(/<\/h[2-6]>/g,'</h3>'))}${gallery}</div></article>`;
}).join('');}
function peoplePage(){const members=currentPeople();const groups=[...new Set(members.map(p=>p.group))];return groups.map((group,i)=>`<section class="people-group${groupKeys[group]==='faculty'?' faculty-group':''}" aria-labelledby="group-${i}"><h2 class="people-group-title" id="group-${i}">${t(groupKeys[group])}</h2><div class="people-cards">${members.filter(p=>p.group===group).map(person=>{
 const url=person.profilePath?localUrl(person.profilePath):null;
 const tag=url?'a':'article';
 return `<${tag} class="person-card"${url?` href="${url}"`:''} id="${person.id}">${picture(person.image,person.name)}<h3>${esc(person.name)}</h3><p>${t(groupKeys[group])}</p>${url?`<span class="text-link">${t('viewProfile')} ${straight}</span>`:''}</${tag}>`;
 }).join('')}</div></section>`).join('');}
function researchPage(){return currentProjects().map(project=>`<article class="project-entry" id="${project.id}"><h2>${esc(project.title)}</h2><div class="prose">${project.images.map(im=>figure(im.url,project.title)).join('')}${html(project.descriptionHtml)}</div></article>`).join('');}
function publicationsPage(){const years=[...new Set(publications.map(p=>p.year))].filter(Boolean).sort((a,b)=>b-a);const groups=[...new Set(publications.map(p=>p.section))];return filterBar('publications',years)+groups.map(group=>`<section data-publication-group><h2 class="publication-group">${t(group==='AIMI'?'atAIMI':'beforeAIMI')}</h2>${publications.filter(p=>p.section===group).map(p=>`<article class="publication-item" data-filter-item data-year="${p.year}" id="${p.id}"><div class="pub-year">${p.year||''}</div><div lang="en">${html(p.html)}</div></article>`).join('')}</section>`).join('');}
function contactPage(){return `<div class="contact-details"><section><h2>${t('email')}</h2><p><a href="mailto:${config.email}">${config.email}</a></p><a class="button" href="mailto:${config.email}">${t('writeToUs')} ${arrow}</a></section><section><h2>${t('addressLabel')}</h2><address>${t('address')}</address></section></div><div class="contact-institution"><strong>${t('fullName')} (AIMI)</strong><br>${t('institute')}<br>${t('institution')}</div>`;}
for(const lang of ['en','zh']){
 language=lang;
 const search=[];
 for(const p of pages){
  const url=pageRoute(p);let content;
  if(url==='/')content=home();
  else {const body=url==='/news/'?newsPage():url==='/people/'?peoplePage():url==='/research/'?researchPage():url==='/publications/'?publicationsPage():url==='/contact/'?contactPage():`<div class="prose">${html(localized('pages',p.id).html)}</div>`;content=pageShell(url,body);}
  const pageHtml=layout(pageTitle(p),url,content);
  write(urlFile(pageUrl(url)),pageHtml);
  // Preserve every old pathname in the default English edition.
  if(language==='en'&&uri(p.path)!==uri(url))write(urlFile(p.path),pageHtml);
  if(!['/news/','/publications/'].includes(url)) search.push({title:pageTitle(p),url:pageUrl(url),text:plain(profiles[p.title]?localized('pages',p.id).html:content)});
 }
 write(urlFile(pageUrl('/404.html')),layout(t('notFound'),'/404.html',`<main class="not-found" id="main"><p class="eyebrow">${t('labName')}</p><h1>404</h1><p>${t('notFoundText')}</p><a class="button" href="${pageUrl('/')}">${t('backHome')} ${straight}</a></main>`));
 search.push(...currentNews().map(item=>({title:item.title,url:pageUrl('/news/')+'#'+item.id,text:plain(item.bodyHtml)})),...publications.map(item=>({title:item.citation,url:pageUrl('/publications/')+'#'+item.id,text:item.citation})));
 write(language==='zh'?'zh/search-index.json':'search-index.json',JSON.stringify(search));
}
write('sitemap.xml',`<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${['en','zh'].flatMap(lang=>pages.map(p=>`<url><loc>${config.url}${pageUrl(pageRoute(p),lang)}</loc></url>`)).join('')}</urlset>`);
write('robots.txt',`User-agent: *\nAllow: /\nSitemap: ${config.url}/sitemap.xml\n`);
write('.nojekyll','');
const copyPublic=dir=>{for(const file of fs.readdirSync(dir,{withFileTypes:true})){const full=path.join(dir,file.name);if(file.isDirectory())copyPublic(full);else if(!file.name.endsWith('.part')&&file.name!=='.DS_Store')write(path.relative('public',full),fs.readFileSync(full));}};
copyPublic('public');
// Only remove files previously generated by this builder, never source files.
const previous=fs.existsSync('generated-files.json')?read('generated-files.json'):[];
for(const old of previous){if(!generated.has(old)&&!old.includes('..')&&!path.isAbsolute(old)){for(const base of ['.',out]){const full=path.join(base,old);if(fs.existsSync(full)&&fs.statSync(full).isFile())fs.unlinkSync(full);}}}
for(const [name,data] of generated){for(const base of [out,'.']){const target=path.join(base,name);fs.mkdirSync(path.dirname(target),{recursive:true});if(!fs.existsSync(target)||!fs.readFileSync(target).equals(data))fs.writeFileSync(target,data);}}
fs.writeFileSync('generated-files.json',JSON.stringify([...generated.keys()].sort(),null,2)+'\n');
console.log(`Built English and Chinese editions of ${pages.length} content pages, ${news.length} news items, ${people.length} people, ${publications.length} publications, ${projects.length} research projects.`);
console.log('Ready in dist/ and repository root (GitHub Pages main /).');
