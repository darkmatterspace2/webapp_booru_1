/**
 * Lightbox Module - Self-contained image/video viewer
 * Features: Fit/100%/Crop/Stretch modes, drag-to-pan, keyboard support
 */

const Lightbox = (function () {
    let overlay, mediaContainer, toolbar, currentMedia, currentMode = 'fit';
    let isDragging = false, startX, startY, scrollX, scrollY;
    let allMedia = [];
    let currentIndex = 0;

    // Create UI elements
    function createUI() {
        // Overlay
        overlay = document.createElement('div');
        overlay.id = 'lightbox-overlay';
        overlay.innerHTML = `
            <div class="lightbox-media-container" id="lightbox-media"></div>
            <div class="lightbox-toolbar">
                <button data-mode="fit" class="active" title="Fit to screen">Fit</button>
                <button data-mode="full" title="100% size">100%</button>
                <button data-mode="crop" title="Zoom to fill screen">Zoom</button>
                <button data-mode="stretch" title="Stretch to fill">Stretch</button>
                <span class="lightbox-divider">|</span>
                <button id="lightbox-prev" title="Previous">◀</button>
                <button id="lightbox-next" title="Next">▶</button>
                <span class="lightbox-divider">|</span>
                <button id="lightbox-info" title="View post details">Info</button>
                <button id="lightbox-fullscreen" title="Toggle Fullscreen">⛶</button>
                <button id="lightbox-close" title="Close (Esc)">✕</button>
            </div>
            <div class="lightbox-counter" id="lightbox-counter">1 / 1</div>
        `;
        document.body.appendChild(overlay);

        mediaContainer = document.getElementById('lightbox-media');
        toolbar = overlay.querySelector('.lightbox-toolbar');

        // Click outside image to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay || e.target === mediaContainer) close();
        });

        // Prevent close when clicking on image/video itself
        mediaContainer.addEventListener('click', (e) => {
            if (e.target.classList.contains('lightbox-content')) {
                e.stopPropagation();
            }
        });

        document.getElementById('lightbox-close').addEventListener('click', close);
        document.getElementById('lightbox-prev').addEventListener('click', () => navigate(-1));
        document.getElementById('lightbox-next').addEventListener('click', () => navigate(1));
        document.getElementById('lightbox-info').addEventListener('click', goToPost);
        document.getElementById('lightbox-fullscreen').addEventListener('click', toggleFullscreen);

        // Mode buttons
        toolbar.querySelectorAll('[data-mode]').forEach(btn => {
            btn.addEventListener('click', () => setMode(btn.dataset.mode));
        });

        // Keyboard
        document.addEventListener('keydown', (e) => {
            if (!overlay.classList.contains('active')) return;
            if (e.key === 'Escape') close();
            if (e.key === 'ArrowLeft') navigate(-1);
            if (e.key === 'ArrowRight') navigate(1);
        });

        // Drag to pan - Mouse
        mediaContainer.addEventListener('mousedown', startDrag);
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', endDrag);

        // Drag to pan - Touch
        mediaContainer.addEventListener('touchstart', startDragTouch, { passive: false });
        document.addEventListener('touchmove', dragTouch, { passive: false });
        document.addEventListener('touchend', endDrag);
    }

    function open(mediaUrl, postId, mediaList, index) {
        if (mediaList) {
            allMedia = mediaList;
            currentIndex = index || 0;
        } else {
            allMedia = [{ url: mediaUrl, id: postId }];
            currentIndex = 0;
        }

        showMedia(allMedia[currentIndex]);
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden';
        updateCounter();
    }

    function showMedia(item) {
        currentMedia = item;
        const isVideo = /\.(mp4|webm|mov)(\?|$)/i.test(item.url);

        if (isVideo) {
            mediaContainer.innerHTML = `<video src="${item.url}" controls loop preload="none" class="lightbox-content"></video>`;
        } else {
            mediaContainer.innerHTML = `<img src="${item.url}" class="lightbox-content" draggable="false">`;
        }

        // Reset drag position
        translateX = 0;
        translateY = 0;

        setMode(currentMode);
    }

    function close() {
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        mediaContainer.innerHTML = '';
    }

    function navigate(dir) {
        currentIndex += dir;
        if (currentIndex < 0) currentIndex = allMedia.length - 1;
        if (currentIndex >= allMedia.length) currentIndex = 0;
        showMedia(allMedia[currentIndex]);
        updateCounter();
    }

    function updateCounter() {
        document.getElementById('lightbox-counter').textContent = `${currentIndex + 1} / ${allMedia.length}`;
    }

    function goToPost() {
        if (currentMedia && currentMedia.id) {
            window.location.href = `post.html?id=${currentMedia.id}`;
        }
    }

    function setMode(mode) {
        currentMode = mode;
        const content = mediaContainer.querySelector('.lightbox-content');
        if (!content) return;

        // Reset
        content.className = 'lightbox-content';
        mediaContainer.className = 'lightbox-media-container';

        content.classList.add(`mode-${mode}`);
        if (mode === 'full') {
            mediaContainer.classList.add('scrollable');
        }

        // Update toolbar
        toolbar.querySelectorAll('[data-mode]').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });
    }

    // Drag to pan using CSS transform - works in all modes
    let translateX = 0, translateY = 0;

    function startDrag(e) {
        const content = mediaContainer.querySelector('.lightbox-content');
        if (!content || e.target.tagName === 'VIDEO') return;
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        mediaContainer.style.cursor = 'grabbing';
        e.preventDefault();
    }

    function startDragTouch(e) {
        const content = mediaContainer.querySelector('.lightbox-content');
        if (!content || e.target.tagName === 'VIDEO') return;
        if (e.touches.length === 1) {
            isDragging = true;
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
            e.preventDefault();
        }
    }

    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        const content = mediaContainer.querySelector('.lightbox-content');
        if (!content) return;

        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        startX = e.clientX;
        startY = e.clientY;
        translateX += dx;
        translateY += dy;
        content.style.transform = `translate(${translateX}px, ${translateY}px)`;
    }

    function dragTouch(e) {
        if (!isDragging || e.touches.length !== 1) return;
        e.preventDefault();
        const content = mediaContainer.querySelector('.lightbox-content');
        if (!content) return;

        const dx = e.touches[0].clientX - startX;
        const dy = e.touches[0].clientY - startY;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        translateX += dx;
        translateY += dy;
        content.style.transform = `translate(${translateX}px, ${translateY}px)`;
    }

    function endDrag() {
        isDragging = false;
        mediaContainer.style.cursor = '';
    }

    function resetPosition() {
        translateX = 0;
        translateY = 0;
        const content = mediaContainer.querySelector('.lightbox-content');
        if (content) content.style.transform = '';
    }

    function toggleFullscreen() {
        if (!document.fullscreenElement) {
            document.documentElement.requestFullscreen().catch((e) => {
                console.error(`Error attempting to enable fullscreen mode: ${e.message} (${e.name})`);
            });
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
    }

    // Initialize on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

    return { open, close };
})();

/**
 * Floating Gallery Controls - Volume Rocker Style
 */
const GalleryControls = (function () {
    let controlsEl;
    let currentCols = 4;
    const MIN_COLS = 1;
    const MAX_COLS = 10;
    const STORAGE_KEY = 'gallery_columns';

    function createUI() {
        controlsEl = document.createElement('div');
        controlsEl.id = 'gallery-float-controls';
        controlsEl.innerHTML = `
            <button id="zen-toggle" title="Toggle Zen mode">☯</button>
            <button id="cols-plus" title="More columns">+</button>
            <button id="cols-minus" title="Fewer columns">−</button>
            <button id="go-to-top" title="Go to top">↑</button>
        `;
        document.body.appendChild(controlsEl);

        // Load saved preferences
        currentCols = parseInt(localStorage.getItem(STORAGE_KEY)) || 4;
        setColumns(currentCols);

        // Load zen mode state
        const zenEnabled = localStorage.getItem('zen_mode') === 'true';
        if (zenEnabled) {
            document.body.classList.add('zen-mode');
            document.getElementById('zen-toggle').classList.add('active');
        }

        // Event listeners
        document.getElementById('cols-plus').addEventListener('click', () => {
            if (currentCols < MAX_COLS) {
                currentCols++;
                setColumns(currentCols);
                localStorage.setItem(STORAGE_KEY, currentCols);
            }
        });

        document.getElementById('cols-minus').addEventListener('click', () => {
            if (currentCols > MIN_COLS) {
                currentCols--;
                setColumns(currentCols);
                localStorage.setItem(STORAGE_KEY, currentCols);
            }
        });

        document.getElementById('go-to-top').addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });

        document.getElementById('zen-toggle').addEventListener('click', () => {
            const isZen = document.body.classList.toggle('zen-mode');
            document.getElementById('zen-toggle').classList.toggle('active', isZen);
            localStorage.setItem('zen_mode', isZen);
        });
    }

    function setColumns(cols) {
        const grid = document.getElementById('grid');
        if (!grid) return;
        grid.style.setProperty('--gallery-cols', cols);
    }

    // Initialize
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createUI);
    } else {
        createUI();
    }

    return { setColumns };
})();
