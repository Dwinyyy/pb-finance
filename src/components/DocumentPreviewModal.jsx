import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, X } from 'lucide-react';
import * as docx from 'docx-preview';
import * as pdfjsLib from 'pdfjs-dist';
import JSZip from 'jszip';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

import { getDocumentBlob, getDocumentKind } from '../utils/documentPreview';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const preventPreviewInteraction = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const blobToArrayBuffer = (blob) => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => resolve(reader.result);
  reader.onerror = () => reject(new Error('Unable to read this DOCX document.'));
  reader.readAsArrayBuffer(blob);
});

const DOCX_IMAGE_MIME_TYPES = {
  bmp: 'image/bmp',
  gif: 'image/gif',
  jpeg: 'image/jpeg',
  jpg: 'image/jpeg',
  png: 'image/png',
  svg: 'image/svg+xml',
  webp: 'image/webp',
};

const getImageMimeFromPath = (path) => {
  const extension = String(path || '').toLowerCase().match(/\.([a-z0-9]+)(?:[?#].*)?$/)?.[1] || '';

  return DOCX_IMAGE_MIME_TYPES[extension] || '';
};

const normalizeZipPath = (path) => {
  const parts = [];

  String(path || '').replace(/\\/g, '/').split('/').forEach((part) => {
    if (!part || part === '.') return;
    if (part === '..') {
      parts.pop();
      return;
    }

    parts.push(part);
  });

  return parts.join('/');
};

const getPartPathFromRelationshipsPath = (path) => {
  const normalizedPath = normalizeZipPath(path);
  const match = normalizedPath.match(/^(.*)\/_rels\/([^/]+)\.rels$/);

  return match ? normalizeZipPath(`${match[1]}/${match[2]}`) : '';
};

const resolveRelationshipTarget = (partPath, target) => {
  const rawTarget = String(target || '').trim();

  if (!rawTarget || /^[a-z][a-z0-9+.-]*:/i.test(rawTarget)) return '';
  if (rawTarget.startsWith('/')) return normalizeZipPath(rawTarget.slice(1));

  const folder = partPath.includes('/') ? partPath.slice(0, partPath.lastIndexOf('/')) : '';

  return normalizeZipPath(`${folder}/${rawTarget}`);
};

const parseXml = (xml) => new DOMParser().parseFromString(xml, 'application/xml');

const getLocalAttribute = (element, localName) => {
  if (!element?.attributes) return '';

  for (const attribute of element.attributes) {
    if (attribute.localName === localName) return attribute.value;
  }

  return '';
};

const getRelationshipMap = async (zip, relsPath) => {
  const relsFile = zip.file(relsPath);

  if (!relsFile) return null;

  const partPath = getPartPathFromRelationshipsPath(relsPath);
  const relsXml = parseXml(await relsFile.async('text'));
  const relationships = [...relsXml.getElementsByTagName('Relationship')];
  const byId = new Map();

  relationships.forEach((relationship) => {
    const id = relationship.getAttribute('Id') || '';
    const target = relationship.getAttribute('Target') || '';
    const type = relationship.getAttribute('Type') || '';
    const targetMode = relationship.getAttribute('TargetMode') || '';
    const targetPath = resolveRelationshipTarget(partPath, target);

    if (!id || targetMode === 'External') return;
    if (!type.includes('/image') && !getImageMimeFromPath(targetPath)) return;

    byId.set(id, targetPath);
  });

  return { byId, partPath };
};

const getImageIdsInElement = (element) => {
  const ids = [];

  [...element.getElementsByTagName('*')].forEach((child) => {
    if (child.localName === 'blip') {
      const id = getLocalAttribute(child, 'embed') || getLocalAttribute(child, 'link');
      if (id) ids.push(id);
    }

    if (child.localName === 'imagedata') {
      const id = getLocalAttribute(child, 'id') || getLocalAttribute(child, 'href') || getLocalAttribute(child, 'relid');
      if (id) ids.push(id);
    }
  });

  return ids;
};

const getDocxPartSortValue = (path) => {
  if (path === 'word/document.xml') return 0;
  if (/^word\/header\d*\.xml$/i.test(path)) return 1;
  if (/^word\/footer\d*\.xml$/i.test(path)) return 2;
  if (/^word\/footnotes\.xml$/i.test(path)) return 3;
  if (/^word\/endnotes\.xml$/i.test(path)) return 4;

  return 5;
};

const extractDocxImages = async (arrayBuffer) => {
  const zip = await JSZip.loadAsync(arrayBuffer);
  const relsPaths = Object.keys(zip.files)
    .filter((path) => /^word\/_rels\/[^/]+\.xml\.rels$/i.test(path))
    .sort((left, right) => {
      const leftPart = getPartPathFromRelationshipsPath(left);
      const rightPart = getPartPathFromRelationshipsPath(right);
      const partSort = getDocxPartSortValue(leftPart) - getDocxPartSortValue(rightPart);

      return partSort || leftPart.localeCompare(rightPart);
    });
  const images = [];

  for (const relsPath of relsPaths) {
    const relationshipMap = await getRelationshipMap(zip, relsPath);
    const partPath = relationshipMap?.partPath;
    const partFile = partPath ? zip.file(partPath) : null;

    if (!relationshipMap?.byId.size || !partFile) continue;

    const partXml = parseXml(await partFile.async('text'));
    const paragraphs = [...partXml.getElementsByTagName('*')].filter((element) => element.localName === 'p');

    for (let paragraphIndex = 0; paragraphIndex < paragraphs.length; paragraphIndex += 1) {
      const ids = getImageIdsInElement(paragraphs[paragraphIndex]);

      for (const id of ids) {
        const targetPath = relationshipMap.byId.get(id);
        const imageFile = targetPath ? zip.file(targetPath) : null;
        const mimeType = getImageMimeFromPath(targetPath);

        if (!imageFile || !mimeType) continue;

        const bytes = await imageFile.async('uint8array');
        const url = URL.createObjectURL(new Blob([bytes], { type: mimeType }));

        images.push({
          id,
          paragraphIndex,
          partPath,
          targetPath,
          url,
        });
      }
    }
  }

  return images;
};

const setRenderedImageSource = (element, source) => {
  if (!source?.url) return;

  element.setAttribute('draggable', 'false');

  if (element.parentElement) {
    element.parentElement.style.display = element.parentElement.style.display || 'inline-block';
    element.parentElement.style.maxWidth = '100%';
    element.parentElement.style.overflow = 'visible';
    element.parentElement.style.visibility = 'visible';
  }

  if (element instanceof HTMLImageElement) {
    element.src = source.url;
    element.style.display = 'inline-block';
    element.style.maxWidth = '100%';
    element.style.opacity = '1';
    element.style.visibility = 'visible';
    return;
  }

  if (element instanceof SVGImageElement) {
    element.setAttribute('href', source.url);
    element.setAttributeNS('http://www.w3.org/1999/xlink', 'href', source.url);
    element.style.opacity = '1';
    element.style.visibility = 'visible';
  }
};

const injectFallbackImage = (paragraph, image) => {
  if (!paragraph || !image?.url) return;

  const wrapper = document.createElement('span');
  const imageElement = document.createElement('img');

  wrapper.className = 'docx-image-fallback-inline';
  imageElement.src = image.url;
  imageElement.draggable = false;
  imageElement.alt = '';
  wrapper.appendChild(imageElement);
  paragraph.appendChild(wrapper);
};

const repairDocxImages = async (container, images) => {
  if (!images.length) return;

  const renderedImages = [...container.querySelectorAll('img, svg image')];
  const consumedIndexes = new Set();

  renderedImages.forEach((element, index) => {
    const image = images[index];

    if (!image) return;

    setRenderedImageSource(element, image);
    consumedIndexes.add(index);
  });

  if (consumedIndexes.size < images.length) {
    const bodyParagraphs = [...container.querySelectorAll('p')];

    images.forEach((image, index) => {
      if (consumedIndexes.has(index) || image.partPath !== 'word/document.xml') return;

      injectFallbackImage(bodyParagraphs[image.paragraphIndex], image);
      consumedIndexes.add(index);
    });
  }

  await Promise.all([...container.querySelectorAll('img')].map((image) => (
    image.complete
      ? Promise.resolve()
      : new Promise((resolve) => {
        const timeout = window.setTimeout(resolve, 800);
        image.addEventListener('load', () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
        image.addEventListener('error', () => {
          window.clearTimeout(timeout);
          resolve();
        }, { once: true });
      })
  )));
};

const lockRenderedDocument = (container) => {
  container.querySelectorAll('a').forEach((link) => {
    link.removeAttribute('href');
    link.setAttribute('aria-disabled', 'true');
  });

  container.querySelectorAll('img, image, svg, canvas, video').forEach((media) => {
    media.setAttribute('draggable', 'false');
  });
};

function PdfCanvasPreview({ blob }) {
  const containerRef = useRef(null);
  const [state, setState] = useState({ error: '', isLoading: true });

  useEffect(() => {
    let isMounted = true;
    let loadingTask = null;

    const renderPdf = async () => {
      const container = containerRef.current;
      if (!container || !blob) return;

      container.innerHTML = '';
      setState({ error: '', isLoading: true });

      const data = new Uint8Array(await blob.arrayBuffer());
      loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (!isMounted) return;

        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, container.clientWidth - 40);
        const scale = Math.min(1.6, availableWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const pixelRatio = window.devicePixelRatio || 1;
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const pageShell = document.createElement('div');

        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        canvas.className = 'mx-auto rounded-lg bg-white shadow-sm';

        pageShell.className = 'mb-5';
        pageShell.appendChild(canvas);
        container.appendChild(pageShell);

        await page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise;
      }

      if (isMounted) {
        setState({ error: '', isLoading: false });
      }
    };

    renderPdf().catch((error) => {
      if (!isMounted) return;
      setState({ error: error.message || 'Unable to render this PDF.', isLoading: false });
    });

    return () => {
      isMounted = false;
      loadingTask?.destroy?.();
    };
  }, [blob]);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-slate-200 px-4 py-5 dark:bg-slate-900">
      {state.isLoading && (
        <div className="sticky top-0 z-10 mx-auto mb-4 flex w-fit items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <Loader2 size={16} className="animate-spin" />
          Rendering PDF
        </div>
      )}
      {state.error && (
        <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-semibold text-red-700">
          {state.error}
        </div>
      )}
      <div ref={containerRef} className="mx-auto max-w-5xl" />
    </div>
  );
}

function DocxRenderedPreview({ blob }) {
  const containerRef = useRef(null);
  const [state, setState] = useState({ error: '', isLoading: true });

  useEffect(() => {
    let isMounted = true;
    let extractedImages = [];

    const renderDocument = async () => {
      const container = containerRef.current;
      if (!container || !blob) return;

      container.innerHTML = '';
      setState({ error: '', isLoading: true });

      const arrayBuffer = await blobToArrayBuffer(blob);
      if (!isMounted) return;

      extractedImages = await extractDocxImages(arrayBuffer);
      if (!isMounted) return;

      await docx.renderAsync(arrayBuffer, container, null, {
        breakPages: true,
        className: 'docx',
        experimental: true,
        ignoreFonts: false,
        ignoreHeight: false,
        ignoreLastRenderedPageBreak: true,
        ignoreWidth: false,
        inWrapper: true,
        renderAltChunks: true,
        renderChanges: false,
        renderComments: false,
        renderEndnotes: true,
        renderFooters: true,
        renderFootnotes: true,
        renderHeaders: true,
        trimXmlDeclaration: true,
        useBase64URL: false,
      });

      await repairDocxImages(container, extractedImages);
      lockRenderedDocument(container);

      if (isMounted) {
        setState({ error: '', isLoading: false });
      }
    };

    renderDocument().catch((error) => {
      if (!isMounted) return;
      setState({ error: error.message || 'Unable to render this DOCX document.', isLoading: false });
    });

    return () => {
      isMounted = false;
      extractedImages.forEach((image) => URL.revokeObjectURL(image.url));
    };
  }, [blob]);

  return (
    <div className="relative h-full w-full bg-slate-200 dark:bg-slate-900">
      {state.isLoading && (
        <div className="absolute left-1/2 top-4 z-10 flex -translate-x-1/2 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
          <Loader2 size={16} className="animate-spin" />
          Rendering document
        </div>
      )}
      {state.error && (
        <div className="absolute left-1/2 top-4 z-10 mx-auto w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-semibold text-red-700">
          {state.error}
        </div>
      )}
      <div
        id="preview-container"
        ref={containerRef}
        className="document-preview-locked document-preview-docx h-full w-full overflow-y-auto px-4 py-5"
      />
    </div>
  );
}

export function DocumentPreviewModal({ previewDocument, onClose }) {
  const [preview, setPreview] = useState({
    blob: null,
    dataUrl: '',
    error: '',
    isLoading: true,
    kind: '',
  });

  useEffect(() => {
    let isMounted = true;
    let imageObjectUrl = '';

    const loadPreview = async () => {
      const blob = previewDocument.blob
        || await getDocumentBlob({ contentType: previewDocument.contentType, url: previewDocument.url });
      const kind = getDocumentKind(blob.type || previewDocument.contentType, previewDocument.fileName);

      if (kind === 'image') {
        imageObjectUrl = URL.createObjectURL(blob);
      }

      return {
        blob,
        dataUrl: imageObjectUrl,
        kind,
      };
    };

    loadPreview()
      .then((result) => {
        if (!isMounted) return;

        setPreview({
          blob: result.blob,
          dataUrl: result.dataUrl,
          error: '',
          isLoading: false,
          kind: result.kind,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setPreview({
          blob: null,
          dataUrl: '',
          error: error.message || 'Unable to load this document.',
          isLoading: false,
          kind: '',
        });
      });

    return () => {
      isMounted = false;
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [previewDocument]);

  const title = previewDocument.fileName || 'Document preview';

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/70 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onCopy={preventPreviewInteraction}
      onCut={preventPreviewInteraction}
      onDragStart={preventPreviewInteraction}
      onPaste={preventPreviewInteraction}
      onSelectStart={preventPreviewInteraction}
    >
      <style>
        {`
          .document-preview-locked,
          .document-preview-locked * {
            -webkit-touch-callout: none !important;
            -webkit-user-drag: none !important;
            -webkit-user-select: none !important;
            user-select: none !important;
          }

          .document-preview-locked a {
            color: inherit !important;
            cursor: default !important;
            pointer-events: none !important;
            text-decoration: none !important;
          }

          .document-preview-docx {
            color: #0f172a;
            line-height: 1.5;
          }

          #preview-container .docx-wrapper {
            background: transparent !important;
            padding: 0 !important;
          }

          #preview-container .docx-wrapper > section,
          #preview-container section.docx {
            background: #ffffff !important;
            box-shadow: 0 1px 3px rgba(15, 23, 42, 0.14) !important;
            margin: 0 auto 20px !important;
            max-width: min(100%, 816px) !important;
            overflow: visible !important;
          }

          #preview-container img,
          #preview-container .docx img,
          #preview-container .docx-image-fallback-inline img {
            display: inline-block !important;
            height: auto !important;
            max-height: 70vh !important;
            max-width: 100% !important;
            object-fit: contain !important;
            opacity: 1 !important;
            visibility: visible !important;
          }

          #preview-container .docx-image-fallback-inline {
            display: inline-block !important;
            max-width: 100% !important;
            vertical-align: baseline !important;
          }

          #preview-container .docx p span:has(img),
          #preview-container .docx p div:has(img) {
            display: inline-block !important;
            max-width: 100% !important;
            overflow: visible !important;
            visibility: visible !important;
          }

          #preview-container svg,
          #preview-container svg image {
            opacity: 1 !important;
            overflow: visible !important;
            visibility: visible !important;
          }

          #preview-container table {
            max-width: 100% !important;
            width: auto !important;
          }
        `}
      </style>
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center justify-between gap-4 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-slate-950 dark:text-white">{title}</div>
            <div className="text-xs font-semibold text-slate-400">Read-only preview</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:text-white"
            title="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="document-preview-locked flex min-h-0 flex-1 items-center justify-center bg-slate-100 dark:bg-slate-900">
          {preview.isLoading ? (
            <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <Loader2 size={16} className="animate-spin" />
              Loading preview
            </div>
          ) : preview.error ? (
            <div className="mx-4 max-w-md rounded-2xl border border-red-200 bg-red-50 px-5 py-4 text-center text-sm font-semibold text-red-700">
              {preview.error}
            </div>
          ) : preview.kind === 'pdf' ? (
            <PdfCanvasPreview blob={preview.blob} />
          ) : preview.kind === 'image' ? (
            <img
              src={preview.dataUrl}
              alt={title}
              draggable={false}
              className="max-h-full max-w-full select-none object-contain"
            />
          ) : preview.kind === 'docx' ? (
            <DocxRenderedPreview blob={preview.blob} />
          ) : (
            <div className="mx-4 max-w-md rounded-2xl border border-slate-200 bg-white px-5 py-5 text-center text-sm font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
              <FileText className="mx-auto mb-3 text-slate-400" size={28} />
              This document format cannot be rendered in the browser preview.
            </div>
          )}
        </div>
      </div>
    </div>,
    window.document.body
  );
}
