import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, X } from 'lucide-react';

import { getDocumentBlob, getDocumentKind } from '../utils/documentPreview';
import { loadPdfJs } from '../utils/pdfPreview';

const preventPreviewInteraction = (event) => {
  event.preventDefault();
  event.stopPropagation();
};

const yieldToBrowser = () => new Promise((resolve) => {
  window.requestAnimationFrame(() => resolve());
});

const yieldToPreviewIdle = () => new Promise((resolve) => {
  if ('requestIdleCallback' in window) {
    window.requestIdleCallback(resolve, { timeout: 180 });
    return;
  }

  window.setTimeout(resolve, 16);
});

const resolvePreviewBlob = async (previewDocument) => {
  if (previewDocument.blob) {
    return {
      blob: previewDocument.blob,
      contentType: previewDocument.contentType,
      fileName: previewDocument.fileName,
    };
  }

  if (previewDocument.blobPromise) {
    const result = await previewDocument.blobPromise;

    return result?.blob
      ? result
      : {
        blob: result,
        contentType: previewDocument.contentType,
        fileName: previewDocument.fileName,
      };
  }

  if (previewDocument.blobLoader) {
    const result = await previewDocument.blobLoader();

    return result?.blob
      ? result
      : {
        blob: result,
        contentType: previewDocument.contentType,
        fileName: previewDocument.fileName,
      };
  }

  const blob = await getDocumentBlob({
    contentType: previewDocument.contentType,
    url: previewDocument.url,
  });

  return {
    blob,
    contentType: previewDocument.contentType,
    fileName: previewDocument.fileName,
  };
};

const resolvePreviewUrl = async (previewDocument) => {
  if (previewDocument.previewUrl) {
    return {
      contentType: previewDocument.contentType,
      fileName: previewDocument.fileName,
      url: previewDocument.previewUrl,
    };
  }

  if (previewDocument.urlPromise) {
    const result = await previewDocument.urlPromise;

    if (typeof result === 'string') {
      return {
        contentType: previewDocument.contentType,
        fileName: previewDocument.fileName,
        url: result,
      };
    }

    return result?.url ? result : null;
  }

  return previewDocument.url
    ? {
      contentType: previewDocument.contentType,
      fileName: previewDocument.fileName,
      url: previewDocument.url,
    }
    : null;
};

const canLoadBlobFallback = (previewDocument) => Boolean(
  previewDocument.blob
  || previewDocument.blobLoader
  || previewDocument.blobPromise
  || previewDocument.url
);

const getInitialPreviewState = (previewDocument) => ({
  blob: null,
  dataUrl: '',
  error: '',
  isLoading: true,
  kind: getDocumentKind(previewDocument.contentType, previewDocument.fileName),
  canFallback: false,
  pdfUrl: '',
  source: '',
});

function PdfCanvasPreview({ blob, onSourceError, sourceUrl }) {
  const containerRef = useRef(null);
  const [state, setState] = useState({ error: '', isLoading: true });

  useEffect(() => {
    let isMounted = true;
    let loadingTask = null;
    let pdfObjectUrl = '';

    const renderPdf = async () => {
      const container = containerRef.current;
      if (!container || (!blob && !sourceUrl)) return;

      container.innerHTML = '';
      setState({ error: '', isLoading: true });

      const pdfjsLib = await loadPdfJs();
      const pdfSource = sourceUrl
        ? { url: sourceUrl }
        : { url: (pdfObjectUrl = URL.createObjectURL(blob)) };
      loadingTask = pdfjsLib.getDocument(pdfSource);
      const pdf = await loadingTask.promise;

      for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
        if (!isMounted) return;

        if (pageNumber > 1) {
          await yieldToPreviewIdle();
        }

        const page = await pdf.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(320, container.clientWidth - 40);
        const scale = Math.min(1.6, availableWidth / baseViewport.width);
        const viewport = page.getViewport({ scale });
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        const pageShell = document.createElement('div');

        canvas.width = Math.ceil(viewport.width * pixelRatio);
        canvas.height = Math.ceil(viewport.height * pixelRatio);
        canvas.style.width = `${Math.ceil(viewport.width)}px`;
        canvas.style.height = `${Math.ceil(viewport.height)}px`;
        canvas.className = 'mx-auto rounded-lg bg-white shadow-card';

        pageShell.className = 'mb-5';
        pageShell.appendChild(canvas);
        container.appendChild(pageShell);

        await page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        }).promise;

        if (pageNumber === 1 && isMounted) {
          setState({ error: '', isLoading: false });
        }

        await yieldToBrowser();
      }

      if (isMounted) {
        setState({ error: '', isLoading: false });
      }
    };

    renderPdf().catch((error) => {
      if (!isMounted) return;
      if (sourceUrl && onSourceError) {
        onSourceError(error);
        return;
      }
      setState({ error: error.message || 'Unable to render this PDF.', isLoading: false });
    });

    return () => {
      isMounted = false;
      loadingTask?.destroy?.();
      if (pdfObjectUrl) URL.revokeObjectURL(pdfObjectUrl);
    };
  }, [blob, onSourceError, sourceUrl]);

  return (
    <div className="relative h-full w-full overflow-y-auto bg-surface-muted px-4 py-5">
      {state.isLoading && (
        <div className="sticky top-0 z-10 mx-auto mb-4 flex w-fit items-center gap-2 rounded-control border border-processing-border bg-processing-surface px-4 py-3 text-sm font-bold text-processing shadow-card">
          <Loader2 size={16} className="animate-spin" />
          Rendering PDF
        </div>
      )}
      {state.error && (
        <div className="mx-auto max-w-md rounded-control border border-danger-border bg-danger-surface px-5 py-4 text-center text-sm font-semibold text-danger">
          {state.error}
        </div>
      )}
      <div ref={containerRef} className="mx-auto max-w-5xl" />
    </div>
  );
}

export function DocumentPreviewModal({ previewDocument, onClose }) {
  const [preview, setPreview] = useState(() => getInitialPreviewState(previewDocument));
  const [imageFallbackKey, setImageFallbackKey] = useState('');
  const [pdfFallbackKey, setPdfFallbackKey] = useState('');

  useEffect(() => {
    let isMounted = true;
    let imageObjectUrl = '';
    const kindHint = getDocumentKind(previewDocument.contentType, previewDocument.fileName);

    const loadBlobPreview = async () => {
      const result = await resolvePreviewBlob(previewDocument);
      const blob = result.blob;
      const contentType = result.contentType || previewDocument.contentType;
      const fileName = result.fileName || previewDocument.fileName;
      const kind = getDocumentKind(blob.type || contentType, fileName);

      if (kind === 'image') {
        imageObjectUrl = URL.createObjectURL(blob);
      }

      return {
        blob,
        dataUrl: imageObjectUrl,
        kind,
        pdfUrl: '',
        source: 'blob',
      };
    };

    const loadPreview = async () => {
      if (kindHint === 'pdf') {
        loadPdfJs().catch(() => null);
        const fastPreview = await resolvePreviewUrl(previewDocument).catch(() => null);

        if (fastPreview?.url) {
          return {
            blob: null,
            canFallback: canLoadBlobFallback(previewDocument),
            dataUrl: '',
            kind: 'pdf',
            pdfUrl: fastPreview.url,
            source: 'url',
          };
        }

        return loadBlobPreview();
      }

      if (kindHint === 'image') {
        const fastPreview = await resolvePreviewUrl(previewDocument).catch(() => null);

        if (fastPreview?.url) {
          return {
            blob: null,
            canFallback: canLoadBlobFallback(previewDocument),
            dataUrl: fastPreview.url,
            kind: 'image',
            source: 'url',
          };
        }
      }

      return loadBlobPreview();
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
          canFallback: result.canFallback,
          pdfUrl: result.pdfUrl,
          source: result.source,
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setPreview({
          blob: null,
          dataUrl: '',
          error: error.message || 'Unable to load this document.',
          isLoading: false,
          kind: kindHint,
          pdfUrl: '',
          source: '',
        });
      });

    return () => {
      isMounted = false;
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [previewDocument]);

  useEffect(() => {
    if (!imageFallbackKey) return undefined;

    let isMounted = true;
    let imageObjectUrl = '';
    const currentKey = previewDocument.cacheKey || previewDocument.fileName || previewDocument.url || 'document-preview';

    if (imageFallbackKey !== currentKey) return undefined;

    resolvePreviewBlob(previewDocument)
      .then((result) => {
        if (!isMounted) return;

        const blob = result.blob;
        const contentType = result.contentType || previewDocument.contentType;
        const fileName = result.fileName || previewDocument.fileName;
        const kind = getDocumentKind(blob.type || contentType, fileName);

        if (kind !== 'image') {
          throw new Error('Unable to render this image.');
        }

        imageObjectUrl = URL.createObjectURL(blob);
        setPreview({
          blob,
          dataUrl: imageObjectUrl,
          error: '',
          isLoading: false,
          kind: 'image',
          source: 'blob',
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setPreview({
          blob: null,
          dataUrl: '',
          error: error.message || 'Unable to load this image.',
          isLoading: false,
          kind: 'image',
          source: '',
        });
      });

    return () => {
      isMounted = false;
      if (imageObjectUrl) URL.revokeObjectURL(imageObjectUrl);
    };
  }, [imageFallbackKey, previewDocument]);

  useEffect(() => {
    if (!pdfFallbackKey) return undefined;

    let isMounted = true;
    const currentKey = previewDocument.cacheKey || previewDocument.fileName || previewDocument.url || 'document-preview';

    if (pdfFallbackKey !== currentKey) return undefined;

    resolvePreviewBlob(previewDocument)
      .then((result) => {
        if (!isMounted) return;

        const blob = result.blob;
        const contentType = result.contentType || previewDocument.contentType;
        const fileName = result.fileName || previewDocument.fileName;
        const kind = getDocumentKind(blob.type || contentType, fileName);

        if (kind !== 'pdf') {
          throw new Error('Unable to render this PDF.');
        }

        setPreview({
          blob,
          dataUrl: '',
          error: '',
          isLoading: false,
          kind: 'pdf',
          pdfUrl: '',
          source: 'blob',
        });
      })
      .catch((error) => {
        if (!isMounted) return;
        setPreview({
          blob: null,
          dataUrl: '',
          error: error.message || 'Unable to load this PDF.',
          isLoading: false,
          kind: 'pdf',
          pdfUrl: '',
          source: '',
        });
      });

    return () => {
      isMounted = false;
    };
  }, [pdfFallbackKey, previewDocument]);

  const title = previewDocument.fileName || 'Document preview';
  const previewKey = previewDocument.cacheKey || previewDocument.fileName || previewDocument.url || 'document-preview';
  const retryImageWithBlob = () => {
    if (preview.source !== 'url' || !preview.canFallback) {
      setPreview((current) => ({
        ...current,
        dataUrl: '',
        error: 'Unable to load this image.',
        isLoading: false,
      }));
      return;
    }

    setImageFallbackKey(previewKey);
    setPreview((current) => ({
      ...current,
      error: '',
      isLoading: true,
    }));
  };
  const retryPdfWithBlob = (error) => {
    if (preview.source !== 'url' || !preview.canFallback) {
      setPreview((current) => ({
        ...current,
        error: error?.message || 'Unable to render this PDF.',
        isLoading: false,
        pdfUrl: '',
      }));
      return;
    }

    setPdfFallbackKey(previewKey);
    setPreview((current) => ({
      ...current,
      error: '',
      isLoading: true,
      pdfUrl: '',
    }));
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-pb-midnight/75 p-4 backdrop-blur-sm"
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
        `}
      </style>
      <div className="flex h-[88vh] w-full max-w-6xl flex-col overflow-hidden rounded-modal border border-border-subtle bg-surface text-text-primary shadow-modal">
        <div className="flex items-center justify-between gap-4 border-b border-border-subtle bg-surface px-4 py-3">
          <div className="min-w-0">
            <div className="truncate text-sm font-black text-text-primary">{title}</div>
            <div className="text-xs font-semibold text-text-muted">Read-only preview</div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-control border border-border-subtle text-text-muted transition-colors hover:border-border-control hover:bg-surface-muted hover:text-text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-focus/25"
            title="Close preview"
          >
            <X size={18} />
          </button>
        </div>

        <div className="document-preview-locked flex min-h-0 flex-1 items-center justify-center bg-surface-muted">
          {preview.isLoading ? (
            <div className="flex items-center gap-2 rounded-control border border-processing-border bg-processing-surface px-4 py-3 text-sm font-bold text-processing shadow-card">
              <Loader2 size={16} className="animate-spin" />
              Loading preview
            </div>
          ) : preview.error ? (
            <div className="mx-4 max-w-md rounded-control border border-danger-border bg-danger-surface px-5 py-4 text-center text-sm font-semibold text-danger">
              {preview.error}
            </div>
          ) : preview.kind === 'pdf' ? (
            <PdfCanvasPreview
              blob={preview.blob}
              onSourceError={retryPdfWithBlob}
              sourceUrl={preview.pdfUrl}
            />
          ) : preview.kind === 'image' ? (
            <img
              src={preview.dataUrl}
              alt={title}
              draggable={false}
              onError={retryImageWithBlob}
              className="max-h-full max-w-full select-none object-contain"
            />
          ) : (
            <div className="mx-4 max-w-md rounded-control border border-border-subtle bg-surface px-5 py-5 text-center text-sm font-semibold text-text-muted shadow-card">
              <FileText className="mx-auto mb-3 text-text-muted" size={28} />
              This document format cannot be rendered in the browser preview.
            </div>
          )}
        </div>
      </div>
    </div>,
    window.document.body
  );
}
