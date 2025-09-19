/**
 * EXIF Helper for Photo Orientation
 * Fixes sideways photos taken on phones
 */

class ExifHelper {
  /**
   * Get orientation from EXIF data
   * @param {File} file - Image file
   * @returns {Promise<number>} Orientation value (1-8)
   */
  static async getOrientation(file) {
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const view = new DataView(e.target.result);
        
        if (view.getUint16(0, false) != 0xFFD8) {
          // Not a JPEG
          resolve(1);
          return;
        }
        
        const length = view.byteLength;
        let offset = 2;
        
        while (offset < length) {
          const marker = view.getUint16(offset, false);
          offset += 2;
          
          if (marker == 0xFFE1) {
            // Found EXIF marker
            if (view.getUint32(offset += 2, false) != 0x45786966) {
              // Not valid EXIF
              resolve(1);
              return;
            }
            
            const little = view.getUint16(offset += 6, false) == 0x4949;
            offset += view.getUint32(offset + 4, little);
            const tags = view.getUint16(offset, little);
            offset += 2;
            
            for (let i = 0; i < tags; i++) {
              if (view.getUint16(offset + (i * 12), little) == 0x0112) {
                // Found orientation tag
                resolve(view.getUint16(offset + (i * 12) + 8, little));
                return;
              }
            }
          } else if ((marker & 0xFF00) != 0xFF00) {
            break;
          } else {
            offset += view.getUint16(offset, false);
          }
        }
        
        // No orientation found
        resolve(1);
      };
      
      reader.onerror = () => resolve(1);
      reader.readAsArrayBuffer(file.slice(0, 64 * 1024)); // Read first 64KB only
    });
  }

  /**
   * Apply orientation to canvas context
   * @param {CanvasRenderingContext2D} ctx - Canvas context
   * @param {number} orientation - EXIF orientation value
   * @param {number} width - Image width
   * @param {number} height - Image height
   */
  static applyOrientation(ctx, orientation, width, height) {
    switch (orientation) {
      case 2: // Flip horizontal
        ctx.scale(-1, 1);
        ctx.translate(-width, 0);
        break;
      case 3: // Rotate 180°
        ctx.rotate(Math.PI);
        ctx.translate(-width, -height);
        break;
      case 4: // Flip vertical
        ctx.scale(1, -1);
        ctx.translate(0, -height);
        break;
      case 5: // Flip vertical + rotate 90° CW
        ctx.rotate(Math.PI / 2);
        ctx.scale(1, -1);
        break;
      case 6: // Rotate 90° CW
        ctx.rotate(Math.PI / 2);
        ctx.translate(0, -height);
        break;
      case 7: // Flip horizontal + rotate 90° CW
        ctx.rotate(Math.PI / 2);
        ctx.translate(0, -height);
        ctx.scale(-1, 1);
        ctx.translate(-width, 0);
        break;
      case 8: // Rotate 90° CCW
        ctx.rotate(-Math.PI / 2);
        ctx.translate(-width, 0);
        break;
    }
  }

  /**
   * Should swap dimensions based on orientation
   * @param {number} orientation - EXIF orientation value
   * @returns {boolean} True if width/height should be swapped
   */
  static shouldSwapDimensions(orientation) {
    return orientation >= 5 && orientation <= 8;
  }
}

// Extend PhotoCompressor to handle orientation
if (window.PhotoCompressor) {
  const originalCompressImage = PhotoCompressor.prototype.compressImage;
  
  PhotoCompressor.prototype.compressImage = async function(file) {
    // Get orientation first
    const orientation = await ExifHelper.getOrientation(file);
    
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const img = new Image();
        
        img.onload = () => {
          try {
            // Process with orientation
            const compressed = this.processImageWithOrientation(img, this.maxWidth, this.maxHeight, this.quality, orientation);
            const thumbnail = this.processImageWithOrientation(img, this.thumbnailSize, this.thumbnailSize, 0.7, orientation);
            
            // Calculate compression stats
            const stats = {
              originalSize: file.size,
              compressedSize: compressed.size,
              thumbnailSize: thumbnail.size,
              reduction: Math.round((1 - compressed.size / file.size) * 100),
              originalDimensions: `${img.naturalWidth}x${img.naturalHeight}`,
              compressedDimensions: this.getNewDimensions(img.naturalWidth, img.naturalHeight, this.maxWidth, this.maxHeight),
              orientation: orientation
            };
            
            resolve({ compressed, thumbnail, stats });
          } catch (error) {
            reject(error);
          }
        };
        
        img.onerror = () => reject(new Error('Failed to load image'));
        img.src = e.target.result;
      };
      
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });
  };
  
  PhotoCompressor.prototype.processImageWithOrientation = function(img, maxWidth, maxHeight, quality, orientation) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    // Get original dimensions
    let width = img.naturalWidth;
    let height = img.naturalHeight;
    
    // Swap dimensions if needed
    if (ExifHelper.shouldSwapDimensions(orientation)) {
      [width, height] = [height, width];
    }
    
    // Calculate new dimensions
    const newDims = this.getNewDimensions(width, height, maxWidth, maxHeight);
    
    // Set canvas size
    canvas.width = newDims.width;
    canvas.height = newDims.height;
    
    // Apply white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Save context state
    ctx.save();
    
    // Apply orientation transformation
    if (ExifHelper.shouldSwapDimensions(orientation)) {
      ctx.translate(canvas.width / 2, canvas.height / 2);
      ExifHelper.applyOrientation(ctx, orientation, newDims.height, newDims.width);
      ctx.translate(-canvas.height / 2, -canvas.width / 2);
      ctx.drawImage(img, 0, 0, newDims.height, newDims.width);
    } else {
      ExifHelper.applyOrientation(ctx, orientation, newDims.width, newDims.height);
      ctx.drawImage(img, 0, 0, newDims.width, newDims.height);
    }
    
    // Restore context state
    ctx.restore();
    
    // Convert to blob
    return this.canvasToBlob(canvas, quality);
  };
}

window.ExifHelper = ExifHelper;
console.log('📐 EXIF orientation helper loaded');