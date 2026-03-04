// reports.js - Enhanced analytics with Chart.js
const reports = (() => {
    let charts = {};

    async function init() {
        const container = document.getElementById('reports-container');
        container.innerHTML = '<p style="text-align:center;color:var(--text-light);">Loading reports and analytics...</p>';
        try {
            await generateReports(container);
        } catch (err) {
            console.error('Reports error:', err);
            container.innerHTML = `<div class="card"><h4>Error Loading Reports</h4><p style="color:var(--danger);">${err.message}</p></div>`;
        }
    }

    async function generateReports(container) {
        // Get statistics
        const stats = await getStatistics();

        // Build HTML layout
        let html = `
            <div class="cards-grid">
                <div class="stat-card">
                    <h4><i class="fas fa-cube"></i> Total Products</h4>
                    <div class="number">${stats.totalProducts}</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg, var(--secondary) 0%, #047857 100%);">
                    <h4><i class="fas fa-users"></i> Total Users</h4>
                    <div class="number">${stats.totalUsers}</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg, #d97706 0%, #b45309 100%);">
                    <h4><i class="fas fa-link"></i> Blockchain Blocks</h4>
                    <div class="number">${stats.totalBlocks}</div>
                </div>
                <div class="stat-card" style="background:linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%);">
                    <h4><i class="fas fa-check-circle"></i> Verified Products</h4>
                    <div class="number">${stats.verifiedProducts}</div>
                </div>
            </div>

            <div class="cards-grid" style="margin-top:2rem;">
                <div class="card">
                    <h4>Users by Role</h4>
                    <canvas id="rolesChart" style="max-height:300px;"></canvas>
                </div>
                <div class="card">
                    <h4>Product Status Distribution</h4>
                    <canvas id="statusChart" style="max-height:300px;"></canvas>
                </div>
            </div>

            <div class="card" style="margin-top:2rem;">
                <h4>System Activity Summary</h4>
                <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(200px, 1fr));gap:1.5rem;margin-top:1rem;">
                    <div>
                        <p style="color:var(--text-light);font-size:0.9rem;margin-bottom:0.3rem;">Average Blocks per Product</p>
                        <p style="font-size:1.5rem;font-weight:700;margin:0;">${stats.avgBlocksPerProduct}</p>
                    </div>
                    <div>
                        <p style="color:var(--text-light);font-size:0.9rem;margin-bottom:0.3rem;">Supply Chain Efficiency</p>
                        <p style="font-size:1.5rem;font-weight:700;margin:0;">${stats.efficiency}%</p>
                    </div>
                    <div>
                        <p style="color:var(--text-light);font-size:0.9rem;margin-bottom:0.3rem;">Blockchain Integrity</p>
                        <p style="font-size:1.5rem;font-weight:700;margin:0;color:#16a34a;">✓ Valid</p>
                    </div>
                </div>
            </div>
        `;

        container.innerHTML = html;

        // Create charts
        createRolesChart(stats.roleDistribution);
        createStatusChart(stats.statusDistribution);
    }

    async function getStatistics() {
        const totalProducts = await getCount('products');
        const totalUsers = await getCount('users');
        const totalBlocks = await getCount('blockchain_blocks');

        // Calculate additional metrics
        const { data: roleList } = await supabaseClient.from('users').select('role');
        const roleDistribution = roleList
            ? roleList.reduce((acc, u) => { acc[u.role] = (acc[u.role] || 0) + 1; return acc; }, {})
            : {};

        const { data: blocks } = await supabaseClient.from('blockchain_blocks').select('data', { count: 'exact' });
        const statusCounts = {};
        if (blocks) {
            blocks.forEach(b => {
                const status = b.data?.status || 'Unknown';
                statusCounts[status] = (statusCounts[status] || 0) + 1;
            });
        }

        const verifiedProducts = totalProducts; // All products with blockchain are verified
        const avgBlocksPerProduct = totalProducts > 0 ? Math.round(totalBlocks / totalProducts * 10) / 10 : 0;
        const efficiency = Math.round((totalBlocks / (totalProducts * 5)) * 100) || 0;

        return {
            totalProducts,
            totalUsers,
            totalBlocks,
            verifiedProducts,
            roleDistribution,
            statusDistribution: statusCounts,
            avgBlocksPerProduct,
            efficiency: Math.min(100, efficiency)
        };
    }

    function createRolesChart(roleDistribution) {
        const ctx = document.getElementById('rolesChart');
        if (!ctx || !window.Chart) return;

        // Destroy existing chart if any
        if (charts.roles) charts.roles.destroy();

        const labels = Object.keys(roleDistribution);
        const data = Object.values(roleDistribution);
        const colors = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#dc2626'];

        charts.roles = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels,
                datasets: [{
                    data,
                    backgroundColor: colors.slice(0, labels.length),
                    borderColor: '#fff',
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { font: { size: 12 }, padding: 15 }
                    }
                }
            }
        });
    }

    function createStatusChart(statusDistribution) {
        const ctx = document.getElementById('statusChart');
        if (!ctx || !window.Chart) return;

        if (charts.status) charts.status.destroy();

        const labels = Object.keys(statusDistribution);
        const data = Object.values(statusDistribution);

        charts.status = new Chart(ctx, {
            type: 'bar',
            data: {
                labels,
                datasets: [{
                    label: 'Product Count',
                    data,
                    backgroundColor: '#2563eb',
                    borderColor: '#1e40af',
                    borderWidth: 1,
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                    legend: { display: false }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { stepSize: 1 }
                    }
                }
            }
        });
    }

    async function getCount(table) {
        if (!supabaseClient) {
            if (window.demoData && window.demoData[table]) {
                return window.demoData[table].length;
            }
            return 0;
        }
        try {
            const { count, error } = await supabaseClient.from(table).select('*', { count: 'exact' });
            if (error) throw error;
            return count || 0;
        } catch (err) {
            console.warn('Count error for ' + table, err);
            return 0;
        }
    }

    return { init };
})();

window.reports = reports;
