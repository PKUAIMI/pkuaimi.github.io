import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import 'lenis/dist/lenis.css';
import { activeChapter, lowResourceDevice, samePageAnchor } from './story-navigation.mjs';

const sections = [...document.querySelectorAll<HTMLElement>('[data-story-section]')];
const chapterLinks = [...document.querySelectorAll<HTMLAnchorElement>('[data-story-link]')];
const header = document.querySelector<HTMLElement>('.site-header');
const chapters = document.querySelector<HTMLElement>('.story-chapters');
const progress = document.querySelector<HTMLElement>('[data-story-progress]');
const reduced = matchMedia('(prefers-reduced-motion: reduce)');
const hardware = navigator as Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };
const lightweight = lowResourceDevice(hardware.hardwareConcurrency, hardware.deviceMemory || 0, hardware.connection?.saveData);

if (sections.length && header && chapters) initializeStory(header, chapters);

function initializeStory(header: HTMLElement, chapters: HTMLElement) {
  gsap.registerPlugin(ScrollTrigger);
  let lenis: Lenis | undefined;
  let bounds: { id: string; top: number }[] = [];
  let offset = 0;
  let frame = 0;
  let historyFrame = 0;
  let navigationTimer = 0;
  let resizeTimer = 0;
  // Native fragment scrolling can run before window.load. Reserve the requested
  // hash immediately so that an intermediate layout cannot replace it.
  let navigating = Boolean(location.hash);
  let preserveDeepLink = Boolean(location.hash);
  let preservedY = scrollY;
  let explicitHash = location.hash;
  let viewportWidth = innerWidth;
  let viewportHeight = innerHeight;
  let currentChapter = '';
  const previousRestoration = history.scrollRestoration;
  history.scrollRestoration = 'manual';

  function measure() {
    offset = header.offsetHeight + chapters.offsetHeight;
    document.body.style.setProperty('--story-header', `${header.offsetHeight}px`);
    document.documentElement.style.setProperty('--story-scroll-offset', `${offset}px`);
    bounds = sections.map(section => ({ id: section.id, top: section.getBoundingClientRect().top + scrollY - offset }));
    lenis?.resize();
    scheduleUpdate();
  }

  function notifyLanguageSwitch() {
    // replaceState/pushState do not emit hashchange; keep the language link in sync.
    window.dispatchEvent(new Event('aimi:sectionchange'));
  }

  function update() {
    frame = 0;
    // Also recognize native scrollbar dragging, which may produce no wheel event.
    const reflowing = innerWidth !== viewportWidth || innerHeight !== viewportHeight;
    if (preserveDeepLink && !navigating && !reflowing && Math.abs(scrollY - preservedY) > 3) {
      preserveDeepLink = false;
      explicitHash = '';
    }
    const maximum = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const active = activeChapter(bounds, scrollY, innerHeight - offset, maximum);
    if (active && active !== currentChapter) {
      currentChapter = active;
      for (const link of chapterLinks) {
        if (link.hash === `#${active}`) link.setAttribute('aria-current', 'location');
        else link.removeAttribute('aria-current');
      }
    }
    if (progress) progress.style.transform = `scaleX(${maximum ? Math.min(1, Math.max(0, scrollY / maximum)) : 0})`;
    // Passive reading replaces the current entry; explicit clicks push an entry.
    // Never overwrite the target hash while moving through intermediate sections.
    if (active && !navigating && !reflowing && !preserveDeepLink && !document.querySelector('dialog[open]') && location.hash !== `#${active}`) {
      history.replaceState(history.state, '', `${location.pathname}${location.search}#${active}`);
      notifyLanguageSwitch();
    }
  }

  function scheduleUpdate() {
    if (!frame) frame = requestAnimationFrame(update);
  }

  function finishNavigation() {
    navigating = false;
    preservedY = scrollY;
    clearTimeout(navigationTimer);
    scheduleUpdate();
  }

  function goTo(target: HTMLElement, immediate = false, focus = false) {
    navigating = true;
    preserveDeepLink = true;
    explicitHash = `#${target.id}`;
    clearTimeout(navigationTimer);
    const top = Math.max(0, target.getBoundingClientRect().top + scrollY - offset);
    const complete = () => {
      finishNavigation();
      // Keyboard navigation lands on the section, never on a now off-screen control.
      if (focus) {
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      }
    };
    if (lenis) lenis.scrollTo(top, { immediate, duration: 1, onComplete: complete });
    else {
      window.scrollTo({ top, behavior: immediate || reduced.matches ? 'instant' : 'smooth' });
      if (immediate || reduced.matches) complete();
      else navigationTimer = window.setTimeout(complete, 1100);
    }
  }

  document.addEventListener('click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const link = (event.target as Element).closest<HTMLAnchorElement>('a[href]');
    if (!link || link.target === '_blank' || link.hasAttribute('download')) return;
    const id = samePageAnchor(link.href, location.href);
    const target = id ? document.getElementById(id) : null;
    if (!target) return;
    event.preventDefault();
    if (location.hash !== link.hash) history.pushState(history.state, '', link.hash);
    notifyLanguageSwitch();
    goTo(target, false, event.detail === 0);
  });

  // Native hash links, direct arrivals, and back/forward share one path. Do not use
  // hash routing or a 404 redirect: GitHub Pages serves the same static document.
  function restoreHash() {
    cancelAnimationFrame(historyFrame);
    historyFrame = requestAnimationFrame(() => {
      const id = samePageAnchor(location.href, location.href);
      const target = id ? document.getElementById(id) : sections[0];
      if (target) goTo(target, true);
      else finishNavigation();
      notifyLanguageSwitch();
    });
  }
  window.addEventListener('popstate', restoreHash);
  window.addEventListener('hashchange', restoreHash);
  window.addEventListener('scroll', scheduleUpdate, { passive: true });
  function userScroll() {
    if (document.querySelector('dialog[open]')) return;
    clearTimeout(resizeTimer);
    if (navigating) lenis?.scrollTo(scrollY, { immediate: true });
    preserveDeepLink = false;
    explicitHash = '';
    finishNavigation();
  }
  window.addEventListener('wheel', userScroll, { passive: true });
  window.addEventListener('touchstart', userScroll, { passive: true });
  window.addEventListener('keydown', event => {
    if ((event.target as HTMLElement).closest('input,textarea,select,[contenteditable],dialog')) return;
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) userScroll();
  });

  // One clock for Lenis and ScrollTrigger. Touch screens, constrained devices,
  // and reduced-motion visitors retain native scrolling and fully visible content.
  const media = gsap.matchMedia();
  if (!lightweight) media.add('(min-width: 901px) and (pointer: fine) and (prefers-reduced-motion: no-preference)', () => {
    const smooth = new Lenis({
      lerp: 0.09,
      smoothWheel: true,
      syncTouch: false,
      anchors: false,
      prevent: node => Boolean(node.closest('dialog,[data-nav-links].is-open')),
    });
    lenis = smooth;
    document.documentElement.classList.add('story-motion');
    smooth.on('scroll', ScrollTrigger.update);
    const tick = (time: number) => smooth.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    // Triggered entrances complete even when scrolling stops; text is never scrubbed.
    for (const section of sections.slice(1)) {
      const elements = section.querySelectorAll('.section-heading,.about-heading,.people-group-title,.footer-brand');
      if (!elements.length) continue;
      gsap.fromTo(elements, { y: 24, opacity: 0 }, {
        y: 0, opacity: 1, duration: 0.65, stagger: 0.08, ease: 'power2.out',
        scrollTrigger: { trigger: section, start: 'top 82%', toggleActions: 'play none none reverse' },
      });
    }
    const home = sections[0];
    const clouds = home.querySelectorAll('[data-story-cloud]');
    clouds.forEach((cloud, index) => gsap.to(cloud, {
      y: index ? -55 : -130, ease: 'none',
      scrollTrigger: { trigger: home, start: 'top top', end: 'bottom top', scrub: true },
    }));
    gsap.to('[data-story-copy]', {
      y: -22, ease: 'none',
      scrollTrigger: { trigger: home, start: () => `top top+=${offset}`, end: 'bottom top', scrub: true },
    });
    const visual = home.querySelector<HTMLElement>('.lab-intro-visual');
    if (visual && innerHeight >= 700) ScrollTrigger.create({
      trigger: home,
      start: () => `top top+=${offset}`,
      end: () => `+=${Math.min(180, innerHeight * 0.18)}`,
      pin: visual,
      pinSpacing: false,
      anticipatePin: 1,
      invalidateOnRefresh: true,
    });

    function synchronizeOverlays() {
      const blocked = Boolean(document.querySelector('dialog[open],[data-menu-toggle][aria-expanded="true"]'));
      if (blocked) smooth.stop();
      else smooth.start();
    }
    const overlays = new MutationObserver(synchronizeOverlays);
    document.querySelectorAll('dialog,[data-menu-toggle]').forEach(node => overlays.observe(node, { attributes: true, attributeFilter: ['open', 'aria-expanded'] }));
    synchronizeOverlays();
    requestAnimationFrame(() => { measure(); ScrollTrigger.refresh(); });
    return () => {
      overlays.disconnect();
      gsap.ticker.remove(tick);
      smooth.destroy();
      lenis = undefined;
      document.documentElement.classList.remove('story-motion');
      requestAnimationFrame(measure);
    };
  });

  const resize = new ResizeObserver(measure);
  resize.observe(header);
  resize.observe(chapters);
  sections.forEach(section => resize.observe(section));
  ScrollTrigger.addEventListener('refresh', measure);
  window.addEventListener('resize', () => {
    const requestedHash = explicitHash;
    if (requestedHash) navigating = true;
    viewportWidth = innerWidth;
    viewportHeight = innerHeight;
    measure();
    clearTimeout(resizeTimer);
    // Reflow can move an explicitly selected chapter by several screens on a phone.
    // Passive reading keeps its normal position; a deep link stays at its target.
    if (requestedHash) resizeTimer = window.setTimeout(() => {
      const target = document.getElementById(requestedHash.slice(1));
      if (target && !document.querySelector('dialog[open]')) {
        history.replaceState(history.state, '', requestedHash);
        goTo(target, true);
        notifyLanguageSwitch();
      } else finishNavigation();
    }, 180);
  }, { passive: true });
  window.addEventListener('pageshow', event => {
    history.scrollRestoration = 'manual';
    if (event.persisted) { measure(); ScrollTrigger.refresh(); restoreHash(); }
  });
  window.addEventListener('pagehide', event => {
    history.scrollRestoration = previousRestoration;
    if (!event.persisted) { resize.disconnect(); media.revert(); }
  });
  measure();
  // Allow images/fonts and the pin spacer to settle before honoring a deep link.
  const ready = document.readyState === 'complete' ? Promise.resolve() : new Promise(resolve => window.addEventListener('load', resolve, { once: true }));
  void ready.then(() => document.fonts.ready).then(() => {
    measure();
    ScrollTrigger.refresh();
    if (location.hash) restoreHash();
    else scheduleUpdate();
  });
}
