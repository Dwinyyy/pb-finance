import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { toneForDropzoneState } from '../src/components/ui/fileDropzoneState.js';

const source = readFileSync(new URL('../src/components/ui/FileDropzone.jsx', import.meta.url), 'utf8');
const projectRoot = fileURLToPath(new URL('..', import.meta.url));

test('drop-zone state priorities are deterministic', () => {
  assert.equal(toneForDropzoneState({ error: 'Bad file' }), 'danger');
  assert.equal(toneForDropzoneState({ isLocked: true }), 'trust');
  assert.equal(toneForDropzoneState({ isUploading: true }), 'processing');
  assert.equal(toneForDropzoneState({ isDragging: true }), 'processing');
  assert.equal(toneForDropzoneState({ hasFile: true, status: 'approved' }), 'verified');
  assert.equal(toneForDropzoneState({ disabled: true }), 'disabled');
  assert.equal(toneForDropzoneState({}), 'neutral');
});

test('drop zone supports input, keyboard, and drag paths', () => {
  assert.match(source, /type="file"/);
  assert.match(source, /onDrop/);
  assert.match(source, /onDragEnter/);
  assert.match(source, /onDragLeave/);
  assert.match(source, /onFile\(file\)/);
  assert.match(source, /aria-describedby/);
  assert.match(source, /Uploading securely/);
});

test('drop-zone state uses the required priority when conditions overlap', () => {
  assert.equal(toneForDropzoneState({ error: 'Bad file', isLocked: true, isUploading: true }), 'danger');
  assert.equal(toneForDropzoneState({ isLocked: true, isUploading: true, status: 'approved' }), 'trust');
  assert.equal(toneForDropzoneState({ disabled: true, hasFile: true }), 'verified');
  assert.equal(toneForDropzoneState({ disabled: true, status: 'pending_change' }), 'warning');
  assert.equal(toneForDropzoneState({ hasFile: true, status: 'rejected' }), 'danger');
});

test('drop zone server-renders labelled, described, and actionable file states', async () => {
  const vite = await createServer({
    root: projectRoot,
    appType: 'custom',
    logLevel: 'silent',
    server: { middlewareMode: true },
  });

  try {
    const { FileDropzone } = await vite.ssrLoadModule('/src/components/ui/FileDropzone.jsx');
    const rejected = renderToStaticMarkup(createElement(FileDropzone, {
      accept: 'image/jpeg,image/png',
      capture: 'user',
      error: 'Use a clearer photo.',
      fileMeta: '1.2 MB',
      fileName: 'portrait.png',
      helpText: 'JPG or PNG, up to 3 MB.',
      id: 'liveness-photo',
      label: 'Liveness selfie',
      onFile: () => {},
      onOpen: () => {},
      onRequestChange: () => {},
      status: 'rejected',
    }));

    assert.match(rejected, /<label[^>]*for="liveness-photo"/);
    assert.match(rejected, /<h2[^>]*id="liveness-photo-label"[^>]*>Liveness selfie</);
    assert.match(rejected, /type="file"/);
    assert.match(rejected, /id="liveness-photo"/);
    assert.match(rejected, /accept="image\/jpeg,image\/png"/);
    assert.match(rejected, /capture="user"/);
    assert.match(rejected, /aria-describedby="liveness-photo-description"/);
    assert.match(rejected, /aria-labelledby="liveness-photo-label liveness-photo-prompt"/);
    assert.match(rejected, /id="liveness-photo-prompt"/);
    assert.match(rejected, /role="alert"/);
    assert.match(rejected, />portrait\.png</);
    assert.match(rejected, />1\.2 MB</);
    assert.match(rejected, />Open</);
    assert.match(rejected, />Request change</);

    const busy = renderToStaticMarkup(createElement(FileDropzone, {
      helpText: 'PDF, JPG, or PNG, up to 3 MB.',
      id: 'valid-id',
      isBusy: true,
      label: 'Valid government ID',
      onFile: () => {},
    }));

    assert.match(busy, /disabled=""/);
    assert.match(busy, /aria-busy="true"/);
    assert.match(busy, /role="status"/);
    assert.match(busy, /aria-live="polite"/);
    assert.match(busy, /Uploading securely/);
    assert.doesNotMatch(busy, /\b\d{1,3}%\b/);
  } finally {
    await vite.close();
  }
});
