/**
 * Compresses an image File or Blob directly in the browser using HTML5 Canvas
 * so it can be stored directly inside Cloud Firestore (100% free tier without credit card).
 * Target size: ~80KB - 220KB (well below Firestore's 1MB document limit).
 */
export async function compressReceiptImage(file, options = {}) {
  const maxDimension = options.maxDimension || 1100;
  const initialQuality = options.quality || 0.74;
  const maxBytes = options.maxBytes || 420 * 1024; // ~420 KB max

  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error('No se seleccionó ninguna imagen'));
      return;
    }

    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Error leyendo el archivo de imagen'));
    reader.onload = (event) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen no válido'));
      img.onload = () => {
        let { width, height } = img;

        if (width > maxDimension || height > maxDimension) {
          if (width >= height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        // Fill white background in case of transparent PNG screenshots
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        let quality = initialQuality;
        let dataUrl = canvas.toDataURL('image/jpeg', quality);

        // Step down quality if still too large for Firestore
        while (dataUrl.length > maxBytes && quality > 0.38) {
          quality -= 0.1;
          dataUrl = canvas.toDataURL('image/jpeg', quality);
        }

        const approxKb = Math.round((dataUrl.length * 0.75) / 1024);
        resolve({
          dataUrl,
          width,
          height,
          approxKb
        });
      };
      img.src = event.target.result;
    };

    reader.readAsDataURL(file);
  });
}
