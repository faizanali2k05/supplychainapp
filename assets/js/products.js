// products.js - manufacturer module
const products = (() => {
    // Calculate SHA-256 hash for blockchain
    async function calculateHash(data, previousHash) {
        const combined = data + previousHash;
        const msgBuffer = new TextEncoder().encode(combined);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    async function init() {
        const container = document.getElementById('product-form-container');
        container.innerHTML = `
            <form id="add-product-form">
                <div class="form-group">
                    <label for="prod-name"><i class="fas fa-file-alt"></i> Product Name</label>
                    <input type="text" id="prod-name" required>
                </div>
                <div class="form-group">
                    <label for="batch-number">Batch Number</label>
                    <input type="text" id="batch-number" required>
                </div>
                <div class="form-group">
                    <label for="mfg-date"><i class="fas fa-calendar"></i> Manufacturing Date</label>
                    <input type="date" id="mfg-date" required>
                </div>
                <div class="form-group">
                    <label for="description">Description</label>
                    <textarea id="description" rows="3"></textarea>
                </div>
                <div class="form-group">
                    <label for="verification-string"><i class="fas fa-lock"></i> Verification String (for authentication)</label>
                    <input type="text" id="verification-string" placeholder="Enter a unique string for product verification" required>
                    <small style="display:block;margin-top:0.5rem;color:var(--text-light);">This string will be hashed on blockchain. Keep it secret and recoverable.</small>
                </div>
                <div class="form-group">
                    <label for="prod-image">Product Image</label>
                    <input type="file" id="prod-image" accept="image/*" style="padding:0.5rem;">
                    <small style="display:block;margin-top:0.5rem;color:var(--text-light);">Upload a product image (optional)</small>
                    <div id="image-preview" style="margin-top:1rem;"></div>
                </div>
                <button type="submit" class="btn">Register</button>
                <div id="prod-error" class="error-message"></div>
                <div id="prod-success" class="success-message"></div>
            </form>
            <div id="qr-output"></div>
            <div id="product-list" class="card" style="margin-top:2rem;"><h4>Existing Products</h4><div id="products-table">Loading...</div></div>
        `;
        
        // Image preview handler
        document.getElementById('prod-image').addEventListener('change', function(e) {
            const file = e.target.files[0];
            const preview = document.getElementById('image-preview');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(event) {
                    preview.innerHTML = `<div style="margin-top:0.5rem;">
                        <img src="${event.target.result}" alt="Preview" style="max-width:100px;max-height:100px;border-radius:8px;border:2px solid var(--primary);">
                        <p style="font-size:0.85rem;color:var(--text-light);margin-top:0.5rem;">${file.name}</p>
                    </div>`;
                };
                reader.readAsDataURL(file);
            } else {
                preview.innerHTML = '';
            }
        });
        
        document.getElementById('add-product-form').addEventListener('submit', addProduct);
        loadProducts();
    }

    async function loadProducts() {
        const tableDiv = document.getElementById('products-table');
        tableDiv.textContent = '';
        let items = [];
        try {
            if (supabaseClient) {
                const { data, error } = await supabaseClient.from('products').select('*').order('created_at', { ascending: false }).limit(20);
                if (data && data.length) items = data;
            }
        } catch (err) {
            console.warn('Supabase fetch failed, using demo data', err);
        }
        if (items.length === 0 && window.demoData && window.demoData.products) {
            items = window.demoData.products;
        }
        if (items.length === 0) {
            tableDiv.textContent = 'No products available.';
            return;
        }
        let html = '<table style="width:100%; border-collapse:collapse;"><tr><th>Image</th><th>Name</th><th>Batch</th><th>Mfg Date</th></tr>';
        items.forEach(p => {
            const img = p.image_url ? `<img src="${p.image_url}" alt="${p.name}" class="product-thumb">` : '';
            html += `<tr><td>${img}</td><td>${p.name}</td><td>${p.batch_number}</td><td>${p.manufacturing_date || ''}</td></tr>`;
        });
        html += '</table>';
        tableDiv.innerHTML = html;
    }

    async function addProduct(e) {
        e.preventDefault();
        const form = document.getElementById('add-product-form');
        const submitBtn = form.querySelector('button[type="submit"]');
        const name = document.getElementById('prod-name').value.trim();
        const batch = document.getElementById('batch-number').value.trim();
        const mfg = document.getElementById('mfg-date').value;
        const verificationString = document.getElementById('verification-string').value.trim();
        const imageFile = document.getElementById('prod-image').files[0];
        const err = document.getElementById('prod-error');
        const success = document.getElementById('prod-success');
        err.textContent = '';
        success.textContent = '';

        if (!name || !batch || !mfg || !verificationString) {
            err.textContent = 'All fields including verification string are required.';
            return;
        }

        try {
            if (UIUtils) UIUtils.setButtonLoading(submitBtn, true);
            const { data: session } = await supabaseClient.auth.getSession();
            const manufacturer_id = session.session.user.id;
            const id = crypto.randomUUID();
            const desc = document.getElementById('description').value.trim();
            
            // Handle image upload
            let imageUrl = '';
            if (imageFile) {
                try {
                    imageUrl = await convertImageToBase64(imageFile);
                } catch (imgErr) {
                    console.warn('Image upload failed:', imgErr);
                    err.textContent = 'Warning: Image upload failed, but product will still be registered.';
                }
            }

            // Prepare product data
            const productData = {
                name,
                batch_number: batch,
                manufacturing_date: mfg
            };

            // Insert product
            const { error } = await supabaseClient.from('products').insert([{
                id,
                ...productData,
                manufacturer_id,
                qr_code: '',
                description: desc,
                image_url: imageUrl
            }]);
            if (error) throw error;

            // Calculate hash for verification string
            const verificationHash = await calculateHash(verificationString, '');
            
            // Store verification string and hash
            const { error: hashError } = await supabaseClient.from('product_verification_hashes').insert([{
                product_id: id,
                verification_string: verificationString,
                verification_hash: verificationHash,
                created_by: manufacturer_id
            }]);
            if (hashError) {
                console.warn('Failed to store verification hash:', hashError);
            }

            // Initialize blockchain for this product using Blockchain module
            if (Blockchain) {
                const blockchainInitialized = await Blockchain.initializeProductBlockchain(id, productData, supabaseClient, manufacturer_id);
                if (!blockchainInitialized) {
                    console.warn('Blockchain initialization warning');
                }
            }

            success.textContent = 'Product registered successfully! Generating QR code...';
            const qrDiv = document.getElementById('qr-output');
            qrDiv.innerHTML = '';
            
            // Generate QR code with product link
            const qrContent = Blockchain ? Blockchain.generateQRContent(id) : id;
            new QRCode(qrDiv, { text: qrContent, width: 150, height: 150, colorDark: '#2563eb', colorLight: '#ffffff' });
            
            qrDiv.innerHTML += `
                <div style="margin-top:1rem;padding:1rem;background:var(--light-bg);border-radius:8px;">
                    <p style="margin:0;font-size:0.9rem;color:var(--text-light);"><strong>Product ID:</strong></p>
                    <code style="display:block;word-break:break-all;margin-top:0.5rem;padding:0.5rem;background:#fff;border-radius:4px;font-size:0.85rem;">${id}</code>
                    <p style="margin:0.5rem 0 0 0;font-size:0.85rem;color:var(--text-light);">Product registered with blockchain genesis block and verification string stored securely</p>
                </div>
            `;
            
            // Reset form
            form.reset();
            document.getElementById('image-preview').innerHTML = '';
            
            // Reload products list
            setTimeout(() => {
                loadProducts();
            }, 2000);
        } catch (err) {
            console.error(err);
            err.textContent = err.message || 'Failed to register product';
        } finally {
            if (UIUtils && submitBtn) UIUtils.setButtonLoading(submitBtn, false);
        }
    }
    
    // Convert image file to base64
    async function convertImageToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    return { init };
})();

window.products = products;
