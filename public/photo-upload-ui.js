/**
 * Enhanced Photo Upload UI with Compression
 * Shows progress and file size reduction
 */

class PhotoUploadUI {
  constructor(container) {
    this.container = container;
    this.files = [];
    this.compressedFiles = [];
    this.init();
  }

  init() {
    // Create the upload UI
    this.container.innerHTML = `
      <div class="photo-upload-area">
        <div class="upload-dropzone" id="uploadDropzone">
          <svg class="upload-icon" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
            <polyline points="17 8 12 3 7 8"></polyline>
            <line x1="12" y1="3" x2="12" y2="15"></line>
          </svg>
          <p class="upload-text">Drop photos here or click to select</p>
          <p class="upload-hint">Photos will be automatically compressed</p>
          <input type="file" id="photoInput" multiple accept="image/*" style="display: none;">
        </div>
        
        <div class="compression-status" id="compressionStatus" style="display: none;">
          <h3>Compressing Photos...</h3>
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill"></div>
          </div>
          <div class="status-text" id="statusText"></div>
        </div>
        
        <div class="photo-preview-grid" id="photoPreviewGrid"></div>
      </div>
    `;

    this.setupEventListeners();
    this.addStyles();
  }

  setupEventListeners() {
    const dropzone = document.getElementById('uploadDropzone');
    const input = document.getElementById('photoInput');

    // Click to select files
    dropzone.addEventListener('click', () => input.click());

    // File input change
    input.addEventListener('change', (e) => {
      this.handleFiles(e.target.files);
    });

    // Drag and drop
    dropzone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragleave', () => {
      dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('dragover');
      this.handleFiles(e.dataTransfer.files);
    });
  }

  async handleFiles(fileList) {
    const files = Array.from(fileList);
    if (files.length === 0) return;

    // Show compression status
    document.getElementById('compressionStatus').style.display = 'block';
    
    // Compress files
    const results = await photoCompressor.compressMultiple(files, (progress) => {
      this.updateProgress(progress);
    });

    // Display results
    this.displayResults(results);
    
    // Hide compression status after a delay
    setTimeout(() => {
      document.getElementById('compressionStatus').style.display = 'none';
    }, 1000);
  }

  updateProgress(progress) {
    const progressFill = document.getElementById('progressFill');
    const statusText = document.getElementById('statusText');
    
    progressFill.style.width = `${progress.percent}%`;
    
    const originalSize = PhotoCompressor.formatBytes(progress.currentStats.originalSize);
    const compressedSize = PhotoCompressor.formatBytes(progress.currentStats.compressedSize);
    
    statusText.innerHTML = `
      Processing ${progress.current}/${progress.total}: ${progress.currentFile}<br>
      ${originalSize} → ${compressedSize} (${progress.currentStats.reduction}% smaller)
    `;
  }

  displayResults(results) {
    const grid = document.getElementById('photoPreviewGrid');
    
    results.forEach(result => {
      const preview = document.createElement('div');
      preview.className = 'photo-preview-item';
      
      // Create thumbnail URL
      const thumbUrl = URL.createObjectURL(result.thumbnail);
      const fullUrl = URL.createObjectURL(result.compressed);
      
      preview.innerHTML = `
        <img src="${thumbUrl}" alt="${result.originalFile.name}" onclick="window.open('${fullUrl}', '_blank')">
        <div class="photo-info">
          <div class="photo-name">${result.originalFile.name}</div>
          <div class="photo-stats">
            <span class="original-size">${PhotoCompressor.formatBytes(result.stats.originalSize)}</span>
            <span class="arrow">→</span>
            <span class="compressed-size">${PhotoCompressor.formatBytes(result.stats.compressedSize)}</span>
            <span class="reduction">${result.stats.reduction}% smaller</span>
          </div>
        </div>
        <button class="remove-photo" data-index="${results.indexOf(result)}">×</button>
      `;
      
      grid.appendChild(preview);
      
      // Store compressed file for upload
      this.compressedFiles.push({
        file: new File([result.compressed], result.originalFile.name, { type: 'image/jpeg' }),
        thumbnail: result.thumbnail,
        stats: result.stats
      });
    });

    // Add remove handlers
    grid.querySelectorAll('.remove-photo').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const index = parseInt(e.target.dataset.index);
        this.removePhoto(index);
      });
    });
  }

  removePhoto(index) {
    this.compressedFiles.splice(index, 1);
    const grid = document.getElementById('photoPreviewGrid');
    grid.children[index].remove();
    
    // Update indices
    grid.querySelectorAll('.remove-photo').forEach((btn, i) => {
      btn.dataset.index = i;
    });
  }

  getCompressedFiles() {
    return this.compressedFiles.map(item => item.file);
  }

  addStyles() {
    if (document.getElementById('photo-upload-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'photo-upload-styles';
    styles.textContent = `
      .photo-upload-area {
        padding: 20px;
      }
      
      .upload-dropzone {
        border: 2px dashed #D1D5DB;
        border-radius: 8px;
        padding: 40px;
        text-align: center;
        cursor: pointer;
        transition: all 0.3s;
        background: #F9FAFB;
      }
      
      .upload-dropzone:hover {
        border-color: #3B82F6;
        background: #EFF6FF;
      }
      
      .upload-dropzone.dragover {
        border-color: #3B82F6;
        background: #DBEAFE;
      }
      
      .upload-icon {
        color: #6B7280;
        margin-bottom: 16px;
      }
      
      .upload-text {
        font-size: 16px;
        font-weight: 500;
        color: #374151;
        margin: 0 0 8px;
      }
      
      .upload-hint {
        font-size: 14px;
        color: #6B7280;
        margin: 0;
      }
      
      .compression-status {
        margin: 20px 0;
        padding: 20px;
        background: white;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .compression-status h3 {
        margin: 0 0 12px;
        font-size: 16px;
        color: #111827;
      }
      
      .progress-bar {
        height: 8px;
        background: #E5E7EB;
        border-radius: 4px;
        overflow: hidden;
        margin-bottom: 12px;
      }
      
      .progress-fill {
        height: 100%;
        background: #3B82F6;
        transition: width 0.3s;
        width: 0;
      }
      
      .status-text {
        font-size: 14px;
        color: #6B7280;
      }
      
      .photo-preview-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 16px;
        margin-top: 20px;
      }
      
      .photo-preview-item {
        position: relative;
        background: white;
        border-radius: 8px;
        overflow: hidden;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }
      
      .photo-preview-item img {
        width: 100%;
        height: 150px;
        object-fit: cover;
        cursor: pointer;
      }
      
      .photo-info {
        padding: 12px;
      }
      
      .photo-name {
        font-size: 14px;
        font-weight: 500;
        color: #111827;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        margin-bottom: 8px;
      }
      
      .photo-stats {
        font-size: 12px;
        color: #6B7280;
        display: flex;
        align-items: center;
        gap: 4px;
      }
      
      .compressed-size {
        color: #10B981;
        font-weight: 600;
      }
      
      .reduction {
        margin-left: 8px;
        padding: 2px 6px;
        background: #D1FAE5;
        color: #065F46;
        border-radius: 4px;
        font-weight: 500;
      }
      
      .remove-photo {
        position: absolute;
        top: 8px;
        right: 8px;
        width: 24px;
        height: 24px;
        background: rgba(0, 0, 0, 0.5);
        color: white;
        border: none;
        border-radius: 50%;
        font-size: 18px;
        line-height: 1;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      
      .remove-photo:hover {
        background: rgba(239, 68, 68, 0.8);
      }
    `;
    
    document.head.appendChild(styles);
  }
}

// Export for use
window.PhotoUploadUI = PhotoUploadUI;
console.log('📤 Photo upload UI loaded');