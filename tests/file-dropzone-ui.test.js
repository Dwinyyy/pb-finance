import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { toneForDropzoneState } from '../src/components/ui/fileDropzoneState.js';

const source = readFileSync(new URL('../src/components/ui/FileDropzone.jsx', import.meta.url), 'utf8');
const professionalPage = readFileSync(new URL('../src/pages/ProfessionalPages.jsx', import.meta.url), 'utf8');
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

test('drag-depth transitions handle nesting, terminal events, and unavailable resets', async () => {
  const { nextDropzoneDragDepth } = await import('../src/components/ui/fileDropzoneState.js');
  assert.equal(typeof nextDropzoneDragDepth, 'function');

  const cases = [
    { name: 'first enter starts dragging', depth: 0, action: 'enter', expected: 1 },
    { name: 'nested enter increments depth', depth: 1, action: 'enter', expected: 2 },
    { name: 'nested leave keeps drag active', depth: 2, action: 'leave', expected: 1 },
    { name: 'final leave clears drag depth', depth: 1, action: 'leave', expected: 0 },
    { name: 'leave clamps at zero', depth: 0, action: 'leave', expected: 0 },
    { name: 'negative input clamps at zero', depth: -3, action: 'leave', expected: 0 },
    { name: 'drop always clears drag depth', depth: 3, action: 'drop', expected: 0 },
    { name: 'explicit reset clears drag depth', depth: 3, action: 'reset', expected: 0 },
    { name: 'becoming unavailable overrides enter', depth: 2, action: 'enter', isUnavailable: true, expected: 0 },
    { name: 'becoming unavailable overrides leave', depth: 2, action: 'leave', isUnavailable: true, expected: 0 },
  ];

  for (const { name, expected, ...input } of cases) {
    assert.equal(nextDropzoneDragDepth(input), expected, name);
  }
});

test('file selection permits only an available non-empty file', async () => {
  const { canSelectDropzoneFile } = await import('../src/components/ui/fileDropzoneState.js');
  assert.equal(typeof canSelectDropzoneFile, 'function');
  const file = { name: 'evidence.png' };

  assert.equal(canSelectDropzoneFile({ file }), true);
  assert.equal(canSelectDropzoneFile({}), false);
  assert.equal(canSelectDropzoneFile({ file, disabled: true }), false);
  assert.equal(canSelectDropzoneFile({ file, isLocked: true }), false);
  assert.equal(canSelectDropzoneFile({ file, isBusy: true }), false);
});

test('component consumes deterministic drag and selection state with a keyed availability reset', () => {
  assert.match(source, /nextDropzoneDragDepth/);
  assert.match(source, /canSelectDropzoneFile/);
  assert.match(source, /const availabilityKey = props\.disabled \|\| props\.isLocked \|\| props\.isBusy/);
  assert.match(source, /<FileDropzoneState key=\{availabilityKey\}/);
  assert.doesNotMatch(source, /useEffect/);
  assert.doesNotMatch(source, /const handleDragLeave[\s\S]{0,220}if \(isUnavailable\) return;/);
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

test('professional verification routes all identity and credential selections through FileDropzone file callbacks', () => {
  assert.match(professionalPage, /<FileDropzone[\s\S]*onFile=\{\(file\) => uploadIdentityFile\(row, file\)\}/);
  assert.match(professionalPage, /<FileDropzone[\s\S]*onFile=\{\(file\) => onUpload\(\{[\s\S]*file,[\s\S]*\}\)\}/);
  assert.match(professionalPage, /<FileDropzone[\s\S]*onFile=\{\(file\) => uploadOtherDocumentRow\(row, file\)\}/);
});
