import { normalizeEmail, supabaseRestRequest } from './supabase.js';
import { sendPushNotifications } from './pushNotifications.js';

export const shouldSendNotificationEmail = (env = process.env) => (
  String(env.NOTIFICATION_EMAILS_DISABLED || '').trim().toLowerCase() !== 'true'
);

const getAppBaseUrl = () => {
  const url = process.env.PUBLIC_APP_URL || process.env.ALLOWED_ORIGIN || '';
  return url && url !== '*' ? url.replace(/\/$/, '') : '';
};

const escapeHtml = (value) => String(value || '')
  .replace(/&/g, '&amp;')
  .replace(/</g, '&lt;')
  .replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;')
  .replace(/'/g, '&#039;');

const notificationUrl = (actionUrl) => {
  if (!actionUrl) return '';
  if (/^https?:\/\//i.test(actionUrl)) return actionUrl;

  const baseUrl = getAppBaseUrl();
  return baseUrl ? `${baseUrl}${actionUrl.startsWith('/') ? actionUrl : `/${actionUrl}`}` : actionUrl;
};

const buildHtml = ({ actionUrl, body, title }) => {
  const link = notificationUrl(actionUrl);

  return [
    `<h2>${escapeHtml(title)}</h2>`,
    `<p>${escapeHtml(body)}</p>`,
    link ? `<p><a href="${escapeHtml(link)}">Open PB Finance</a></p>` : '',
  ].filter(Boolean).join('');
};

const sendEmail = async ({ actionUrl, body, subject, title, toEmail, toName }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = normalizeEmail(process.env.NOTIFICATION_FROM_EMAIL);
  const fromName = process.env.NOTIFICATION_FROM_NAME || 'PB Finance';
  const email = normalizeEmail(toEmail);

  if (!apiKey || !fromEmail || !email) {
    return { skipped: true };
  }

  if (!shouldSendNotificationEmail()) {
    return { skipped: true };
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      htmlContent: buildHtml({ actionUrl, body, title }),
      sender: {
        email: fromEmail,
        name: fromName,
      },
      subject: subject || title,
      textContent: [title, body, notificationUrl(actionUrl)].filter(Boolean).join('\n\n'),
      to: [
        {
          email,
          ...(toName ? { name: toName } : {}),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Brevo email request failed.');
  }

  return response.json();
};

export const sendRegistrationOtpEmail = async ({ email, name, otp }) => {
  const apiKey = process.env.BREVO_API_KEY;
  const fromEmail = normalizeEmail(process.env.NOTIFICATION_FROM_EMAIL);
  const fromName = process.env.NOTIFICATION_FROM_NAME || 'PB Finance';
  const recipientEmail = normalizeEmail(email);
  const safeOtp = String(otp || '').padStart(6, '0').slice(0, 6);

  if (!apiKey || !fromEmail || !recipientEmail) {
    throw new Error('Registration email delivery is not configured.');
  }

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'api-key': apiKey,
    },
    body: JSON.stringify({
      htmlContent: [
        '<h2>Verify your PB Finance account</h2>',
        `<p>Your verification code is <strong>${escapeHtml(safeOtp)}</strong>.</p>`,
        '<p>This code expires in 10 minutes. If you did not request it, you can ignore this email.</p>',
      ].join(''),
      sender: {
        email: fromEmail,
        name: fromName,
      },
      subject: 'Your PB Finance verification code',
      textContent: [
        'Verify your PB Finance account',
        `Your verification code is ${safeOtp}.`,
        'This code expires in 10 minutes.',
      ].join('\n\n'),
      to: [
        {
          email: recipientEmail,
          ...(name ? { name } : {}),
        },
      ],
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || 'Unable to send verification code.');
  }

  return response.json();
};

export const createNotification = async ({
  actionUrl = '/',
  body,
  metadata = {},
  recipientId,
  title,
  type,
}) => {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !recipientId) {
    return null;
  }

  const rows = await supabaseRestRequest('/notifications', {
    body: {
      action_url: actionUrl,
      body,
      metadata,
      recipient_id: recipientId,
      title,
      type,
    },
    method: 'POST',
    prefer: 'return=representation',
    useServiceRole: true,
  });

  return Array.isArray(rows) ? rows[0] : rows;
};

export const notifyUser = async ({
  actionUrl = '/',
  body,
  emailSubject,
  metadata,
  recipientEmail,
  recipientId,
  recipientName,
  title,
  type,
}) => {
  const result = {
    emailSent: false,
    notificationCreated: false,
    pushSent: 0,
  };

  try {
    const notification = await createNotification({
      actionUrl,
      body,
      metadata,
      recipientId,
      title,
      type,
    });
    result.notificationCreated = Boolean(notification);
  } catch (error) {
    result.notificationError = error.message;
  }

  try {
    const email = await sendEmail({
      actionUrl,
      body,
      subject: emailSubject,
      title,
      toEmail: recipientEmail,
      toName: recipientName,
    });
    result.emailSent = !email?.skipped;
  } catch (error) {
    result.emailError = error.message;
  }

  try {
    const push = await sendPushNotifications({
      actionUrl,
      body,
      recipientId,
      title,
      type,
    });
    result.pushSent = push.sent;
    result.pushRemoved = push.removed;
    result.pushErrors = push.errors;
  } catch (error) {
    result.pushError = error.message;
  }

  return result;
};

export const notifyAdmins = async ({
  actionUrl = '/',
  body,
  emailSubject,
  metadata,
  title,
  type,
}) => {
  const rows = process.env.SUPABASE_SERVICE_ROLE_KEY
    ? await supabaseRestRequest('/profiles?role=eq.admin&select=id,email,full_name', { useServiceRole: true })
    : [];
  const admins = Array.isArray(rows) ? rows : [];
  const results = [];

  for (const admin of admins) {
    results.push(await notifyUser({
      actionUrl,
      body,
      emailSubject,
      metadata,
      recipientEmail: admin.email,
      recipientId: admin.id,
      recipientName: admin.full_name,
      title,
      type,
    }));
  }

  const adminEmail = normalizeEmail(process.env.ADMIN_NOTIFICATION_EMAIL);

  if (adminEmail && !admins.some((admin) => normalizeEmail(admin.email) === adminEmail)) {
    results.push(await notifyUser({
      actionUrl,
      body,
      emailSubject,
      metadata,
      recipientEmail: adminEmail,
      title,
      type,
    }));
  }

  return results;
};
