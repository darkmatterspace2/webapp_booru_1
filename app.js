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

async function fetchTags(limit = 30, ratings = ['safe']) {
    if (!sbClient) return { error: { message: "Supabase not configured" } };

    // Fetch tags that appear in posts with allowed ratings
    // This uses a subquery to filter tags based on associated post ratings
    const { data: posts, error: postsError } = await sbClient
        .from('webapp_booru_1_posts')
        .select('tags:webapp_booru_1_tags(id, name, type)')
        .in('rating', ratings);

    if (postsError) return { data: null, error: postsError };

    // Extract unique tags from posts
    const tagMap = new Map();
    posts.forEach(post => {
        if (post.tags) {
            post.tags.forEach(tag => {
                if (!tagMap.has(tag.id)) {
                    tagMap.set(tag.id, tag);
                }
            });
        }
    });

    // Convert to array and limit
    const uniqueTags = Array.from(tagMap.values()).slice(0, limit);

    return { data: uniqueTags, error: null };
}

// Search tags for autocomplete
async function searchTags(query, limit = 10) {
    if (!sbClient || !query || query.length < 2) return { data: [], error: null };

    const { data, error } = await sbClient
        .from('webapp_booru_1_tags')
        .select('id, name, type')
        .ilike('name', `${query}%`)
        .limit(limit);

    return { data: data || [], error };
}

// --- Advanced Search Query Parser ---

/**
 * Parse advanced search query into components
 * Syntax:
 *   word        - Match title or tags
 *   tag1 tag2   - Must have BOTH (AND)
 *   -tag        - Exclude this tag (NOT)
 *   ~tag1 ~tag2 - Either tag (OR)
 *   tag*        - Wildcard (starts with)
 */
function parseSearchQuery(query) {
    if (!query || !query.trim()) return null;

    const terms = query.trim().toLowerCase().split(/\s+/).filter(t => t);

    return {
        // Normal terms (AND logic) - no prefix
        andTerms: terms.filter(t => !t.startsWith('-') && !t.startsWith('~')),
        // Excluded terms (NOT logic) - starts with -
        notTerms: terms.filter(t => t.startsWith('-')).map(t => t.slice(1)).filter(t => t),
        // Optional terms (OR logic) - starts with ~  
        orTerms: terms.filter(t => t.startsWith('~')).map(t => t.slice(1)).filter(t => t)
    };
}

/**
 * Check if a term matches a value (supports wildcards)
 */
function termMatches(term, value) {
    const isWildcard = term.endsWith('*');
    if (isWildcard) {
        const prefix = term.slice(0, -1);
        return value.startsWith(prefix);
    }
    return value === term;
}

/**
 * Filter posts based on parsed query
 */
function filterPosts(posts, parsedQuery) {
    if (!parsedQuery) return posts;

    return posts.filter(post => {
        const tagNames = (post.tags || []).map(t => t.name.toLowerCase());
        const sourceUrl = (post.source_url || '').toLowerCase();

        // Check AND terms (all must match tag or title/source_url)
        for (const term of parsedQuery.andTerms) {
            const matchesTag = tagNames.some(tagName => termMatches(term, tagName));
            const matchesSource = sourceUrl.includes(term.replace('*', ''));

            if (!matchesTag && !matchesSource) return false;
        }

        // Check NOT terms (none should match tags)
        for (const term of parsedQuery.notTerms) {
            if (tagNames.some(tagName => termMatches(term, tagName))) return false;
        }

        // Check OR terms (at least one must match, if any OR terms exist)
        if (parsedQuery.orTerms.length > 0) {
            const hasMatch = parsedQuery.orTerms.some(term =>
                tagNames.some(tagName => termMatches(term, tagName))
            );
            if (!hasMatch) return false;
        }

        return true;
    });
}

// --- API Functions ---

const POSTS_PER_PAGE = 50;

async function fetchPosts(limit = POSTS_PER_PAGE, offset = 0, searchQuery = null, ratings = ['safe']) {
    if (!sbClient) return { error: { message: "Supabase not configured" }, data: null, total: 0 };

    // Parse the search query
    const parsedQuery = parseSearchQuery(searchQuery);

    // Build query
    let query = sbClient
        .from('webapp_booru_1_posts')
        .select(`
            *,
            tags:webapp_booru_1_tags (name, type)
        `, { count: 'exact' })
        .in('rating', ratings)
        .order('created_at', { ascending: false });

    // If no search query, use server-side pagination
    if (!parsedQuery) {
        query = query.range(offset, offset + limit - 1);
    }

    const { data, error, count } = await query;

    if (error) return { data: null, error, total: 0 };

    // Apply client-side filtering for advanced queries
    let filteredData = filterPosts(data, parsedQuery);
    let total = count || filteredData.length;

    // Client-side pagination for filtered results
    if (parsedQuery) {
        total = filteredData.length;
        filteredData = filteredData.slice(offset, offset + limit);
    }

    return { data: filteredData, error: null, total };
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

    // Store posts for lightbox navigation
    const mediaList = posts.map(p => ({ url: p.media_url, id: p.id }));

    posts.forEach((post, index) => {
        const span = document.createElement('span');
        span.className = 'post-thumb';

        const hasPreview = post.preview_url && post.preview_url !== post.media_url;
        const isVideo = isVideoUrl(post.media_url);
        const tagTitle = post.tags ? post.tags.map(t => t.name).join(' ') : '';

        let mediaHtml;

        if (hasPreview) {
            mediaHtml = `<img src="${post.preview_url}" alt="${post.id}">`;
        } else if (isVideo) {
            mediaHtml = `
                <video muted preload="none" style="pointer-events:none;">
                    <source src="${post.media_url}">
                </video>
                <span class="video-badge">▶</span>
            `;
        } else {
            mediaHtml = `<img src="${post.media_url}" alt="${post.id}">`;
        }

        // Add caption overlay
        const caption = tagTitle || `Post #${post.id}`;
        span.innerHTML = `${mediaHtml}<span class="thumb-caption">${caption}</span>`;

        // Open lightbox on click
        span.addEventListener('click', () => {
            if (typeof Lightbox !== 'undefined') {
                Lightbox.open(post.media_url, post.id, mediaList, index);
            }
        });

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

        // Load tags for sidebar - tags use click handlers to capture current rating state
        async function loadTags() {
            if (!tagSidebar) return;
            // Only show tags from safe-rated posts for non-admin users
            const ratings = getSelectedRatings();
            const { data: tags, error } = await fetchTags(30, ratings);
            if (error || !tags || tags.length === 0) {
                tagSidebar.innerHTML = '<li>No tags yet</li>';
                return;
            }

            tagSidebar.innerHTML = '';
            tags.forEach(t => {
                const li = document.createElement('li');
                const a = document.createElement('a');
                a.href = '#';
                a.className = `tag-type-${t.type || 'general'}`;
                a.textContent = t.name;

                // Use click handler to capture current rating state at click time
                a.addEventListener('click', (e) => {
                    e.preventDefault();
                    const ratings = getSelectedRatings();
                    const params = new URLSearchParams();
                    params.set('tag', t.name);
                    // Include rating param if not just 'safe'
                    if (ratings.length > 0 && (!ratings.includes('safe') || ratings.length > 1)) {
                        params.set('rating', ratings.join(','));
                    }
                    window.location.href = `?${params.toString()}`;
                });

                li.appendChild(a);
                tagSidebar.appendChild(li);
            });
        }

        // Rating filter change handlers - update URL when changed
        function updateUrl() {
            const tag = searchInput ? searchInput.value.trim() : null;
            const ratings = getSelectedRatings();

            const params = new URLSearchParams();
            if (tag) params.set('tag', tag);
            if (ratings.length > 0 && !ratings.includes('safe') || ratings.length > 1) {
                params.set('rating', ratings.join(','));
            }

            const newUrl = params.toString() ? `?${params.toString()}` : 'index.html';
            window.history.replaceState({ path: newUrl }, '', newUrl);
            currentPage = 1; // Reset to page 1 on filter change
            loadPosts(tag || null);
        }

        [filterSafe, filterQuestionable, filterExplicit].forEach(el => {
            if (el) {
                el.addEventListener('change', updateUrl);
            }
        });

        // Pagination state (moved outside searchInput block for scope access)
        let currentPage = 1;
        let totalPages = 1;
        const prevBtn = document.getElementById('prev-page');
        const nextBtn = document.getElementById('next-page');
        const pageInfo = document.getElementById('page-info');

        function updatePaginationUI() {
            if (pageInfo) {
                pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
            }
            if (prevBtn) {
                prevBtn.disabled = currentPage <= 1;
                prevBtn.style.opacity = currentPage <= 1 ? '0.5' : '1';
            }
            if (nextBtn) {
                nextBtn.disabled = currentPage >= totalPages;
                nextBtn.style.opacity = currentPage >= totalPages ? '0.5' : '1';
            }
        }

        function updateUrlWithPage() {
            const tag = searchInput ? searchInput.value.trim() : null;
            const ratings = getSelectedRatings();

            const params = new URLSearchParams();
            if (tag) params.set('tag', tag);
            if (ratings.length > 0 && (!ratings.includes('safe') || ratings.length > 1)) {
                params.set('rating', ratings.join(','));
            }
            if (currentPage > 1) params.set('page', currentPage);

            const newUrl = params.toString() ? `?${params.toString()}` : 'index.html';
            window.history.replaceState({ path: newUrl }, '', newUrl);
        }

        // Pagination button handlers
        if (prevBtn) {
            prevBtn.addEventListener('click', () => {
                if (currentPage > 1) {
                    currentPage--;
                    updateUrlWithPage();
                    loadPosts(searchInput ? searchInput.value : null);
                }
            });
        }

        if (nextBtn) {
            nextBtn.addEventListener('click', () => {
                if (currentPage < totalPages) {
                    currentPage++;
                    updateUrlWithPage();
                    loadPosts(searchInput ? searchInput.value : null);
                }
            });
        }

        async function loadPosts(tag = null) {
            if (!grid) return;
            grid.innerHTML = '<p style="text-align: center; width: 100%;">Loading...</p>';

            const ratings = getSelectedRatings();
            const offset = (currentPage - 1) * POSTS_PER_PAGE;
            const { data, error, total } = await fetchPosts(POSTS_PER_PAGE, offset, tag, ratings);

            if (error) {
                console.error('Error fetching posts:', error);
                grid.innerHTML = `<p class="error-message">Error loading posts: ${error.message}</p>`;
            } else {
                totalPages = Math.max(1, Math.ceil(total / POSTS_PER_PAGE));
                updatePaginationUI();
                renderPostGrid(data, grid);
                // Scroll to top on page change
                window.scrollTo({ top: 0, behavior: 'smooth' });
            }
        }

        // Search Handler
        if (searchInput) {
            searchInput.disabled = false;

            // Wait for auth to complete before processing rating params
            await checkAuthStatus();

            // Read URL params
            const params = getUrlParams();
            const tagParam = params.get('tag');
            const ratingParam = params.get('rating');
            const pageParam = parseInt(params.get('page')) || 1;
            currentPage = pageParam;

            // Apply rating filters from URL (only for admins)
            if (ratingParam && isAdmin()) {
                const ratings = ratingParam.split(',');
                if (filterSafe) filterSafe.checked = ratings.includes('safe');
                if (filterQuestionable) filterQuestionable.checked = ratings.includes('questionable');
                if (filterExplicit) filterExplicit.checked = ratings.includes('explicit');
            }

            if (tagParam) {
                searchInput.value = tagParam;
            }

            // Load tags after auth check (so getSelectedRatings works correctly)
            loadTags();

            // Initial load (now with correct rating state)
            loadPosts(tagParam || null);

            // Autocomplete setup
            const suggestionsEl = document.getElementById('search-suggestions');
            let selectedIndex = -1;
            let debounceTimer = null;

            // Helper to get the last word being typed (for multi-tag support)
            function getLastWord(text) {
                const words = text.split(/\s+/);
                return words[words.length - 1] || '';
            }

            // Helper to replace only the last word with selected tag
            function replaceLastWord(text, newWord) {
                const words = text.split(/\s+/);
                words[words.length - 1] = newWord;
                return words.join(' ');
            }

            async function showSuggestions(fullQuery) {
                if (!suggestionsEl) return;

                const lastWord = getLastWord(fullQuery);
                if (!lastWord || lastWord.length < 2) {
                    suggestionsEl.classList.remove('active');
                    return;
                }

                const { data: tags } = await searchTags(lastWord, 10);
                if (!tags || tags.length === 0) {
                    suggestionsEl.classList.remove('active');
                    return;
                }

                suggestionsEl.innerHTML = tags.map((tag, i) =>
                    `<li data-tag="${tag.name}" class="${i === selectedIndex ? 'selected' : ''}">${tag.name}</li>`
                ).join('');
                suggestionsEl.classList.add('active');
                selectedIndex = -1;
            }

            function selectSuggestion(tagName) {
                // Replace only the last word with selected tag, keep previous tags
                const currentValue = searchInput.value;
                searchInput.value = replaceLastWord(currentValue, tagName) + ' ';
                suggestionsEl.classList.remove('active');
                searchInput.focus();
            }

            // Input event for autocomplete with debounce
            searchInput.addEventListener('input', (e) => {
                clearTimeout(debounceTimer);
                debounceTimer = setTimeout(() => {
                    showSuggestions(e.target.value.trim());
                }, 200);
            });

            // Click on suggestion
            if (suggestionsEl) {
                suggestionsEl.addEventListener('click', (e) => {
                    if (e.target.tagName === 'LI') {
                        selectSuggestion(e.target.dataset.tag);
                    }
                });
            }

            // Keyboard navigation
            searchInput.addEventListener('keydown', (e) => {
                if (!suggestionsEl || !suggestionsEl.classList.contains('active')) return;

                const items = suggestionsEl.querySelectorAll('li');
                if (items.length === 0) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    selectedIndex = Math.min(selectedIndex + 1, items.length - 1);
                    items.forEach((li, i) => li.classList.toggle('selected', i === selectedIndex));
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    selectedIndex = Math.max(selectedIndex - 1, 0);
                    items.forEach((li, i) => li.classList.toggle('selected', i === selectedIndex));
                } else if (e.key === 'Enter' && selectedIndex >= 0) {
                    e.preventDefault();
                    selectSuggestion(items[selectedIndex].dataset.tag);
                    return;
                } else if (e.key === 'Escape') {
                    suggestionsEl.classList.remove('active');
                    selectedIndex = -1;
                }
            });

            // Hide suggestions on blur (with delay for click)
            searchInput.addEventListener('blur', () => {
                setTimeout(() => {
                    if (suggestionsEl) suggestionsEl.classList.remove('active');
                }, 150);
            });

            searchInput.addEventListener('keypress', async (e) => {
                if (e.key === 'Enter') {
                    if (suggestionsEl) suggestionsEl.classList.remove('active');
                    currentPage = 1; // Reset to page 1 on new search
                    updateUrl();
                }
            });
        }
    }
});
