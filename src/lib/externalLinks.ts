/**
 * EXTERNAL INTEGRATION HOOKS & LOOSE ENDS
 * 
 * ⚠️ ACTION REQUIRED BEFORE PRODUCTION / PUBLIC LAUNCH:
 * Replace the placeholder URLs and emails below with your actual accounts:
 * 
 * 1. donationUrl:
 *    Set to your personal or project Buy Me a Coffee / Ko-fi / Stripe / GitHub Sponsors link:
 *    e.g. 'https://buymeacoffee.com/username' or 'https://ko-fi.com/username'
 * 
 * 2. feedbackEmail:
 *    Set to the email inbox where bug reports and feature requests should be sent:
 *    e.g. 'suport@andana.cat' or your personal email.
 * 
 * 3. feedbackWebhookUrl (optional):
 *    If you use a backend webhook (Discord, Telegram, Slack, or Formspree) to receive
 *    feedback in real-time, paste the endpoint URL here. If empty or null, Andana falls
 *    back to opening the user's default email client via mailto: and copying the report.
 */

export const EXTERNAL_HOOKS = {
  // ── 1. Donation & Coffee Support ──
  // TODO: Link your actual payment/donation account here:
  donationUrl: 'https://ko-fi.com',

  // ── 2. Feedback, Bug Reports & Feature Requests ──
  // TODO: Link your email address to receive bug reports:
  feedbackEmail: 'feedback@andana.cat',

  // Optional: Webhook URL (Discord/Telegram/Formspree) for automated notifications
  feedbackWebhookUrl: '',

  // ── 3. Source Repository / GitHub Issues (optional) ──
  githubIssuesUrl: 'https://github.com',
}
