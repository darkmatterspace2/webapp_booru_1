// Config - Replace with your actual project details
// NOTE: These are exposed to the client, so only use the ANON key.

const CONFIG = {
    SUPABASE_URL: 'https://whhtqqrwrflbzeqprobe.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndoaHRxcXJ3cmZsYnplcXByb2JlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NzcyMzUsImV4cCI6MjA3OTU1MzIzNX0.OQ-KHMWZf1wByrKkaos_Yxz2bwRmFi35Aa2rxlVnMFM',
    // Admin password for edit/delete (client-side only, NOT secure for production)
    ADMIN_PASSWORD: 'admin123'
};

// Check if configured
if (CONFIG.SUPABASE_URL === 'YOUR_SUPABASE_URL_HERE') {
    console.warn('⚠️ Supabase not configured. Please edit config.js');
}
