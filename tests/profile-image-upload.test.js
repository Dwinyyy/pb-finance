import assert from 'node:assert/strict';
import { Buffer } from 'node:buffer';
import test from 'node:test';

import {
  MAX_PROFILE_IMAGE_BYTES,
  parseProfileImageUpload,
} from '../server/profileImageUpload.js';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8, 0xff, 0xe0]);

const upload = ({ bytes = PNG_SIGNATURE, contentType = 'image/png', fileName = 'avatar.png' } = {}) => ({
  contentType,
  fileData: `data:${contentType};base64,${bytes.toString('base64')}`,
  fileName,
});

test('profile image parser accepts matching PNG and JPEG uploads', () => {
  const png = parseProfileImageUpload(upload());
  assert.equal(png.contentType, 'image/png');
  assert.equal(png.fileName, 'avatar.png');
  assert.equal(png.fileSize, PNG_SIGNATURE.length);
  assert.deepEqual(png.bytes, PNG_SIGNATURE);

  const jpeg = parseProfileImageUpload(upload({
    bytes: JPEG_SIGNATURE,
    contentType: 'image/jpeg',
    fileName: '../../My Avatar.JPG',
  }));
  assert.equal(jpeg.contentType, 'image/jpeg');
  assert.equal(jpeg.fileName, 'My-Avatar.jpg');
});

test('profile image parser rejects mismatched signature, MIME, and extension', () => {
  assert.throws(() => parseProfileImageUpload(upload({
    bytes: PNG_SIGNATURE,
    contentType: 'image/jpeg',
    fileName: 'avatar.jpg',
  })), /does not match/i);

  assert.throws(() => parseProfileImageUpload({
    contentType: 'image/jpeg',
    fileData: `data:image/png;base64,${PNG_SIGNATURE.toString('base64')}`,
    fileName: 'avatar.jpg',
  }), /does not match/i);

  assert.throws(() => parseProfileImageUpload(upload({ fileName: 'avatar.jpg' })), /extension does not match/i);
  assert.throws(() => parseProfileImageUpload(upload({ bytes: PNG_SIGNATURE.subarray(0, 4) })), /does not match/i);
});

test('profile image parser rejects malformed noncanonical and empty base64', () => {
  for (const fileData of [
    'data:image/png;base64,',
    'data:image/png;base64,%%%%',
    'data:image/png;base64,AAAA=',
    'data:image/png;base64,iVB ORw==',
    'data:image/gif;base64,R0lGODlh',
  ]) {
    assert.throws(() => parseProfileImageUpload({
      contentType: 'image/png',
      fileData,
      fileName: 'avatar.png',
    }), /valid base64|supported image|empty/i);
  }
});

test('profile image parser accepts exactly 3 MB and rejects one byte more', () => {
  const atLimit = Buffer.alloc(MAX_PROFILE_IMAGE_BYTES);
  PNG_SIGNATURE.copy(atLimit);
  const accepted = parseProfileImageUpload(upload({ bytes: atLimit }));
  assert.equal(accepted.fileSize, MAX_PROFILE_IMAGE_BYTES);

  const overLimit = Buffer.alloc(MAX_PROFILE_IMAGE_BYTES + 1);
  PNG_SIGNATURE.copy(overLimit);
  assert.throws(() => parseProfileImageUpload(upload({ bytes: overLimit })), /3 MB or smaller/i);
});

test('profile image parser sanitizes the basename while preserving a valid extension', () => {
  const longName = `${'a'.repeat(240)}🔥.png`;
  const parsed = parseProfileImageUpload(upload({ fileName: `../unsafe/${longName}` }));

  assert.ok(parsed.fileName.length <= 180);
  assert.match(parsed.fileName, /^[a-z0-9._-]+\.png$/i);
  assert.doesNotMatch(parsed.fileName, /[\\/]/);
});
