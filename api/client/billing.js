import { handleOptions, requireMethod, sendJson } from '../_lib/http.js';

export default function handler(req, res) {
  if (handleOptions(req, res) || !requireMethod(req, res, ['GET'])) return;

  sendJson(res, 200, {
    contracts: [],
    invoices: [],
    paymentMethods: [],
  });
}
