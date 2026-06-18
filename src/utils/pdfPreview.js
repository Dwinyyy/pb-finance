import { getDocumentKind } from './documentPreview';

let pdfJsPromise = null;

export const loadPdfJs = async () => {
  if (!pdfJsPromise) {
    pdfJsPromise = Promise.all([
      import('pdfjs-dist'),
      import('pdfjs-dist/build/pdf.worker.mjs?url'),
    ]).then(([pdfjsLib, workerModule]) => {
      pdfjsLib.GlobalWorkerOptions.workerSrc = workerModule.default;
      return pdfjsLib;
    });
  }

  return pdfJsPromise;
};

export const warmDocumentPreviewRenderer = (contentType, fileName) => {
  if (getDocumentKind(contentType, fileName) !== 'pdf') return;

  loadPdfJs().catch(() => null);
};
