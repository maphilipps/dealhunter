// ═══════════════════════════════════════════════════════════════════════════════
// SCAN COMPLETE EMAIL - Qualification Scan notification
// Sends notification to BL Leader when scan completes
// ═══════════════════════════════════════════════════════════════════════════════

import { sendEmail } from '@/lib/notifications/email';

export interface ScanCompleteEmailInput {
  recipientEmail: string;
  recipientName: string;
  customerName: string;
  websiteUrl: string;
  qualificationId: string;
  topFindings: string[];
  scanStatus: 'completed' | 'failed';
}

/**
 * Send scan-complete notification email to BL leader.
 */
export async function sendScanCompleteEmail(
  input: ScanCompleteEmailInput
): Promise<{ success: boolean; error?: string }> {
  const {
    recipientEmail,
    recipientName,
    customerName,
    websiteUrl,
    qualificationId,
    topFindings,
    scanStatus,
  } = input;

  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
  const resultUrl = `${appUrl}/qualifications/${qualificationId}`;

  const statusLabel = scanStatus === 'completed' ? 'abgeschlossen' : 'fehlgeschlagen';
  const statusColor = scanStatus === 'completed' ? '#10b981' : '#ef4444';
  const statusIcon = scanStatus === 'completed' ? '✅' : '❌';

  const findingsHtml =
    topFindings.length > 0
      ? `
    <div style="background: #f9fafb; padding: 15px; margin: 20px 0; border-radius: 6px;">
      <h3 style="margin: 0 0 10px 0; font-size: 14px; color: #374151; text-transform: uppercase; letter-spacing: 0.05em;">Top Findings</h3>
      <ul style="margin: 0; padding-left: 20px; color: #4b5563;">
        ${topFindings.map(f => `<li style="margin-bottom: 6px;">${f}</li>`).join('')}
      </ul>
    </div>`
      : '';

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Qualification Scan ${statusLabel}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, ${statusColor} 0%, ${scanStatus === 'completed' ? '#059669' : '#dc2626'} 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">${statusIcon} Qualification Scan ${statusLabel}</h1>
  </div>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">

    <p style="margin-top: 0;">Hallo ${recipientName},</p>

    <p>Der Qualification Scan für <strong>${customerName}</strong> wurde ${statusLabel}.</p>

    <div style="background: #f0fdf4; border-left: 4px solid ${statusColor}; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <p style="margin: 0 0 5px 0; font-weight: 500;">Website: ${websiteUrl}</p>
      <p style="margin: 0; color: #6b7280;">Status: ${statusLabel}</p>
    </div>

    ${findingsHtml}

    <div style="margin: 30px 0;">
      <a href="${resultUrl}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
        Ergebnisse ansehen
      </a>
    </div>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px;">
      Diese Nachricht wurde automatisch von <strong>Dealhunter</strong> generiert.
    </p>

  </div>

</body>
</html>`;

  return sendEmail({
    to: recipientEmail,
    subject: `${statusIcon} Qualification Scan ${statusLabel}: ${customerName}`,
    html,
  });
}
