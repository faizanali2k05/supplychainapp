// auth.js - handles signup, login, logout, session, role redirect

// ensure supabase client is ready before proceeding
async function ensureSupabaseReady() {
    let attempts = 0;
    while (!supabaseClient && attempts < 50) {
        await new Promise(resolve => setTimeout(resolve, 100));
        attempts++;
    }
    if (!supabaseClient) {
        throw new Error('Supabase client failed to initialize');
    }
}

async function handleSignup(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const name = document.getElementById('name').value.trim();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const role = document.getElementById('role').value;
    const errorEl = document.getElementById('error-msg');
    errorEl.textContent = '';

    if (!name || !email || !password || !role) {
        errorEl.textContent = 'All fields are required.';
        return;
    }

    try {
        if (UIUtils) UIUtils.setButtonLoading(submitBtn, true);
        await ensureSupabaseReady();
        const { data, error } = await supabaseClient.auth.signUp({
            email,
            password,
            options: {
                data: { name, role }
            }
        });
        if (error) throw error;
        // store additional user info in users table
        const { error: insertErr } = await supabaseClient.from('users').insert([
            { id: data.user.id, name, email, role }
        ]);
        if (insertErr) {
            console.error('Failed to insert profile row:', insertErr);
            errorEl.textContent = 'Registration succeeded but profile save failed, redirecting to login...';
        } else {
            errorEl.textContent = 'Registration successful! Redirecting...';
        }
        setTimeout(() => {
            location.href = 'login.html';
        }, 1500);
    } catch (err) {
        console.error('Signup error:', err);
        errorEl.textContent = err.message || 'Signup failed';
        if (UIUtils) UIUtils.setButtonLoading(submitBtn, false);
    }
}

async function handleLogin(event) {
    event.preventDefault();
    const form = event.target;
    const submitBtn = form.querySelector('button[type="submit"]');
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const errorEl = document.getElementById('error-msg');
    errorEl.textContent = '';
    try {
        if (UIUtils) UIUtils.setButtonLoading(submitBtn, true);
        await ensureSupabaseReady();
        const { data, error } = await supabaseClient.auth.signInWithPassword({ email, password });
        if (error) throw error;
        sessionRedirect();
    } catch (err) {
        console.error('Login error:', err);
        errorEl.textContent = err.message || 'Login failed';
        if (UIUtils) UIUtils.setButtonLoading(submitBtn, false);
    }
}

async function sessionRedirect() {
    const session = await getSession();
    if (!session) return;
    const user = session.user;
    // attempt to fetch role from profile table; if missing, create using metadata
    let { data, error } = await supabaseClient.from('users').select('role').eq('id', user.id).maybeSingle();
    if (error) {
        console.error('Error fetching profile row:', error);
        // proceed without redirect or show error
        return;
    }
    if (!data) {
        // no profile yet, try to insert from metadata
        const name = user.user_metadata?.name || '';
        const role = user.user_metadata?.role || 'customer';
        const email = user.email;
        const { error: insErr } = await supabaseClient.from('users').insert([
            { id: user.id, name, email, role }
        ]);
        if (insErr) {
            console.error('Failed to create missing profile row:', insErr);
        }
        data = { role };
    }
    const role = data.role;
    const safeRole = (role || 'customer').toString().toLowerCase();
    location.href = `dashboard-${safeRole}.html`;
}

async function logout() {
    await ensureSupabaseReady();
    await supabaseClient.auth.signOut();
    location.href = 'login.html';
}

// attach logout event listener (form listeners are attached in HTML files for better webview compatibility)
if (document.getElementById('logout-btn')) {
    document.getElementById('logout-btn').addEventListener('click', logout);
}

// redirect authenticated user away from auth pages
if (window.location.pathname.endsWith('login.html') || window.location.pathname.endsWith('signup.html')) {
    (async () => {
        try {
            const session = await getSession();
            if (session) {
                // fetch role and redirect to role-specific dashboard (create profile if missing)
                await ensureSupabaseReady();
                let { data, error } = await supabaseClient.from('users').select('role').eq('id', session.user.id).maybeSingle();
                if (error) {
                    console.error('Error checking profile:', error);
                }
                if (!data) {
                    const user = session.user;
                    const name = user.user_metadata?.name || '';
                    const role = user.user_metadata?.role || 'customer';
                    const email = user.email;
                    const { error: insErr } = await supabaseClient.from('users').insert([
                        { id: user.id, name, email, role }
                    ]);
                    if (insErr) console.error('Failed to create profile on auth check:', insErr);
                    data = { role };
                }
                const role = (data && data.role) ? data.role.toLowerCase() : 'customer';
                location.href = `dashboard-${role}.html`;
            }
        } catch (err) {
            console.error('Auth check failed:', err);
        }
    })();
}

// on any dashboard-* page load, populate UI and enforce auth
if (window.location.pathname.includes('dashboard-')) {
    document.addEventListener('DOMContentLoaded', async () => {
        try {
            await ensureSupabaseReady();
            const session = await requireAuth();
            const { data, error } = await supabaseClient.from('users').select('role,name').eq('id', session.user.id).single();
            if (error) {
                console.error('Failed to load user profile:', error);
                return;
            }
            const role = data.role;
            const userRoleElement = document.getElementById('user-role');
            if (userRoleElement) {
                userRoleElement.textContent = data.name + ' (' + role + ')';
            }
            // seed demo data if helper available (useful during development)
            if (window.seedDemoData) {
                window.seedDemoData().catch(err => console.warn('Seeding skipped or failed', err));
            }
        } catch (err) {
            console.error('Dashboard initialization error:', err);
        }
    });
}
