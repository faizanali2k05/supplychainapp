// supabase.js - initialize client
const SUPABASE_URL = 'https://nnldteqvpalicpshvggi.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5ubGR0ZXF2cGFsaWNwc2h2Z2dpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIyNjI0ODQsImV4cCI6MjA4NzgzODQ4NH0.4fEbXBX5oMU2_3tNWV7voB8a5VJOWt9zspikDpTWDvk';

// wait for supabase library to load
let supabaseClient = null;

function initSupabase() {
    if (!window.supabase) {
        console.error('Supabase library not loaded');
        setTimeout(initSupabase, 100);
        return;
    }
    supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    window.supabaseClient = supabaseClient;
}

// initialize on page load
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSupabase);
} else {
    initSupabase();
}

// helper to get current session
async function getSession() {
    if (!supabaseClient) {
        await new Promise(resolve => {
            const check = setInterval(() => {
                if (supabaseClient) {
                    clearInterval(check);
                    resolve();
                }
            }, 100);
        });
    }
    const { data } = await supabaseClient.auth.getSession();
    return data.session;
}

// redirect if not logged in
async function requireAuth() {
    const session = await getSession();
    if (!session) {
        location.href = 'login.html';
    }
    return session;
}

// seed demo products/events if none exist
async function seedDemoData() {
    try {
        await ensureSupabaseReady();
        const { count } = await supabaseClient.from('products').select('*', { count: 'exact' });
        if (count === 0) {
            const samples = [
                { id: '11111111-1111-4111-8111-111111111111', name: 'Widget A', batch_number: 'B1001', description: 'Standard widget', manufacturing_date: '2025-10-01', image_url: 'https://via.placeholder.com/80?text=Widget+A' },
                { id: '22222222-2222-4222-8222-222222222222', name: 'Gadget B', batch_number: 'B2002', description: 'Advanced gadget', manufacturing_date: '2025-11-15', image_url: 'https://via.placeholder.com/80?text=Gadget+B' },
                { id: '33333333-3333-4333-8333-333333333333', name: 'Device C', batch_number: 'B3003', description: 'Prototype device', manufacturing_date: '2025-12-05', image_url: 'https://via.placeholder.com/80?text=Device+C' }
            ];
            for (const p of samples) {
                await supabaseClient.from('products').insert([p]);
            }
        }
    } catch (e) {
        console.error('Demo seed failed', e);
    }
}

window.seedDemoData = seedDemoData;
