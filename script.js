// Disable browser scroll restoration and clear hash on load
if (history.scrollRestoration) {
    history.scrollRestoration = 'manual';
}
if (window.location.hash) {
    window.history.replaceState(null, null, window.location.pathname + window.location.search);
}
window.scrollTo(0, 0);

// MAIN SCRIPT — Interactions only (NO content-hiding animations)
document.addEventListener('DOMContentLoaded', () => {
    'use strict';

    // ── 0. Page Loader ────────────────────────────────────────
    const loader = document.getElementById('page-loader');
    if (loader) {
        setTimeout(() => {
            loader.classList.add('hidden');
        }, 1600);
    }

    // ── 1. Lenis Smooth Scroll ────────────────────────────────
    let lenis = null;
    try {
        lenis = new Lenis({ duration: 1.4, easing: t => Math.min(1, 1.001 - Math.pow(2, -10 * t)) });
        gsap.ticker.add(time => lenis.raf(time * 1000));
        gsap.ticker.lagSmoothing(0);
    } catch (e) { /* fallback */ }

    gsap.registerPlugin(ScrollTrigger);

    // ── Stat Counters ─────────────────────────────────────────
    const statNums = document.querySelectorAll('.stat-num');
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (!entry.isIntersecting) return;
            const el = entry.target;
            const target = parseInt(el.dataset.target, 10);
            const dur = 1800;
            const start = performance.now();
            const tick = (now) => {
                const progress = Math.min((now - start) / dur, 1);
                const ease = 1 - Math.pow(1 - progress, 3);
                el.textContent = Math.round(ease * target);
                if (progress < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
            counterObserver.unobserve(el);
        });
    }, { threshold: 0.5 });
    statNums.forEach(n => counterObserver.observe(n));



    // ── 2. Navbar scroll state + progress bar ────────────────
    const navbar = document.getElementById('navbar');
    const progress = document.getElementById('scroll-progress');

    const onScroll = () => {
        const scrollTop = window.scrollY;
        const docHeight = document.documentElement.scrollHeight - window.innerHeight;
        const scrolledPct = docHeight > 0 ? (scrollTop / docHeight) * 100 : 0;

        if (navbar) navbar.classList.toggle('scrolled', scrollTop > 50);
        if (progress) progress.style.width = scrolledPct + '%';
    };

    if (lenis) lenis.on('scroll', ({ scroll }) => {
        const docH = document.documentElement.scrollHeight - window.innerHeight;
        if (navbar) navbar.classList.toggle('scrolled', scroll > 50);
        if (progress) progress.style.width = (docH > 0 ? (scroll / docH) * 100 : 0) + '%';
    });
    else window.addEventListener('scroll', onScroll);

    // ── 3. Active nav-link highlighting (IntersectionObserver) ─
    const sections = document.querySelectorAll('section[id]');
    const navLinks = document.querySelectorAll('.nav-link');

    const sectionObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                navLinks.forEach(a => a.classList.remove('active'));
                const active = document.querySelector(`.nav-link[href="#${entry.target.id}"]`);
                if (active) active.classList.add('active');
            }
        });
    }, { rootMargin: '-40% 0px -55% 0px' });

    sections.forEach(s => sectionObserver.observe(s));

    // ── 4. Smooth scroll for nav links (integrate with Lenis) ─
    navLinks.forEach(link => {
        link.addEventListener('click', e => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (!target) return;
            if (lenis) lenis.scrollTo(target, { offset: -100 });
            else target.scrollIntoView({ behavior: 'smooth' });
        });
    });


    // ── 2. Custom Cursor ──────────────────────────────────────
    const dot = document.getElementById('custom-cursor');
    const ring = document.getElementById('cursor-follower');
    let mx = 0, my = 0, rx = 0, ry = 0;

    document.addEventListener('mousemove', e => {
        mx = e.clientX; my = e.clientY;
        if (dot) gsap.set(dot, { x: mx, y: my });
    });

    gsap.ticker.add(() => {
        rx += (mx - rx) * 0.1;
        ry += (my - ry) * 0.1;
        if (ring) gsap.set(ring, { x: rx, y: ry });
    });

    document.querySelectorAll('a, button, .service-card, .stack-item, .project-row, .magnetic-btn').forEach(el => {
        el.addEventListener('mouseenter', () => ring && ring.classList.add('hover-active'));
        el.addEventListener('mouseleave', () => ring && ring.classList.remove('hover-active'));
    });

    // ── 3. Magnetic Buttons ───────────────────────────────────
    document.querySelectorAll('.magnetic-btn').forEach(btn => {
        btn.addEventListener('mousemove', e => {
            const r = btn.getBoundingClientRect();
            gsap.to(btn, {
                x: (e.clientX - r.left - r.width / 2) * 0.28,
                y: (e.clientY - r.top - r.height / 2) * 0.28,
                duration: 0.35, ease: 'power2.out',
            });
        });
        btn.addEventListener('mouseleave', () => {
            gsap.to(btn, { x: 0, y: 0, duration: 0.5, ease: 'elastic.out(1, 0.4)' });
        });
    });

    // ── 4. Hero Image 3D Tilt ─────────────────────────────────
    const imgInner = document.querySelector('.hero-image-inner');
    const glare = document.querySelector('.hero-image-glare');
    if (imgInner) {
        document.addEventListener('mousemove', e => {
            const rX = (e.clientX / window.innerWidth - 0.5) * 20;
            const rY = (e.clientY / window.innerHeight - 0.5) * -20;
            gsap.to(imgInner, { rotationY: rX, rotationX: rY, duration: 1, ease: 'power2.out' });
            if (glare) {
                gsap.to(glare, {
                    x: (e.clientX / window.innerWidth) * 200,
                    y: (e.clientY / window.innerHeight) * 200,
                    duration: 1, ease: 'power2.out',
                });
            }
        });
    }

    // ── 5. CSS-class-based scroll reveals (NO opacity:0 in JS) ─
    // We simply ADD a class when elements enter the viewport.
    // All elements start VISIBLE. The CSS adds a subtle slide-up on appear.
    const revealObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
                revealObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    document.querySelectorAll(
        '.section-title, .large-text, .medium-text, .about-list, ' +
        '.service-card, .stack-item, .project-category, .project-row, ' +
        '.split-col, .huge-text, .contact-sub, .contact-links, .category-header'
    ).forEach(el => {
        if (!el.closest('#home')) revealObserver.observe(el);
    });

});
