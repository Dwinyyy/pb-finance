import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FileText, Loader2, X } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

import { getDocumentBlob, getDocumentKind } from '../utils/documentPreview';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const preventPreviewInteraction = (event) => {
  event.preventDefault();
  event.stopPropagation();
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
