import { Resend } from 'resend';

// Initialize Resend client
const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendBLAssignmentEmailInput {
  blLeaderName: string;
  blLeaderEmail: string;
  businessLineName: string;
  customerName: string;
  projectDescription: string;
  bidId: string;
}

/**
 * ROUTE-003: Send email notification to BL leader when opportunity is assigned
 */
export async function sendBLAssignmentEmail(
  input: SendBLAssignmentEmailInput
): Promise<{ success: boolean; error?: string }> {
  try {
    const {
      blLeaderName,
      blLeaderEmail,
      businessLineName,
      customerName,
      projectDescription,
      bidId,
    } = input;

    // In development, log instead of sending
    if (process.env.NODE_ENV === 'development' && !process.env.RESEND_API_KEY) {
      console.log('📧 [DEV MODE] BL Assignment Email:', {
        to: blLeaderEmail,
        subject: `Neue Opportunity: ${customerName}`,
        blLeaderName,
        businessLineName,
        bidId,
      });
      return { success: true };
    }

    // Create review link
    const reviewUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/bids/${bidId}`;

    // Send email using Resend
    await resend.emails.send({
      from: 'Dealhunter <noreply@dealhunter.adesso.de>',
      to: blLeaderEmail,
      subject: `Neue Opportunity: ${customerName}`,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Neue Opportunity</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">

  <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; border-radius: 8px 8px 0 0;">
    <h1 style="margin: 0; font-size: 24px; font-weight: 600;">Neue Opportunity zugewiesen</h1>
  </div>

  <div style="background: #fff; border: 1px solid #e5e7eb; border-top: none; padding: 30px; border-radius: 0 0 8px 8px;">

    <p style="margin-top: 0;">Hallo ${blLeaderName},</p>

    <p>Dir wurde eine neue Opportunity für den Bereich <strong>${businessLineName}</strong> zugewiesen:</p>

    <div style="background: #f9fafb; border-left: 4px solid #667eea; padding: 15px; margin: 20px 0; border-radius: 4px;">
      <h2 style="margin: 0 0 10px 0; font-size: 18px; color: #667eea;">${customerName}</h2>
      <p style="margin: 0; color: #6b7280; line-height: 1.6;">${projectDescription}</p>
    </div>

    <div style="margin: 30px 0;">
      <a href="${reviewUrl}" style="display: inline-block; background: #667eea; color: white; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 500;">
        Opportunity prüfen
      </a>
    </div>

    <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 30px 0;">

    <h3 style="font-size: 16px; color: #374151; margin-bottom: 12px;">Nächste Schritte:</h3>
    <ol style="margin: 0; padding-left: 20px; color: #6b7280;">
      <li style="margin-bottom: 8px;">Opportunity und Anforderungen prüfen</li>
      <li style="margin-bottom: 8px;">Deep Migration Analysis reviewen (falls verfügbar)</li>
      <li style="margin-bottom: 8px;">Team zusammenstellen</li>
      <li>Angebot vorbereiten</li>
    </ol>

    <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #9ca3af; font-size: 14px;">
      Diese Nachricht wurde automatisch von <strong>Dealhunter</strong> generiert.<br>
      Bei Fragen wende dich an das BD-Team.
    </p>

  </div>

</body>
</html>
      `,
    });

    return { success: true };
  } catch (error) {
    console.error('Error sending BL assignment email:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Fehler beim Senden der E-Mail',
    };
  }
}
