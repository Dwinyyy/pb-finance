export const getDocumentKind = (contentType, fileName) => {
  const type = String(contentType || '').toLowerCase();
  const name = String(fileName || '').toLowerCase();

  if (type.includes('pdf') || name.endsWith('.pdf')) return 'pdf';
  if (type.startsWith('image/') || /\.(jpe?g|png|gif|webp)$/i.test(name)) return 'image';

  return 'download';
};

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
