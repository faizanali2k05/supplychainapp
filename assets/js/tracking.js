// tracking.js - status updates and tracking with blockchain verification
const tracking = (() => {
    async function init() {
        const container = document.getElementById('status-form-container');
        container.innerHTML = `
            <form id="status-form">
                <div class="form-group">
                    <label for="product-id">Product ID</label>
                    <input type="text" id="product-id" placeholder="Paste product UUID" required>
                </div>
                <div class="form-group">
                    <label for="location">Current Location</label>
                    <input type="text" id="location" placeholder="e.g., Warehouse, Distribution Center" required>
                </div>
                <div class="form-group">
                    <label for="status">Supply Chain Status</label>
                    <select id="status" required>
                        <option value="">-- Select status --</option>
                        <option value="In Transit"><i class="fas fa-truck"></i> In Transit</option>
                        <option value="At Distributor"><i class="fas fa-box"></i> At Distributor</option>
                        <option value="At Retailer"><i class="fas fa-store"></i> At Retailer</option>
                        <option value="Delivered"><i class="fas fa-check-circle"></i> Delivered</option>
                    </select>
                </div>
                <button type="submit" class="btn">Update Status</button>
                <div id="status-error" class="error-message"></div>
                <div id="status-success" class="success-message"></div>
            </form>
            <div id="status-products" class="card" style="margin-top:2rem;"><h4>Recent Products</h4><div id="product-list" style="font-size:0.9rem;color:var(--text-light);">Loading...</div></div>
        `;
        document.getElementById('status-form').addEventListener('submit', updateStatus);
        loadProductList();
    }

    async function updateStatus(e) {
        e.preventDefault();
        const form = e.target;
        const submitBtn = form.querySelector('button[type="submit"]');
        const product_id = document.getElementById('product-id').value.trim();
        const location = document.getElementById('location').value.trim();
        const status = document.getElementById('status').value.trim();
        const err = document.getElementById('status-error');
        const success = document.getElementById('status-success');
        err.textContent = '';
        success.textContent = '';

        if (!product_id || !location || !status) {
            err.textContent = 'All fields are required.';
            return;
        }

        try {
            if (UIUtils) UIUtils.setButtonLoading(submitBtn, true);
            
            const { data: session } = await supabaseClient.auth.getSession();
            const user = session.session.user;
            const { data: profile } = await supabaseClient.from('users').select('role').eq('id', user.id).single();
            const role = profile.role;
            const timestamp = new Date().toISOString();

            // Get last block
            const { data: lastBlocks } = await supabaseClient
                .from('blockchain_blocks')
                .select('*')
                .eq('product_id', product_id)
                .order('block_index', { ascending: false })
                .limit(1);

            const lastBlock = lastBlocks && lastBlocks.length > 0 ? lastBlocks[0] : null;

            // Create new block using blockchain module
            if (Blockchain) {
                const newBlock = await Blockchain.createBlock(lastBlock, product_id, status, location, role, user.id);
                
                const { error } = await supabaseClient.from('blockchain_blocks').insert([newBlock]);
                if (error) throw error;

                success.textContent = `Status updated to "${status}" at ${location}. Hash: ${newBlock.hash.substring(0, 20)}...`;
                form.reset();
            } else {
                throw new Error('Blockchain module not available');
            }
        } catch (err) {
            console.error('Update error:', err);
            err.textContent = err.message || 'Failed to update status';
        } finally {
            if (UIUtils) UIUtils.setButtonLoading(submitBtn, false);
        }
    }

    async function loadProductList() {
        const listDiv = document.getElementById('product-list');
        listDiv.innerHTML = '<p style="color:var(--text-light);">Loading products...</p>';
        let items = [];
        try {
            if (supabaseClient) {
                const { data } = await supabaseClient.from('products').select('id,name,image_url').order('created_at', { ascending: false }).limit(10);
                if (data && data.length) items = data;
            }
        } catch (err) {
            console.warn('Using demo data for product list', err);
        }
        if (items.length === 0 && window.demoData && window.demoData.products) {
            items = window.demoData.products.map(p => ({id:p.id,name:p.name,image_url:p.image_url}));
        }
        if (items.length === 0) {
            listDiv.textContent = 'No products available';
            return;
        }
        let html = '<ul style="list-style:none;padding:0;margin:0;">';
        items.forEach(p => {
            html += `<li style="padding:0.75rem;margin:0.5rem 0;background:var(--light-bg);border-radius:6px;">
                <strong>${p.name}</strong><br>
                <code style="font-size:0.8rem;color:#666;word-break:break-all;">${p.id.substring(0,16)}...</code>
            </li>`;
        });
        html += '</ul>';
        listDiv.innerHTML = html;
    }

    async function initCustomer() {
        const container = document.getElementById('track-form-container');
        container.innerHTML = `
            <form id="track-form">
                <div class="form-group">
                    <label for="track-id">Product ID</label>
                    <input type="text" id="track-id" required>
                </div>
                <button type="submit" class="btn">Track</button>
                <div id="track-error" class="error-message"></div>
            </form>
            <div id="customer-products" class="card" style="margin-top:2rem;"><h4>Available Products</h4><div id="cust-product-list" style="font-size:0.9rem;color:var(--text-light);">Loading...</div></div>
        `;
        document.getElementById('track-form').addEventListener('submit', showTrack);
        loadCustomerProducts();
    }

    async function loadCustomerProducts() {
        const listDiv = document.getElementById('cust-product-list');
        listDiv.textContent = '';
        let items = [];
        try {
            if (supabaseClient) {
                const { data } = await supabaseClient.from('products').select('id,name,image_url').order('created_at', { ascending: false }).limit(10);
                if (data && data.length) items = data;
            }
        } catch (err) {
            console.warn('Customer list using demo data', err);
        }
        if (items.length === 0 && window.demoData && window.demoData.products) {
            items = window.demoData.products.map(p => ({id:p.id,name:p.name,image_url:p.image_url}));
        }
        if (items.length === 0) {
            listDiv.textContent = 'No products available';
            return;
        }
        let html = '<ul style="list-style:none;padding:0;">';
        items.forEach(p => {
            const img = p.image_url ? `<img src="${p.image_url}" class="product-thumb" style="height:30px;vertical-align:middle;margin-right:0.5rem" alt="${p.name}">` : '';
            html += `<li>${img}<code>${p.id.substring(0,8)}...</code> ${p.name}</li>`;
        });
        html += '</ul>';
        listDiv.innerHTML = html;
    }

    async function showTrack(e) {
        e.preventDefault();
        const form = document.getElementById('track-form');
        const id = document.getElementById('track-id').value.trim();
        const err = document.getElementById('track-error');
        const result = document.getElementById('track-result');
        err.textContent = '';
        result.innerHTML = '';

        if (!id) {
            err.textContent = 'Please enter a product ID';
            return;
        }

        try {
            let product = null;
            let blocks = [];
            let isChainValid = false;
            let authenticityScore = 0;

            if (supabaseClient && Blockchain) {
                const { data: prodData, error: pErr } = await supabaseClient.from('products').select('*').eq('id', id).single();
                if (pErr && pErr.code !== 'PGRST116') throw pErr;
                if (prodData) product = prodData;

                if (product) {
                    // Fetch blockchain blocks
                    blocks = await Blockchain.getProductHistory(id, supabaseClient);
                    
                    // Verify chain integrity
                    isChainValid = await Blockchain.verifyChain(blocks);
                    
                    // Calculate authenticity score
                    authenticityScore = Blockchain.calculateAuthenticityScore(blocks);
                }
            }

            // Demo data fallback removed - use real data only from Supabase

            if (!product) {
                err.textContent = 'Product not found in system';
                return;
            }

            // Build verification badge
            const verificationBadge = `
                <div style="margin:1rem 0;padding:1rem;border-radius:8px;${isChainValid ? 'background:#dcfce7;border:1px solid #16a34a;' : 'background:#fee2e2;border:1px solid #dc2626;'}">
                    <div style="font-weight:700;${isChainValid ? 'color:#16a34a;' : 'color:#dc2626;'}">
                        ${isChainValid ? '✅ GENUINE PRODUCT' : '❌ VERIFICATION FAILED'}
                    </div>
                    <div style="font-size:0.9rem;margin-top:0.5rem;${isChainValid ? 'color:#15803d;' : 'color:#991b1b;'}">
                        Authenticity Score: ${authenticityScore}%
                    </div>
                    <div style="font-size:0.85rem;margin-top:0.5rem;opacity:0.8;">
                        Chain Status: ${isChainValid ? 'Valid ✓' : 'Invalid ✗'} | Blocks: ${blocks.length}
                    </div>
                </div>
            `;

            // Build timeline
            let timeline = '<ul class="timeline">';
            if (blocks.length === 0) {
                timeline += '<li><div class="timeline-content" style="color:var(--text-light);">No supply chain events recorded yet</div></li>';
            } else {
                blocks.forEach((block, idx) => {
                    const data = block.data;
                    const timestamp = new Date(data.timestamp || block.created_at);
                    timeline += `<li>
                        <div class="timeline-content">
                            <div class="timeline-time">${timestamp.toLocaleString()}</div>
                            <div class="timeline-text">
                                <strong>${Blockchain.formatStatus(data.status)}</strong><br>
                                <span style="color:var(--text-light);font-size:0.9rem;">📍 ${data.location} | 👤 ${data.actor}</span><br>
                                <code style="font-size:0.8rem;color:#666;word-break:break-all;">Hash: ${block.hash}</code>
                            </div>
                        </div>
                    </li>`;
                });
            }
            timeline += '</ul>';

            const imgTag = product.image_url ? `<img src="${product.image_url}" alt="${product.name}" style="max-height:120px;display:block;margin:1rem 0;border-radius:8px;">` : '';
            
            result.innerHTML = `
                <div class="card">
                    <h4>${product.name}</h4>
                    ${imgTag}
                    ${verificationBadge}
                    <div style="margin-top:1.5rem;">
                        <h5 style="color:var(--primary);margin-bottom:1rem;">Product Details</h5>
                        <p><strong>Product ID:</strong><br><code style="color:#666;">${product.id}</code></p>
                        <p><strong>Batch Number:</strong> ${product.batch_number}</p>
                        <p><strong>Manufacturing Date:</strong> ${product.manufacturing_date || 'N/A'}</p>
                        ${product.description ? `<p><strong>Description:</strong> ${product.description}</p>` : ''}
                    </div>
                    <div style="margin-top:1.5rem;">
                        <h5 style="color:var(--primary);margin-bottom:1rem;">Supply Chain History</h5>
                        ${timeline}
                    </div>
                </div>
            `;
        } catch (err) {
            console.error(err);
            err.textContent = err.message || 'Error tracking product';
        }
    }

    return { init, initCustomer };
})();

window.tracking = tracking;
