/**
 * Gantt Chart Component for KHS CRM
 * Visual timeline scheduling with drag-and-drop
 */

class GanttChart {
  constructor(container, options = {}) {
    this.container = container;
    this.jobs = [];
    this.workers = [];
    this.viewMode = options.viewMode || 'month'; // week, month, quarter
    this.currentDate = new Date();
    this.startDate = null;
    this.endDate = null;
    this.selectedJob = null;
    this.isDragging = false;
    
    this.init();
  }

  init() {
    this.calculateDateRange();
    this.render();
    this.attachEventListeners();
  }

  calculateDateRange() {
    const now = new Date();
    
    switch(this.viewMode) {
      case 'week':
        // Start from Monday of current week
        this.startDate = new Date(now);
        this.startDate.setDate(now.getDate() - now.getDay() + 1);
        this.startDate.setHours(0, 0, 0, 0);
        
        this.endDate = new Date(this.startDate);
        this.endDate.setDate(this.startDate.getDate() + 6);
        break;
        
      case 'month':
        // Start from first day of month
        this.startDate = new Date(now.getFullYear(), now.getMonth(), 1);
        this.endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        break;
        
      case 'quarter':
        // Start from beginning of quarter
        const quarter = Math.floor(now.getMonth() / 3);
        this.startDate = new Date(now.getFullYear(), quarter * 3, 1);
        this.endDate = new Date(now.getFullYear(), quarter * 3 + 3, 0);
        break;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="gantt-container">
        <div class="gantt-header">
          <div class="gantt-controls">
            <div class="view-switcher">
              <button class="view-btn ${this.viewMode === 'week' ? 'active' : ''}" data-view="week">Week</button>
              <button class="view-btn ${this.viewMode === 'month' ? 'active' : ''}" data-view="month">Month</button>
              <button class="view-btn ${this.viewMode === 'quarter' ? 'active' : ''}" data-view="quarter">Quarter</button>
            </div>
            <div class="date-navigation">
              <button class="nav-btn" id="ganttPrev">‹</button>
              <span class="date-range">${this.formatDateRange()}</span>
              <button class="nav-btn" id="ganttNext">›</button>
              <button class="today-btn" id="ganttToday">Today</button>
            </div>
            <div class="gantt-filters">
              <select id="ganttStatusFilter" class="filter-select">
                <option value="">All Statuses</option>
                <option value="QUOTED">Quoted</option>
                <option value="APPROVED">Approved</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="COMPLETED">Completed</option>
              </select>
              <select id="ganttWorkerFilter" class="filter-select">
                <option value="">All Workers</option>
              </select>
            </div>
          </div>
        </div>
        
        <div class="gantt-wrapper">
          <div class="gantt-sidebar">
            <div class="gantt-sidebar-header">
              <div class="column-header">Job / Customer</div>
              <div class="column-header">Status</div>
              <div class="column-header">Workers</div>
            </div>
            <div class="gantt-rows" id="ganttRows">
              <!-- Job rows will be inserted here -->
            </div>
          </div>
          
          <div class="gantt-timeline">
            <div class="gantt-timeline-header" id="timelineHeader">
              <!-- Timeline headers will be inserted here -->
            </div>
            <div class="gantt-timeline-body" id="timelineBody">
              <!-- Timeline bars will be inserted here -->
            </div>
            <div class="gantt-today-line" id="todayLine"></div>
          </div>
        </div>
        
        <div class="gantt-legend">
          <div class="legend-item">
            <span class="legend-color" style="background: #6B7280;"></span> Quoted
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #3B82F6;"></span> Approved
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #F59E0B;"></span> In Progress
          </div>
          <div class="legend-item">
            <span class="legend-color" style="background: #10B981;"></span> Completed
          </div>
        </div>
      </div>
    `;
    
    this.addStyles();
  }

  async loadData() {
    try {
      // Load jobs
      const jobsResponse = await fetch('/api/jobs');
      const jobs = await jobsResponse.json();
      
      // Load workers
      const workersResponse = await fetch('/api/workers');
      const workers = await workersResponse.json();
      
      this.jobs = jobs;
      this.workers = workers;
      
      // Populate worker filter
      const workerFilter = document.getElementById('ganttWorkerFilter');
      if (workerFilter) {
        workerFilter.innerHTML = '<option value="">All Workers</option>';
        this.workers.forEach(worker => {
          workerFilter.innerHTML += `<option value="${worker.id}">${worker.name}</option>`;
        });
      }
      
      this.renderTimeline();
    } catch (error) {
      console.error('Failed to load Gantt data:', error);
    }
  }

  renderTimeline() {
    const timelineHeader = document.getElementById('timelineHeader');
    const timelineBody = document.getElementById('timelineBody');
    const ganttRows = document.getElementById('ganttRows');
    
    if (!timelineHeader || !timelineBody || !ganttRows) return;
    
    // Clear existing content
    timelineHeader.innerHTML = '';
    timelineBody.innerHTML = '';
    ganttRows.innerHTML = '';
    
    // Generate timeline headers
    const days = this.getDaysInRange();
    const dayWidth = 100 / days.length;
    
    days.forEach(day => {
      const header = document.createElement('div');
      header.className = 'timeline-header-cell';
      header.style.width = `${dayWidth}%`;
      header.innerHTML = `
        <div class="timeline-day">${day.getDate()}</div>
        <div class="timeline-month">${this.getMonthShort(day.getMonth())}</div>
      `;
      timelineHeader.appendChild(header);
    });
    
    // Filter jobs
    const statusFilter = document.getElementById('ganttStatusFilter')?.value;
    const workerFilter = document.getElementById('ganttWorkerFilter')?.value;
    
    let filteredJobs = this.jobs;
    if (statusFilter) {
      filteredJobs = filteredJobs.filter(job => job.status === statusFilter);
    }
    
    // Render job rows
    filteredJobs.forEach((job, index) => {
      // Sidebar row
      const row = document.createElement('div');
      row.className = 'gantt-row';
      row.innerHTML = `
        <div class="gantt-cell job-info">
          <div class="job-title">${this.escapeHtml(job.title)}</div>
          <div class="job-customer">${this.escapeHtml(job.customer_name || 'Unknown')}</div>
        </div>
        <div class="gantt-cell">
          <span class="status-badge status-${job.status?.toLowerCase()}">${job.status || 'QUOTED'}</span>
        </div>
        <div class="gantt-cell">
          <div class="worker-badges">
            ${this.getJobWorkers(job.id).map(w => 
              `<span class="worker-badge">${w.initials || w.name.substring(0, 2).toUpperCase()}</span>`
            ).join('')}
          </div>
        </div>
      `;
      ganttRows.appendChild(row);
      
      // Timeline bar
      const timelineRow = document.createElement('div');
      timelineRow.className = 'timeline-row';
      
      if (job.start_date && job.end_date) {
        const bar = this.createTimelineBar(job);
        if (bar) {
          timelineRow.appendChild(bar);
        }
      }
      
      timelineBody.appendChild(timelineRow);
    });
    
    // Position today line
    this.positionTodayLine();
  }

  createTimelineBar(job) {
    const startDate = new Date(job.start_date);
    const endDate = new Date(job.end_date);
    
    // Calculate position and width
    const totalDays = this.getDaysInRange().length;
    const rangeStart = this.startDate.getTime();
    const rangeEnd = this.endDate.getTime();
    const rangeSpan = rangeEnd - rangeStart;
    
    // Clamp dates to visible range
    const barStart = Math.max(startDate.getTime(), rangeStart);
    const barEnd = Math.min(endDate.getTime(), rangeEnd);
    
    if (barStart > rangeEnd || barEnd < rangeStart) {
      return null; // Job is outside visible range
    }
    
    const left = ((barStart - rangeStart) / rangeSpan) * 100;
    const width = ((barEnd - barStart) / rangeSpan) * 100;
    
    const bar = document.createElement('div');
    bar.className = `timeline-bar status-${job.status?.toLowerCase() || 'quoted'}`;
    bar.style.left = `${left}%`;
    bar.style.width = `${width}%`;
    bar.dataset.jobId = job.id;
    bar.draggable = true;
    
    // Add progress indicator if in progress
    if (job.status === 'IN_PROGRESS' && job.progress) {
      const progress = document.createElement('div');
      progress.className = 'timeline-progress';
      progress.style.width = `${job.progress}%`;
      bar.appendChild(progress);
    }
    
    // Add label
    const label = document.createElement('div');
    label.className = 'timeline-bar-label';
    label.textContent = job.title;
    bar.appendChild(label);
    
    // Add resize handles
    bar.innerHTML += `
      <div class="resize-handle resize-left" data-job="${job.id}" data-resize="start"></div>
      <div class="resize-handle resize-right" data-job="${job.id}" data-resize="end"></div>
    `;
    
    return bar;
  }

  positionTodayLine() {
    const todayLine = document.getElementById('todayLine');
    if (!todayLine) return;
    
    const today = new Date();
    const rangeStart = this.startDate.getTime();
    const rangeEnd = this.endDate.getTime();
    
    if (today >= this.startDate && today <= this.endDate) {
      const position = ((today.getTime() - rangeStart) / (rangeEnd - rangeStart)) * 100;
      todayLine.style.left = `${position}%`;
      todayLine.style.display = 'block';
    } else {
      todayLine.style.display = 'none';
    }
  }

  attachEventListeners() {
    // View mode switcher
    document.querySelectorAll('.view-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        this.viewMode = e.target.dataset.view;
        this.calculateDateRange();
        this.render();
        this.loadData();
      });
    });
    
    // Navigation
    const prevBtn = document.getElementById('ganttPrev');
    const nextBtn = document.getElementById('ganttNext');
    const todayBtn = document.getElementById('ganttToday');
    
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.navigate(-1));
    }
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.navigate(1));
    }
    if (todayBtn) {
      todayBtn.addEventListener('click', () => this.navigateToToday());
    }
    
    // Filters
    const statusFilter = document.getElementById('ganttStatusFilter');
    const workerFilter = document.getElementById('ganttWorkerFilter');
    
    if (statusFilter) {
      statusFilter.addEventListener('change', () => this.renderTimeline());
    }
    if (workerFilter) {
      workerFilter.addEventListener('change', () => this.renderTimeline());
    }
    
    // Drag and drop
    this.setupDragAndDrop();
  }

  setupDragAndDrop() {
    // This will be implemented to allow dragging jobs to reschedule
    document.addEventListener('dragstart', (e) => {
      if (e.target.classList.contains('timeline-bar')) {
        this.isDragging = true;
        this.draggedJob = e.target.dataset.jobId;
        e.dataTransfer.effectAllowed = 'move';
      }
    });
    
    document.addEventListener('dragend', () => {
      this.isDragging = false;
      this.draggedJob = null;
    });
  }

  navigate(direction) {
    switch(this.viewMode) {
      case 'week':
        this.startDate.setDate(this.startDate.getDate() + (7 * direction));
        this.endDate.setDate(this.endDate.getDate() + (7 * direction));
        break;
      case 'month':
        this.startDate.setMonth(this.startDate.getMonth() + direction);
        this.endDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth() + 1, 0);
        break;
      case 'quarter':
        this.startDate.setMonth(this.startDate.getMonth() + (3 * direction));
        this.endDate = new Date(this.startDate.getFullYear(), this.startDate.getMonth() + 3, 0);
        break;
    }
    this.render();
    this.loadData();
  }

  navigateToToday() {
    this.currentDate = new Date();
    this.calculateDateRange();
    this.render();
    this.loadData();
  }

  // Helper methods
  getDaysInRange() {
    const days = [];
    const current = new Date(this.startDate);
    
    while (current <= this.endDate) {
      days.push(new Date(current));
      current.setDate(current.getDate() + 1);
    }
    
    return days;
  }

  formatDateRange() {
    const options = { month: 'short', day: 'numeric', year: 'numeric' };
    return `${this.startDate.toLocaleDateString('en-US', options)} - ${this.endDate.toLocaleDateString('en-US', options)}`;
  }

  getMonthShort(month) {
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return months[month];
  }

  getJobWorkers(jobId) {
    // This would be populated from actual job-worker assignments
    // For now, return empty array
    return [];
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  getStatusColor(status) {
    const colors = {
      'QUOTED': '#6B7280',
      'APPROVED': '#3B82F6',
      'IN_PROGRESS': '#F59E0B',
      'COMPLETED': '#10B981',
      'CANCELLED': '#EF4444'
    };
    return colors[status] || '#6B7280';
  }

  addStyles() {
    if (document.getElementById('gantt-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'gantt-styles';
    styles.textContent = `
      .gantt-container {
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      }
      
      .gantt-header {
        padding: 16px;
        border-bottom: 1px solid #E5E7EB;
        background: #F9FAFB;
      }
      
      .gantt-controls {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 20px;
      }
      
      .view-switcher {
        display: flex;
        gap: 4px;
        background: white;
        padding: 2px;
        border-radius: 6px;
        border: 1px solid #E5E7EB;
      }
      
      .view-btn {
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: #6B7280;
        font-size: 14px;
        border-radius: 4px;
        cursor: pointer;
        transition: all 0.2s;
      }
      
      .view-btn:hover {
        background: #F3F4F6;
      }
      
      .view-btn.active {
        background: #3B82F6;
        color: white;
      }
      
      .date-navigation {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      
      .date-range {
        font-weight: 600;
        color: #111827;
        min-width: 200px;
        text-align: center;
      }
      
      .gantt-filters {
        display: flex;
        gap: 8px;
      }
      
      .filter-select {
        padding: 6px 12px;
        border: 1px solid #D1D5DB;
        border-radius: 6px;
        font-size: 14px;
        background: white;
      }
      
      .gantt-wrapper {
        display: flex;
        height: 500px;
        position: relative;
      }
      
      .gantt-sidebar {
        width: 400px;
        border-right: 1px solid #E5E7EB;
        overflow-y: auto;
      }
      
      .gantt-sidebar-header {
        display: flex;
        background: #F9FAFB;
        border-bottom: 2px solid #E5E7EB;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .column-header {
        padding: 12px;
        font-weight: 600;
        font-size: 12px;
        text-transform: uppercase;
        color: #6B7280;
      }
      
      .column-header:first-child {
        flex: 1;
      }
      
      .column-header:nth-child(2) {
        width: 100px;
      }
      
      .column-header:nth-child(3) {
        width: 100px;
      }
      
      .gantt-row {
        display: flex;
        border-bottom: 1px solid #F3F4F6;
        min-height: 50px;
        align-items: center;
      }
      
      .gantt-row:hover {
        background: #F9FAFB;
      }
      
      .gantt-cell {
        padding: 8px 12px;
      }
      
      .gantt-cell:first-child {
        flex: 1;
      }
      
      .gantt-cell:nth-child(2) {
        width: 100px;
      }
      
      .gantt-cell:nth-child(3) {
        width: 100px;
      }
      
      .job-info {
        cursor: pointer;
      }
      
      .job-title {
        font-weight: 500;
        color: #111827;
        font-size: 14px;
      }
      
      .job-customer {
        font-size: 12px;
        color: #6B7280;
        margin-top: 2px;
      }
      
      .status-badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 4px;
        font-size: 11px;
        font-weight: 500;
        text-transform: uppercase;
      }
      
      .status-quoted { background: #F3F4F6; color: #374151; }
      .status-approved { background: #DBEAFE; color: #1D4ED8; }
      .status-in_progress { background: #FEF3C7; color: #92400E; }
      .status-completed { background: #D1FAE5; color: #065F46; }
      
      .worker-badges {
        display: flex;
        gap: 4px;
      }
      
      .worker-badge {
        display: inline-flex;
        width: 24px;
        height: 24px;
        align-items: center;
        justify-content: center;
        background: #3B82F6;
        color: white;
        border-radius: 50%;
        font-size: 10px;
        font-weight: 600;
      }
      
      .gantt-timeline {
        flex: 1;
        position: relative;
        overflow-x: auto;
        overflow-y: hidden;
      }
      
      .gantt-timeline-header {
        display: flex;
        background: #F9FAFB;
        border-bottom: 2px solid #E5E7EB;
        height: 44px;
        position: sticky;
        top: 0;
        z-index: 10;
      }
      
      .timeline-header-cell {
        border-right: 1px solid #E5E7EB;
        text-align: center;
        padding: 8px 4px;
        font-size: 11px;
      }
      
      .timeline-day {
        font-weight: 600;
        color: #111827;
      }
      
      .timeline-month {
        color: #6B7280;
        font-size: 10px;
      }
      
      .gantt-timeline-body {
        position: relative;
      }
      
      .timeline-row {
        height: 50px;
        border-bottom: 1px solid #F3F4F6;
        position: relative;
      }
      
      .timeline-bar {
        position: absolute;
        height: 32px;
        top: 9px;
        border-radius: 4px;
        cursor: move;
        transition: transform 0.2s, box-shadow 0.2s;
        display: flex;
        align-items: center;
        padding: 0 8px;
        overflow: hidden;
      }
      
      .timeline-bar:hover {
        transform: translateY(-1px);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
        z-index: 100;
      }
      
      .timeline-bar.status-quoted { background: #6B7280; }
      .timeline-bar.status-approved { background: #3B82F6; }
      .timeline-bar.status-in_progress { background: #F59E0B; }
      .timeline-bar.status-completed { background: #10B981; }
      
      .timeline-bar-label {
        color: white;
        font-size: 12px;
        font-weight: 500;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      
      .timeline-progress {
        position: absolute;
        left: 0;
        top: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.3);
        border-radius: 4px 0 0 4px;
      }
      
      .resize-handle {
        position: absolute;
        width: 8px;
        height: 100%;
        top: 0;
        cursor: ew-resize;
        opacity: 0;
        transition: opacity 0.2s;
      }
      
      .timeline-bar:hover .resize-handle {
        opacity: 1;
      }
      
      .resize-left {
        left: 0;
        background: linear-gradient(to right, rgba(0,0,0,0.2), transparent);
      }
      
      .resize-right {
        right: 0;
        background: linear-gradient(to left, rgba(0,0,0,0.2), transparent);
      }
      
      .gantt-today-line {
        position: absolute;
        top: 0;
        bottom: 0;
        width: 2px;
        background: #EF4444;
        pointer-events: none;
        z-index: 50;
      }
      
      .gantt-today-line::before {
        content: 'Today';
        position: absolute;
        top: -20px;
        left: -20px;
        background: #EF4444;
        color: white;
        padding: 2px 6px;
        border-radius: 3px;
        font-size: 10px;
        font-weight: 600;
      }
      
      .gantt-legend {
        padding: 12px 16px;
        background: #F9FAFB;
        border-top: 1px solid #E5E7EB;
        display: flex;
        gap: 20px;
        justify-content: center;
      }
      
      .legend-item {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #6B7280;
      }
      
      .legend-color {
        width: 16px;
        height: 16px;
        border-radius: 3px;
      }
      
      @media (max-width: 768px) {
        .gantt-sidebar {
          width: 300px;
        }
        
        .gantt-controls {
          flex-direction: column;
          align-items: stretch;
        }
        
        .gantt-filters {
          flex-direction: column;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }
}

// Export for use
window.GanttChart = GanttChart;
console.log('📊 Gantt chart component loaded');