import { handleOptions, readJson, requireMethod, sendJson } from '../_lib/http.js';

export default async function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['POST'])) return;

  await readJson(req);

  sendJson(res, 200, {
    matches: [],
    message: 'No recommendations are available yet.',
  });
}
