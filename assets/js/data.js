// data.js - Production data management with real-time syncing
window.demoData = {
    users: [],
    products: [],
    events: []
};

// Real-time data caching for instant UI updates
const DataCache = {
    users: [],
    products: [],
    blockchain_blocks: [],
    supply_chain_events: [],
    
    // Update cache when data changes
    update(table, data) {
        if (this[table]) {
            this[table] = data;
            console.log(`[DataCache] Updated ${table}:`, data.length, 'records');
        }
    },
    
    // Get cached data
    get(table) {
        return this[table] || [];
    },
    
    // Find record by ID
    findById(table, id) {
        return this[table]?.find(item => item.id === id);
    },
    
    // Add record to cache
    add(table, record) {
        if (this[table] && !this[table].find(r => r.id === record.id)) {
            this[table].push(record);
            console.log(`[DataCache] Added to ${table}:`, record);
        }
    },
    
    // Remove record from cache
    remove(table, id) {
        if (this[table]) {
            this[table] = this[table].filter(r => r.id !== id);
            console.log(`[DataCache] Removed from ${table}:`, id);
        }
    }
};
