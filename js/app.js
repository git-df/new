// Paint the saved theme background as early as possible (app.js is loaded in <head>),
// before Blazor/MudBlazor boots, to avoid a flash of the default theme. Mirrors
// window.theme + ThemeState defaults.
(function () {
    try {
        var mode = localStorage.getItem('portfolio-theme');
        if (mode !== 'light' && mode !== 'dark') {
            mode = (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) ? 'dark' : 'light';
        }
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.style.backgroundColor = mode === 'light' ? '#f6f6fb' : '#0b0b12';
    } catch (e) { }
})();

// Detects a new deployment by comparing the published version GUID (version.json,
// regenerated on every build) with the one stored locally. On a mismatch it wipes
// all caches, unregisters the service worker and reloads so everything is re-downloaded.
window.checkAppVersion = async () => {
    try {
        const response = await fetch('version.json', { cache: 'no-store' });
        if (!response.ok) {
            return;
        }

        const { version } = await response.json();
        if (!version) {
            return;
        }

        const storageKey = 'app-version';
        const stored = localStorage.getItem(storageKey);

        const cacheKeys = window.caches ? await caches.keys() : [];
        const hasOfflineCache = cacheKeys.some(key => key.startsWith('offline-cache-'));

        // Only force a refresh in production (a cached PWA), never during local dev.
        if (stored && stored !== version && hasOfflineCache) {
            await Promise.all(cacheKeys.map(key => caches.delete(key)));

            if (navigator.serviceWorker) {
                const registrations = await navigator.serviceWorker.getRegistrations();
                await Promise.all(registrations.map(registration => registration.unregister()));
            }

            localStorage.setItem(storageKey, version);
            location.reload();
            return;
        }

        localStorage.setItem(storageKey, version);
    } catch {
        // Offline or version.json unavailable: keep the currently cached app.
    }
};

window.initAos = () => {
    if (window.AOS) {
        AOS.init({ duration: 800, once: false, mirror: true, offset: 80, easing: 'ease-out-cubic' });
    }
};

window.refreshAos = () => window.AOS && AOS.refreshHard();

// Highlights the nav link whose section is currently in view. Returns a disposer
// so the Blazor component can tear the observer down on dispose.
window.nav = {
    spy: (dotNetRef) => {
        const sections = Array.from(document.querySelectorAll('section[id]'));
        if (!sections.length) return;

        let current = '';
        const notify = (id) => {
            if (id && id !== current) {
                current = id;
                dotNetRef.invokeMethodAsync('OnSectionChanged', id);
            }
        };

        const observer = new IntersectionObserver((entries) => {
            const visible = entries
                .filter(e => e.isIntersecting)
                .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
            if (visible) notify(visible.target.id);
        }, { rootMargin: '-45% 0px -45% 0px', threshold: [0, 0.25, 0.5, 1] });

        sections.forEach(s => observer.observe(s));
        window.__navObserver = observer;

        const navEl = document.querySelector('.nav');
        const onScroll = () => {
            if (navEl) navEl.classList.toggle('is-scrolled', window.scrollY > 24);
        };
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.__navScroll = onScroll;
    },
    dispose: () => {
        if (window.__navObserver) {
            window.__navObserver.disconnect();
            window.__navObserver = null;
        }
        if (window.__navScroll) {
            window.removeEventListener('scroll', window.__navScroll);
            window.__navScroll = null;
        }
    },
    scrollTo: (id) => {
        const el = document.getElementById(id);
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
};

window.localization = {
    get: () => localStorage.getItem('portfolio-lang'),
    set: lang => localStorage.setItem('portfolio-lang', lang),
    browser: () => navigator.language || 'en',
};

window.theme = {
    apply: mode => {
        document.documentElement.setAttribute('data-theme', mode);
        document.documentElement.style.backgroundColor = mode === 'light' ? '#f6f6fb' : '#0b0b12';
    },
    get: () => localStorage.getItem('portfolio-theme'),
    set: mode => {
        localStorage.setItem('portfolio-theme', mode);
        window.theme.apply(mode);
    },
    sync: mode => window.theme.apply(mode),
    prefersDark: () => !!(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches),
};
