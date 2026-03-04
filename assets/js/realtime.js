// realtime.js - Real-time database syncing using Supabase Realtime
const Realtime = (() => {
    const subscriptions = [];
    const callbacks = {
        users: [],
        products: [],
        blockchain_blocks: [],
        supply_chain_events: []
    };

    // Subscribe to table changes
    function subscribe(table, callback) {
        if (!callbacks[table]) callbacks[table] = [];
        callbacks[table].push(callback);
        
        return subscribeToTable(table);
    }

    // Internal function to set up Realtime subscription
    function subscribeToTable(table) {
        if (!supabaseClient) {
            console.error('Supabase client not initialized');
            return null;
        }

        try {
            const subscription = supabaseClient
                .channel(`public:${table}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: table
                    },
                    (payload) => {
                        console.log(`[Realtime] ${table} change:`, payload);
                        
                        if (callbacks[table] && callbacks[table].length > 0) {
                            callbacks[table].forEach(cb => {
                                try {
                                    cb(payload);
                                } catch (err) {
                                    console.error(`Error in callback for ${table}:`, err);
                                }
                            });
                        }
                    }
                )
                .subscribe((status, err) => {
                    if (err) {
                        console.error(`[Realtime] Subscription error for ${table}:`, err);
                    } else {
                        console.log(`[Realtime] ${table} subscription status:`, status);
                    }
                });

            subscriptions.push(subscription);
            return subscription;
        } catch (err) {
            console.error(`Failed to subscribe to ${table}:`, err);
            return null;
        }
    }

    // Initialize all real-time listeners
    function initializeAll() {
        console.log('[Realtime] Initializing all real-time subscriptions...');
        
        // Subscribe to users (for user list updates)
        subscribe('users', (payload) => {
            console.log('[Realtime] Users table update:', payload.new || payload.old);
            refreshUserList();
        });

        // Subscribe to products (for product list updates)
        subscribe('products', (payload) => {
            console.log('[Realtime] Products table update:', payload.new || payload.old);
            refreshProductList();
        });

        // Subscribe to blockchain_blocks (for verification status updates)
        subscribe('blockchain_blocks', (payload) => {
            console.log('[Realtime] Blockchain blocks update:', payload.new || payload.old);
            refreshBlockchainData();
        });

        // Subscribe to supply_chain_events (for event tracking updates)
        subscribe('supply_chain_events', (payload) => {
            console.log('[Realtime] Supply chain events update:', payload.new || payload.old);
            refreshEventData();
        });
    }

    // Refresh user list in UI
    function refreshUserList() {
        const userTableDiv = document.getElementById('users-table');
        if (userTableDiv && typeof window.loadUsers === 'function') {
            window.loadUsers();
        }
    }

    // Refresh product list in UI
    function refreshProductList() {
        const productDiv = document.getElementById('products-table');
        const productList = document.getElementById('product-list');
        
        if (productDiv && typeof window.loadProducts === 'function') {
            window.loadProducts();
        }
        
        if (productList && typeof window.loadProductList === 'function') {
            window.loadProductList();
        }
    }

    // Refresh blockchain data in UI
    function refreshBlockchainData() {
        const dashboardDiv = document.getElementById('dashboard-stats');
        if (dashboardDiv && typeof window.loadDashboardStats === 'function') {
            window.loadDashboardStats();
        }

        const eventList = document.getElementById('event-timeline');
        if (eventList && typeof window.loadEvents === 'function') {
            window.loadEvents();
        }

        const trackingDiv = document.getElementById('tracking-result');
        if (trackingDiv && typeof window.refreshTracking === 'function') {
            window.refreshTracking();
        }
    }

    // Refresh event data in UI
    function refreshEventData() {
        const eventTimeline = document.getElementById('event-timeline');
        if (eventTimeline && typeof window.loadEvents === 'function') {
            window.loadEvents();
        }

        const eventsList = document.getElementById('events-list');
        if (eventsList && typeof window.loadRecentEvents === 'function') {
            window.loadRecentEvents();
        }
    }

    // Unsubscribe from all
    function unsubscribeAll() {
        subscriptions.forEach(sub => {
            if (sub) {
                supabaseClient.removeChannel(sub);
            }
        });
        subscriptions.length = 0;
        console.log('[Realtime] All subscriptions removed');
    }

    // Listen for specific product changes
    function subscribeToProduct(productId, callback) {
        if (!supabaseClient) return null;

        try {
            const subscription = supabaseClient
                .channel(`product:${productId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'blockchain_blocks',
                        filter: `product_id=eq.${productId}`
                    },
                    (payload) => {
                        console.log(`[Realtime] Product ${productId} update:`, payload);
                        if (callback) callback(payload);
                    }
                )
                .subscribe();

            return subscription;
        } catch (err) {
            console.error(`Failed to subscribe to product ${productId}:`, err);
            return null;
        }
    }

    // Listen for supply chain events for a product
    function subscribeToProductEvents(productId, callback) {
        if (!supabaseClient) return null;

        try {
            const subscription = supabaseClient
                .channel(`events:${productId}`)
                .on(
                    'postgres_changes',
                    {
                        event: '*',
                        schema: 'public',
                        table: 'supply_chain_events',
                        filter: `product_id=eq.${productId}`
                    },
                    (payload) => {
                        console.log(`[Realtime] Events for product ${productId}:`, payload);
                        if (callback) callback(payload);
                    }
                )
                .subscribe();

            return subscription;
        } catch (err) {
            console.error(`Failed to subscribe to events for product ${productId}:`, err);
            return null;
        }
    }

    // Emulate real-time for demo (fallback if Realtime not available)
    function enablePolling(interval = 5000) {
        console.log(`[Realtime] Enabling polling fallback with ${interval}ms interval`);
        
        setInterval(() => {
            if (typeof window.loadUsers === 'function' && document.getElementById('users-table')) {
                window.loadUsers();
            }
            if (typeof window.loadProducts === 'function' && document.getElementById('products-table')) {
                window.loadProducts();
            }
            if (typeof window.loadEvents === 'function' && document.getElementById('event-timeline')) {
                window.loadEvents();
            }
        }, interval);
    }

    // Public API
    return {
        subscribe,
        subscribeToProduct,
        subscribeToProductEvents,
        initializeAll,
        unsubscribeAll,
        enablePolling,
        refreshUserList,
        refreshProductList,
        refreshBlockchainData,
        refreshEventData
    };
})();

// Auto-initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        console.log('[Realtime] Initializing after DOM ready');
        if (typeof Realtime !== 'undefined' && typeof Realtime.initializeAll === 'function') {
            Realtime.initializeAll();
        }
    });
} else {
    console.log('[Realtime] DOM already ready, initializing immediately');
    if (typeof Realtime !== 'undefined' && typeof Realtime.initializeAll === 'function') {
        Realtime.initializeAll();
    }
}
