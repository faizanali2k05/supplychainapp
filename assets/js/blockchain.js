// blockchain.js - Blockchain simulation & cryptographic operations

const Blockchain = (() => {
    // SHA-256 Hash calculation
    async function calculateHash(data) {
        const msgBuffer = new TextEncoder().encode(data);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    // Block structure
    class Block {
        constructor(index, data, previousHash, timestamp = new Date().toISOString()) {
            this.index = index;
            this.data = data;
            this.previousHash = previousHash;
            this.timestamp = timestamp;
            this.hash = '';
        }

        async calculateHash() {
            const blockData = JSON.stringify({
                index: this.index,
                data: this.data,
                previousHash: this.previousHash,
                timestamp: this.timestamp
            });
            this.hash = await calculateHash(blockData);
            return this.hash;
        }
    }

    // Create genesis block for a product
    async function createGenesisBlock(productId, productData, createdBy) {
        const genesisData = {
            productId,
            productName: productData.name,
            batchNumber: productData.batch_number,
            manufacturingDate: productData.manufacturing_date,
            status: 'Manufactured',
            location: 'Factory',
            actor: 'Manufacturer',
            actorId: createdBy,
            timestamp: new Date().toISOString()
        };

        const block = new Block(0, genesisData, '0');
        await block.calculateHash();
        
        return {
            product_id: productId,
            block_index: block.index,
            data: block.data,
            previous_hash: block.previousHash,
            hash: block.hash,
            created_by: createdBy,
            created_at: new Date().toISOString()
        };
    }

    // Create new block for supply chain update
    async function createBlock(lastBlock, productId, status, location, actor, actorId) {
        const blockData = {
            productId,
            status,
            location,
            actor,
            actorId,
            timestamp: new Date().toISOString()
        };

        const blockIndex = (lastBlock?.block_index || 0) + 1;
        const block = new Block(blockIndex, blockData, lastBlock?.hash || '0');
        await block.calculateHash();

        return {
            product_id: productId,
            block_index: block.index,
            data: block.data,
            previous_hash: block.previousHash,
            hash: block.hash,
            created_by: actorId,
            created_at: new Date().toISOString()
        };
    }

    // Verify chain integrity
    async function verifyChain(blocks) {
        if (!blocks || blocks.length === 0) return true;

        for (let i = 0; i < blocks.length; i++) {
            const block = blocks[i];

            // Verify current block hash
            const tempBlock = new Block(block.block_index, block.data, block.previous_hash, block.created_at);
            const calculatedHash = await tempBlock.calculateHash();

            if (calculatedHash !== block.hash) {
                console.error(`Block ${i} hash mismatch!`);
                return false;
            }

            // Verify previous hash link
            if (i > 0) {
                if (block.previous_hash !== blocks[i - 1].hash) {
                    console.error(`Block ${i} previous hash doesn't match!`);
                    return false;
                }
            } else {
                // Genesis block should have 0 as previous hash
                if (block.previous_hash !== '0') {
                    console.error('Genesis block previous hash is not 0!');
                    return false;
                }
            }
        }

        return true;
    }

    // Get complete supply chain history for a product
    async function getProductHistory(productId, supabaseClient) {
        try {
            const { data, error } = await supabaseClient
                .from('blockchain_blocks')
                .select('*')
                .eq('product_id', productId)
                .order('block_index', { ascending: true });

            if (error) throw error;
            return data || [];
        } catch (err) {
            console.error('Failed to fetch product history:', err);
            return [];
        }
    }

    // Format product status for display
    function formatStatus(status) {
        const statusMap = {
            'Manufactured': '<i class="fas fa-industry"></i> Manufactured',
            'In Transit': '<i class="fas fa-truck"></i> In Transit',
            'At Distributor': '<i class="fas fa-box"></i> At Distributor',
            'At Retailer': '<i class="fas fa-store"></i> At Retailer',
            'Delivered': '<i class="fas fa-check-circle"></i> Delivered'
        };
        return statusMap[status] || status;
    }

    // Generate QR code content
    function generateQRContent(productId, isVerification = false) {
        if (isVerification) {
            return `${window.location.origin}/?verify=${productId}`;
        }
        return productId;
    }

    // Parse QR code content
    function parseQRContent(content) {
        if (content.includes('verify=')) {
            const params = new URLSearchParams(content.split('?')[1]);
            return {
                productId: params.get('verify'),
                isVerification: true
            };
        }
        return {
            productId: content,
            isVerification: false
        };
    }

    // Calculate product authenticity score
    function calculateAuthenticityScore(blocks) {
        if (!blocks || blocks.length === 0) return 0;

        let score = 100; // Start with 100%
        const maxStatuses = 5; // Manufactured, In Transit, At Distributor, At Retailer, Delivered
        const statuses = new Set();

        blocks.forEach(block => {
            if (block.data?.status) {
                statuses.add(block.data.status);
            }
        });

        // Reduce score if chain is incomplete (missing statuses)
        if (statuses.size < maxStatuses) {
            score -= (maxStatuses - statuses.size) * 5;
        }

        return Math.max(0, score);
    }

    // Get current product status
    function getCurrentStatus(blocks) {
        if (!blocks || blocks.length === 0) return null;
        const lastBlock = blocks[blocks.length - 1];
        return lastBlock.data?.status || null;
    }

    // Get current product location
    function getCurrentLocation(blocks) {
        if (!blocks || blocks.length === 0) return null;
        const lastBlock = blocks[blocks.length - 1];
        return lastBlock.data?.location || null;
    }

    // Initialize blockchain for new product with all required tables
    async function initializeProductBlockchain(productId, productData, supabaseClient, userId) {
        try {
            // Create genesis block
            const genesisBlock = await createGenesisBlock(productId, productData, userId);

            // Insert genesis block
            const { error } = await supabaseClient
                .from('blockchain_blocks')
                .insert([genesisBlock]);

            if (error) {
                console.error('Failed to create genesis block:', error);
                return false;
            }

            return true;
        } catch (err) {
            console.error('Blockchain initialization failed:', err);
            return false;
        }
    }

    return {
        calculateHash,
        Block,
        createGenesisBlock,
        createBlock,
        verifyChain,
        getProductHistory,
        formatStatus,
        generateQRContent,
        parseQRContent,
        calculateAuthenticityScore,
        getCurrentStatus,
        getCurrentLocation,
        initializeProductBlockchain
    };
})();

// Export for use
window.Blockchain = Blockchain;
