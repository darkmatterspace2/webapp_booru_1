// App Logic using Vanilla JS and Supabase

// Initialize client if available
// Using sbClient to avoid conflict with CDN's window.supabase
let sbClient = null;

if (typeof CONFIG !== 'undefined' && CONFIG.SUPABASE_URL && CONFIG.SUPABASE_URL !== 'YOUR_SUPABASE_URL_HERE') {
    // CDN exposes supabase under window.supabase
    if (window.supabase && window.supabase.createClient) {
        sbClient = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);
    } else {
        console.error('Supabase JS library not found. Make sure to include the CDN link.');
    }
}

// Utils
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

// Navigation State
const getUrlParams = () => new URLSearchParams(window.location.search);

// --- Theme Logic ---
function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

function toggleTheme() {
    document.body.classList.toggle('light-mode');
    const isLight = document.body.classList.contains('light-mode');
    localStorage.setItem('theme', isLight ? 'light' : 'dark');
}

// Apply theme immediately
initTheme();

// --- Supabase Auth ---
let currentUser = null;

async function checkAuthStatus() {
    if (!sbClient) return null;
    const { data: { session } } = await sbClient.auth.getSession();
    currentUser = session?.user || null;
    return currentUser;
}

function isAdmin() {
    return currentUser !== null;
}

async function adminLogin(email, password) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    const { data, error } = await sbClient.auth.signInWithPassword({
        email,
        password
    });

    if (!error && data.user) {
        currentUser = data.user;
    }
    return { data, error };
}

async function adminLogout() {
    if (!sbClient) return;
    await sbClient.auth.signOut();
    currentUser = null;
}

// Initialize auth status on load
checkAuthStatus();


// --- API Functions ---

async function fetchTags(limit = 30) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    const { data, error } = await sbClient
        .from('webapp_booru_1_tags')
        .select('id, name, type')
        .limit(limit);

    return { data, error };
}

async function fetchPosts(limit = 20, tagSearch = null, ratings = ['safe']) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    let query;

    if (tagSearch) {
        query = sbClient
            .from('webapp_booru_1_posts')
            .select(`
                *,
                tags:webapp_booru_1_tags!inner (name, type)
            `)
            .eq('webapp_booru_1_tags.name', tagSearch.toLowerCase())
            .in('rating', ratings)
            .order('created_at', { ascending: false })
            .limit(limit);
    } else {
        query = sbClient
            .from('webapp_booru_1_posts')
            .select(`
                *,
                tags:webapp_booru_1_tags (name, type)
            `)
            .in('rating', ratings)
            .order('created_at', { ascending: false })
            .limit(limit);
    }

    const { data, error } = await query;
    return { data, error };
}

async function fetchPostById(id) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    const { data, error } = await sbClient
        .from('webapp_booru_1_posts')
        .select(`
            *,
            tags:webapp_booru_1_tags (name, type)
        `)
        .eq('id', id)
        .single();

    return { data, error };
}

async function deletePost(id) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    const { error } = await sbClient
        .from('webapp_booru_1_posts')
        .delete()
        .eq('id', id);

    return { error };
}

async function updatePost(id, updates) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    const { data, error } = await sbClient
        .from('webapp_booru_1_posts')
        .update(updates)
        .eq('id', id)
        .select();

    // Return first row if exists
    if (error) return { error };
    if (!data || data.length === 0) {
        return { error: { message: "No rows updated. Check RLS policies." } };
    }
    return { data: data[0], error: null };
}

// --- Rendering ---

// Helper to detect if a URL is a video
function isVideoUrl(url) {
    if (!url) return false;
    return /\.(mp4|webm|mov|avi|mkv)(\?|$)/i.test(url);
}

function renderPostGrid(posts, container) {
    container.innerHTML = '';

    if (!posts || posts.length === 0) {
        container.innerHTML = '<p style="margin:10px;">No posts found.</p>';
        return;
    }

    const fragment = document.createDocumentFragment();

    posts.forEach(post => {
        const span = document.createElement('span');
        span.className = 'post-thumb';

        const hasPreview = post.preview_url && post.preview_url !== post.media_url;
        const isVideo = isVideoUrl(post.media_url);
        const tagTitle = post.tags ? post.tags.map(t => t.name).join(' ') : '';

        let mediaHtml;

        if (hasPreview) {
            // Use provided preview image
            mediaHtml = `<img src="${post.preview_url}" alt="${post.id}" title="${tagTitle}">`;
        } else if (isVideo) {
            // No preview for video - show a small muted video element (browser will show first frame)
            mediaHtml = `
                <video muted preload="metadata" title="${tagTitle}" style="pointer-events:none;">
                    <source src="${post.media_url}">
                </video>
                <span class="video-badge">▶</span>
            `;
        } else {
            // Regular image
            mediaHtml = `<img src="${post.media_url}" alt="${post.id}" title="${tagTitle}">`;
        }

        span.innerHTML = `<a href="post.html?id=${post.id}">${mediaHtml}</a>`;
        fragment.appendChild(span);
    });

    container.appendChild(fragment);
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', async () => {

    // Check Config
    if (!sbClient) {
        const warning = document.createElement('div');
        warning.className = 'error-message';
        warning.innerHTML = `
            <strong>Setup Required</strong><br>
            Supabase is not configured. Please open <code>config.js</code> and add your URL/Key.<br>
            Then run the SQL in <code>schema.sql</code> in your Supabase SQL Editor.
        `;
        document.body.appendChild(warning);
        return;
    }

    // Page Router (Simple)
    const path = window.location.pathname;

    if (path.endsWith('index.html') || path === '/' || path.endsWith('/')) {
        const grid = $('#grid');
        const searchInput = $('#search');
        const tagSidebar = $('#tag-sidebar');

        // Rating filter elements
        const filterSafe = $('#filter-safe');
        const filterQuestionable = $('#filter-questionable');
        const filterExplicit = $('#filter-explicit');

        // Get selected ratings from checkboxes
        function getSelectedRatings() {
            // Non-admin users can only see safe content
            if (!isAdmin()) {
                return ['safe'];
            }

            const ratings = [];
            if (filterSafe && filterSafe.checked) ratings.push('safe');
            if (filterQuestionable && filterQuestionable.checked) ratings.push('questionable');
            if (filterExplicit && filterExplicit.checked) ratings.push('explicit');
            // Default to safe if nothing selected
            return ratings.length > 0 ? ratings : ['safe'];
        }

        // Initial Load
        loadPosts();
        loadTags();

        // Load tags for sidebar
        async function loadTags() {
            if (!tagSidebar) return;
            const { data: tags, error } = await fetchTags();
            if (error || !tags || tags.length === 0) {
                tagSidebar.innerHTML = '<li>No tags yet</li>';
                return;
            }
            tagSidebar.innerHTML = tags.map(t =>
                `<li><a href="?tag=${encodeURIComponent(t.name)}" class="tag-type-${t.type || 'general'}">${t.name}</a></li>`
            ).join('');
        }

        // Rating filter change handlers
        [filterSafe, filterQuestionable, filterExplicit].forEach(el => {
            if (el) {
                el.addEventListener('change', () => {
                    const tag = searchInput ? searchInput.value.trim() : null;
                    loadPosts(tag || null);
                });
            }
        });

        // Search Handler
        if (searchInput) {
            searchInput.disabled = false;

            const params = getUrlParams();
            const tagParam = params.get('tag');
            if (tagParam) {
                searchInput.value = tagParam;
                loadPosts(tagParam);
            }

            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    const tag = searchInput.value.trim();
                    const newUrl = tag ? `?tag=${encodeURIComponent(tag)}` : 'index.html';
                    window.history.pushState({ path: newUrl }, '', newUrl);
                    loadPosts(tag);
                }
            });
        }

        async function loadPosts(tag = null) {
            if (!grid) return;
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Loading...</p>';

            const ratings = getSelectedRatings();
            const { data, error } = await fetchPosts(20, tag, ratings);

            if (error) {
                console.error('Error fetching posts:', error);
                grid.innerHTML = `<p class="error-message">Error loading posts: ${error.message}</p>`;
            } else {
                renderPostGrid(data, grid);
            }
        }
    }
});
