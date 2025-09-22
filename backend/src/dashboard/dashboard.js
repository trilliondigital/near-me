// Analytics Dashboard JavaScript
class AnalyticsDashboard {
    constructor() {
        this.charts = {};
        this.currentTimeRange = 'week';
        this.currentPlatform = '';
        this.refreshInterval = null;
        
        this.init();
    }

    async loadSlaSummary() {
        try {
            const response = await fetch('/api/monitoring/sla?window=1h');
            const data = await response.json();
            if (data.success) {
                const m = data.data;
                document.getElementById('slaSuccessRate').textContent = `${(m.success_rate || 0).toFixed(2)}%`;
                document.getElementById('slaAvgLatency').textContent = `${m.avg_latency_ms || 0} ms`;
                document.getElementById('slaP95Latency').textContent = `${m.p95_latency_ms || 0} ms`;
                document.getElementById('slaServerErrors').textContent = `${m.server_errors || 0}`;
            }
        } catch (e) {
            console.error('Failed to load SLA summary', e);
        }
    }

    async loadSlaTimeseries() {
        try {
            const response = await fetch('/api/monitoring/sla/timeseries?minutes=60');
            const data = await response.json();
            if (data.success) {
                this.renderSlaChart(data.data);
            }
        } catch (e) {
            console.error('Failed to load SLA timeseries', e);
        }
    }

    renderSlaChart(data) {
        const ctx = document.getElementById('slaChart').getContext('2d');
        if (this.charts.sla) {
            this.charts.sla.destroy();
        }

        const labels = data.map(d => new Date(d.minute).toLocaleTimeString());
        const p95 = data.map(d => d.p95_latency_ms || 0);
        const avg = data.map(d => d.avg_latency_ms || 0);

        this.charts.sla = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [
                    {
                        label: 'p95 Latency (ms)',
                        data: p95,
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239,68,68,0.1)',
                        tension: 0.4,
                        fill: true
                    },
                    {
                        label: 'Avg Latency (ms)',
                        data: avg,
                        borderColor: '#10b981',
                        backgroundColor: 'rgba(16,185,129,0.1)',
                        tension: 0.4,
                        fill: true
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'top' } },
                scales: {
                    y: { beginAtZero: true },
                    x: {}
                }
            }
        });
    }

    async init() {
        this.setupEventListeners();
        await this.loadDashboard();
        this.startAutoRefresh();
    }

    setupEventListeners() {
        // Time range selector
        document.getElementById('timeRange').addEventListener('change', (e) => {
            this.currentTimeRange = e.target.value;
            this.toggleCustomDateInputs();
            this.loadDashboard();
        });

        // Platform selector
        document.getElementById('platform').addEventListener('change', (e) => {
            this.currentPlatform = e.target.value;
            this.loadDashboard();
        });

        // Custom date inputs
        document.getElementById('startDate').addEventListener('change', () => {
            if (this.currentTimeRange === 'custom') {
                this.loadDashboard();
            }
        });

        document.getElementById('endDate').addEventListener('change', () => {
            if (this.currentTimeRange === 'custom') {
                this.loadDashboard();
            }
        });
    }

    toggleCustomDateInputs() {
        const startDate = document.getElementById('startDate');
        const endDate = document.getElementById('endDate');
        
        if (this.currentTimeRange === 'custom') {
            startDate.style.display = 'block';
            endDate.style.display = 'block';
            
            // Set default dates
            const end = new Date();
            const start = new Date();
            start.setDate(start.getDate() - 7);
            
            startDate.value = start.toISOString().split('T')[0];
            endDate.value = end.toISOString().split('T')[0];
        } else {
            startDate.style.display = 'none';
            endDate.style.display = 'none';
        }
    }

    async loadDashboard() {
        try {
            await Promise.all([
                this.loadKeyMetrics(),
                this.loadActivityChart(),
                this.loadFunnelChart(),
                this.loadPlatformChart(),
                this.loadRetentionChart(),
                this.loadConversionFunnel(),
                this.loadRecentEvents(),
                this.loadSlaSummary(),
                this.loadSlaTimeseries()
            ]);
        } catch (error) {
            console.error('Failed to load dashboard:', error);
            this.showError('Failed to load dashboard data');
        }
    }

    async loadKeyMetrics() {
        try {
            const params = this.getTimeRangeParams();
            const response = await fetch(`/api/analytics/metrics/daily?${params}`);
            const data = await response.json();

            if (data.success) {
                this.updateKeyMetrics(data.data);
            }
        } catch (error) {
            console.error('Failed to load key metrics:', error);
        }
    }

    updateKeyMetrics(metrics) {
        // Calculate current day metrics
        const today = metrics[0] || {};
        const yesterday = metrics[1] || {};

        // Daily Active Users
        const dau = today.daily_active_users || 0;
        const dauChange = this.calculateChange(dau, yesterday.daily_active_users || 0);
        document.getElementById('dauValue').textContent = dau.toLocaleString();
        this.updateChangeIndicator('dauChange', dauChange);

        // Tasks Created
        const tasks = today.tasks_created || 0;
        const tasksChange = this.calculateChange(tasks, yesterday.tasks_created || 0);
        document.getElementById('tasksValue').textContent = tasks.toLocaleString();
        this.updateChangeIndicator('tasksChange', tasksChange);

        // Task Completion Rate
        const completionRate = today.tasks_completed && today.tasks_created 
            ? (today.tasks_completed / today.tasks_created * 100)
            : 0;
        const yesterdayRate = yesterday.tasks_completed && yesterday.tasks_created
            ? (yesterday.tasks_completed / yesterday.tasks_created * 100)
            : 0;
        const completionChange = this.calculateChange(completionRate, yesterdayRate);
        document.getElementById('completionValue').textContent = `${completionRate.toFixed(1)}%`;
        this.updateChangeIndicator('completionChange', completionChange);

        // Notification Engagement (placeholder calculation)
        const engagement = today.nudges_shown ? 
            ((today.tasks_completed || 0) / today.nudges_shown * 100) : 0;
        const yesterdayEngagement = yesterday.nudges_shown ?
            ((yesterday.tasks_completed || 0) / yesterday.nudges_shown * 100) : 0;
        const engagementChange = this.calculateChange(engagement, yesterdayEngagement);
        document.getElementById('engagementValue').textContent = `${engagement.toFixed(1)}%`;
        this.updateChangeIndicator('engagementChange', engagementChange);
    }

    calculateChange(current, previous) {
        if (previous === 0) return current > 0 ? 100 : 0;
        return ((current - previous) / previous * 100);
    }

    updateChangeIndicator(elementId, change) {
        const element = document.getElementById(elementId);
        const isPositive = change >= 0;
        
        element.className = `metric-change ${isPositive ? 'positive' : 'negative'}`;
        element.textContent = `${isPositive ? '+' : ''}${change.toFixed(1)}% vs yesterday`;
    }

    async loadActivityChart() {
        try {
            const params = this.getTimeRangeParams();
            const response = await fetch(`/api/analytics/metrics/daily?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderActivityChart(data.data);
            }
        } catch (error) {
            console.error('Failed to load activity chart:', error);
        }
    }

    renderActivityChart(data) {
        const ctx = document.getElementById('activityChart').getContext('2d');
        
        if (this.charts.activity) {
            this.charts.activity.destroy();
        }

        const labels = data.map(d => new Date(d.date).toLocaleDateString());
        const dauData = data.map(d => d.daily_active_users || 0);
        const sessionsData = data.map(d => d.daily_sessions || 0);

        this.charts.activity = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.reverse(),
                datasets: [{
                    label: 'Daily Active Users',
                    data: dauData.reverse(),
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    tension: 0.4,
                    fill: true
                }, {
                    label: 'Daily Sessions',
                    data: sessionsData.reverse(),
                    borderColor: '#f093fb',
                    backgroundColor: 'rgba(240, 147, 251, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top',
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    async loadFunnelChart() {
        try {
            const params = this.getTimeRangeParams();
            const response = await fetch(`/api/analytics/metrics/daily?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderFunnelChart(data.data);
            }
        } catch (error) {
            console.error('Failed to load funnel chart:', error);
        }
    }

    renderFunnelChart(data) {
        const ctx = document.getElementById('funnelChart').getContext('2d');
        
        if (this.charts.funnel) {
            this.charts.funnel.destroy();
        }

        // Aggregate data for funnel
        const totals = data.reduce((acc, day) => {
            acc.tasks_created += day.tasks_created || 0;
            acc.tasks_completed += day.tasks_completed || 0;
            acc.nudges_shown += day.nudges_shown || 0;
            return acc;
        }, { tasks_created: 0, tasks_completed: 0, nudges_shown: 0 });

        this.charts.funnel = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['Tasks Created', 'Nudges Shown', 'Tasks Completed'],
                datasets: [{
                    label: 'Count',
                    data: [totals.tasks_created, totals.nudges_shown, totals.tasks_completed],
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(240, 147, 251, 0.8)',
                        'rgba(16, 185, 129, 0.8)'
                    ],
                    borderColor: [
                        '#667eea',
                        '#f093fb',
                        '#10b981'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    async loadPlatformChart() {
        try {
            const params = this.getTimeRangeParams();
            const response = await fetch(`/api/analytics/metrics/daily?${params}`);
            const data = await response.json();

            if (data.success) {
                this.renderPlatformChart(data.data);
            }
        } catch (error) {
            console.error('Failed to load platform chart:', error);
        }
    }

    renderPlatformChart(data) {
        const ctx = document.getElementById('platformChart').getContext('2d');
        
        if (this.charts.platform) {
            this.charts.platform.destroy();
        }

        // Aggregate by platform
        const platformData = data.reduce((acc, day) => {
            const platform = day.platform || 'unknown';
            if (!acc[platform]) {
                acc[platform] = 0;
            }
            acc[platform] += day.daily_active_users || 0;
            return acc;
        }, {});

        const labels = Object.keys(platformData);
        const values = Object.values(platformData);

        this.charts.platform = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels.map(l => l.charAt(0).toUpperCase() + l.slice(1)),
                datasets: [{
                    data: values,
                    backgroundColor: [
                        'rgba(102, 126, 234, 0.8)',
                        'rgba(240, 147, 251, 0.8)',
                        'rgba(16, 185, 129, 0.8)'
                    ],
                    borderColor: [
                        '#667eea',
                        '#f093fb',
                        '#10b981'
                    ],
                    borderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'bottom'
                    }
                }
            }
        });
    }

    async loadRetentionChart() {
        try {
            const response = await fetch('/api/analytics/retention');
            const data = await response.json();

            if (data.success) {
                this.renderRetentionChart(data.data);
            }
        } catch (error) {
            console.error('Failed to load retention chart:', error);
        }
    }

    renderRetentionChart(data) {
        const ctx = document.getElementById('retentionChart').getContext('2d');
        
        if (this.charts.retention) {
            this.charts.retention.destroy();
        }

        const labels = data.map(d => new Date(d.retention_cohort).toLocaleDateString());
        const day1Data = data.map(d => (d.day_1_retained / d.cohort_size * 100) || 0);
        const day7Data = data.map(d => (d.day_7_retained / d.cohort_size * 100) || 0);
        const day30Data = data.map(d => (d.day_30_retained / d.cohort_size * 100) || 0);

        this.charts.retention = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels.slice(0, 10), // Show last 10 cohorts
                datasets: [{
                    label: 'Day 1 Retention',
                    data: day1Data.slice(0, 10),
                    borderColor: '#ef4444',
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Day 7 Retention',
                    data: day7Data.slice(0, 10),
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    tension: 0.4
                }, {
                    label: 'Day 30 Retention',
                    data: day30Data.slice(0, 10),
                    borderColor: '#10b981',
                    backgroundColor: 'rgba(16, 185, 129, 0.1)',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'top'
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        max: 100,
                        ticks: {
                            callback: function(value) {
                                return value + '%';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    },
                    x: {
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)'
                        }
                    }
                }
            }
        });
    }

    async loadConversionFunnel() {
        try {
            const response = await fetch('/api/analytics/conversion');
            const data = await response.json();

            if (data.success) {
                this.renderConversionFunnel(data.data[0]);
            }
        } catch (error) {
            console.error('Failed to load conversion funnel:', error);
        }
    }

    renderConversionFunnel(data) {
        const container = document.getElementById('conversionFunnel');
        
        if (!data) {
            container.innerHTML = '<div class="error">No conversion data available</div>';
            return;
        }

        container.innerHTML = `
            <table class="table">
                <thead>
                    <tr>
                        <th>Stage</th>
                        <th>Users</th>
                        <th>Conversion Rate</th>
                        <th>Drop-off</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Total Users</td>
                        <td>${data.total_users?.toLocaleString() || 0}</td>
                        <td>100.0%</td>
                        <td>-</td>
                    </tr>
                    <tr>
                        <td>Onboarding Completed</td>
                        <td>${data.onboarding_completed?.toLocaleString() || 0}</td>
                        <td>${data.onboarding_completion_rate || 0}%</td>
                        <td>${(100 - (data.onboarding_completion_rate || 0)).toFixed(1)}%</td>
                    </tr>
                    <tr>
                        <td>Trial Started</td>
                        <td>${data.trial_started?.toLocaleString() || 0}</td>
                        <td>${data.trial_conversion_rate || 0}%</td>
                        <td>${(100 - (data.trial_conversion_rate || 0)).toFixed(1)}%</td>
                    </tr>
                    <tr>
                        <td>Premium Converted</td>
                        <td>${data.premium_converted?.toLocaleString() || 0}</td>
                        <td>${data.premium_conversion_rate || 0}%</td>
                        <td>${(100 - (data.premium_conversion_rate || 0)).toFixed(1)}%</td>
                    </tr>
                </tbody>
            </table>
        `;
    }

    async loadRecentEvents() {
        try {
            const response = await fetch('/api/analytics/events/recent');
            const data = await response.json();

            if (data.success) {
                this.renderRecentEvents(data.data);
            }
        } catch (error) {
            console.error('Failed to load recent events:', error);
            document.getElementById('recentEvents').innerHTML = 
                '<div class="error">Failed to load recent events</div>';
        }
    }

    renderRecentEvents(events) {
        const container = document.getElementById('recentEvents');
        
        if (!events || events.length === 0) {
            container.innerHTML = '<div class="loading">No recent events</div>';
            return;
        }

        const eventsHtml = events.slice(0, 10).map(event => `
            <div style="padding: 0.75rem; border-bottom: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>${event.event_type}</strong>
                    <div style="font-size: 0.875rem; color: #64748b;">
                        Platform: ${event.platform} | Version: ${event.app_version}
                    </div>
                </div>
                <div style="font-size: 0.875rem; color: #64748b;">
                    ${new Date(event.timestamp).toLocaleString()}
                </div>
            </div>
        `).join('');

        container.innerHTML = eventsHtml;
    }

    getTimeRangeParams() {
        const params = new URLSearchParams();
        
        if (this.currentTimeRange === 'custom') {
            const startDate = document.getElementById('startDate').value;
            const endDate = document.getElementById('endDate').value;
            if (startDate) params.append('startDate', startDate);
            if (endDate) params.append('endDate', endDate);
        } else {
            params.append('timeRange', this.currentTimeRange);
        }
        
        if (this.currentPlatform) {
            params.append('platform', this.currentPlatform);
        }
        
        return params.toString();
    }

    startAutoRefresh() {
        // Refresh every 5 minutes
        this.refreshInterval = setInterval(() => {
            this.loadDashboard();
        }, 5 * 60 * 1000);
    }

    stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    showError(message) {
        const container = document.querySelector('.container');
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error';
        errorDiv.textContent = message;
        container.insertBefore(errorDiv, container.firstChild);
        
        // Remove error after 5 seconds
        setTimeout(() => {
            errorDiv.remove();
        }, 5000);
    }
}

// Global functions
function refreshDashboard() {
    if (window.dashboard) {
        window.dashboard.loadDashboard();
    }
}

// Initialize dashboard when page loads
document.addEventListener('DOMContentLoaded', () => {
    window.dashboard = new AnalyticsDashboard();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    if (window.dashboard) {
        window.dashboard.stopAutoRefresh();
    }
});