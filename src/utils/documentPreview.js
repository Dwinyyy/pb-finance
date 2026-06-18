export const getDocumentKind = (contentType, fileName) => {
  const type = String(contentType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();

  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(name)) return 'image';

  return 'download';
};

const PREVIEW_CACHE_LIMIT = 30;
const previewBlobCache = new Map();
const previewUrlCache = new Map();

const trimPreviewCache = (cache) => {
  while (cache.size > PREVIEW_CACHE_LIMIT) {
    const oldestKey = cache.keys().next().value;
    cache.delete(oldestKey);
  }
};

export const getDocumentPreviewCacheKey = (...parts) => (
  parts
    .flatMap((part) => (Array.isArray(part) ? part : [part]))
    .map((part) => String(part || '').trim())
    .filter(Boolean)
    .join(':')
);

export const loadCachedDocumentPreview = (cacheKey, loader) => {
  if (!cacheKey || typeof loader !== 'function') {
    return Promise.resolve().then(loader);
  }

  if (previewBlobCache.has(cacheKey)) {
    return previewBlobCache.get(cacheKey);
  }

  const promise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      previewBlobCache.delete(cacheKey);
      throw error;
    });

  previewBlobCache.set(cacheKey, promise);
  trimPreviewCache(previewBlobCache);

  return promise;
};

export const preloadCachedDocumentPreview = (cacheKey, loader) => (
  loadCachedDocumentPreview(cacheKey, loader).catch(() => null)
);

export const loadCachedDocumentPreviewUrl = (cacheKey, loader) => {
  if (!cacheKey || typeof loader !== 'function') {
    return Promise.resolve().then(loader);
  }

  if (previewUrlCache.has(cacheKey)) {
    return previewUrlCache.get(cacheKey);
  }

  const promise = Promise.resolve()
    .then(loader)
    .catch((error) => {
      previewUrlCache.delete(cacheKey);
      throw error;
    });

  previewUrlCache.set(cacheKey, promise);
  trimPreviewCache(previewUrlCache);

  return promise;
};

export const preloadCachedDocumentPreviewUrl = (cacheKey, loader) => (
  loadCachedDocumentPreviewUrl(cacheKey, loader).catch(() => null)
);

const getBlob = async ({ contentType, url }) => {
  const response = await fetch(url);

  if (!response.ok) {
    throw new Error('Unable to load this document.');
  }

  const blob = await response.blob();

  return contentType && blob.type !== contentType
    ? blob.slice(0, blob.size, contentType)
    : blob;
};

export const getDocumentBlob = getBlob;

export const downloadDocumentUrl = async ({ contentType, fileName = 'document', url }) => {
  const blob = await getBlob({ contentType, url });
  const objectUrl = URL.createObjectURL(blob);
  const link = window.document.createElement('a');

  link.href = objectUrl;
  link.download = fileName;
  link.rel = 'noreferrer';
  window.document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
};
