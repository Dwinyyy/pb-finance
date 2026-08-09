export const MAX_PROFILE_IMAGE_BYTES = 3 * 1024 * 1024;

const SERVER_PROFILE_PHOTO_NAME = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}-.+$/i;

const asRecord = (value) => (
  typeof value === 'object' && value !== null && !Array.isArray(value) ? value : {}
);

const detectContentType = (bytes) => {
  if (
    bytes.length >= 8
    && bytes[0] === 0x89
    && bytes[1] === 0x50
    && bytes[2] === 0x4e
    && bytes[3] === 0x47
    && bytes[4] === 0x0d
    && bytes[5] === 0x0a
    && bytes[6] === 0x1a
    && bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }

  return '';
};

const parseCanonicalDataUrl = (value) => {
  const match = String(value || '').match(
    /^data:(image\/(?:jpeg|png));base64,([A-Za-z0-9+/]+={0,2})$/,
  );

  if (!match || match[2].length % 4 !== 0) {
    throw new Error('A valid base64 JPG or PNG image is required.');
  }

  const bytes = Buffer.from(match[2], 'base64');
  if (!bytes.length) throw new Error('The profile image cannot be empty.');
  if (bytes.toString('base64') !== match[2]) {
    throw new Error('A valid canonical base64 image is required.');
  }

  return { bytes, dataUrlContentType: match[1] };
};

export const getOwnedProfilePhotoStoragePath = (value, {
  baseUrl,
  bucket,
  userId,
} = {}) => {
  try {
    const avatarUrl = new URL(String(value || ''));
    const storageUrl = new URL(String(baseUrl || ''));
    const cleanBucket = String(bucket || '').trim();
    const cleanUserId = String(userId || '').trim();

    if (!cleanBucket || !cleanUserId || avatarUrl.origin !== storageUrl.origin) return '';
    if (avatarUrl.search || avatarUrl.hash) return '';

    const storageBasePath = storageUrl.pathname.replace(/\/+$/, '');
    const objectPrefix = `${storageBasePath}/storage/v1/object/public/${encodeURIComponent(cleanBucket)}/`;
    if (!avatarUrl.pathname.startsWith(objectPrefix)) return '';

    const encodedSegments = avatarUrl.pathname.slice(objectPrefix.length).split('/');
    if (encodedSegments.length !== 3) return '';

    const segments = encodedSegments.map((segment) => decodeURIComponent(segment));
    const isCanonical = segments.every((segment, index) => (
      segment
      && !/[\\/]/.test(segment)
      && segment !== '.'
      && segment !== '..'
      && encodeURIComponent(segment) === encodedSegments[index]
    ));

    if (!isCanonical) return '';
    if (segments[0] !== cleanUserId || segments[1] !== 'profile') return '';
    if (!SERVER_PROFILE_PHOTO_NAME.test(segments[2])) return '';

    return segments.join('/');
  } catch {
    return '';
  }
};

const sanitizeFileName = (value, contentType) => {
  const basename = String(value || '').trim().split(/[\\/]/).at(-1) || '';
  const extension = basename.toLowerCase().match(/\.[a-z0-9]+$/)?.[0] || '';
  const allowedExtensions = contentType === 'image/jpeg'
    ? new Set(['.jpg', '.jpeg'])
    : new Set(['.png']);

  if (!allowedExtensions.has(extension)) {
    throw new Error('The file extension does not match the uploaded image.');
  }

  const rawStem = basename.slice(0, -extension.length);
  const stem = rawStem
    .replace(/[^a-z0-9._ -]/gi, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^\.+/, '')
    .replace(/[._-]+$/, '')
    .slice(0, 180 - extension.length) || 'profile-photo';

  return `${stem}${extension}`;
};

export const parseProfileImageUpload = (input) => {
  const body = asRecord(input);
  const { bytes, dataUrlContentType } = parseCanonicalDataUrl(body.fileData || body.dataUrl);

  if (bytes.length > MAX_PROFILE_IMAGE_BYTES) {
    throw new Error('Profile image must be 3 MB or smaller.');
  }

  const declaredContentType = String(body.contentType || '').trim().toLowerCase();
  if (!['image/jpeg', 'image/png'].includes(declaredContentType)) {
    throw new Error('A supported image content type is required.');
  }

  const detectedContentType = detectContentType(bytes);
  if (
    !detectedContentType
    || detectedContentType !== declaredContentType
    || dataUrlContentType !== declaredContentType
  ) {
    throw new Error('The declared image type does not match the uploaded file.');
  }

  const fileName = sanitizeFileName(body.fileName || body.name, detectedContentType);

  return {
    bytes,
    contentType: detectedContentType,
    fileName,
    fileSize: bytes.length,
  };
};
