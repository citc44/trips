import { Webhook } from 'npm:standardwebhooks@^1';
import { Resend } from 'npm:resend@^6';

const hookSecret = (Deno.env.get('SEND_EMAIL_HOOK_SECRET') ?? '').replace('v1,whsec_', '');
const resend = new Resend(Deno.env.get('RESEND_API_KEY'));

type SendEmailPayload = {
  user: { email: string };
  email_data: {
    token: string;
    email_action_type: string;
  };
};

function renderOtpEmail(code: string): string {
  return `
    <div style="background-color:#0A0D1C;padding:48px 24px;font-family:sans-serif;color:#F7F6FF;">
      <div style="max-width:420px;margin:0 auto;text-align:center;">
        <h1 style="font-size:20px;font-weight:600;margin-bottom:24px;">Your Voylo sign-in code</h1>
        <p style="font-size:40px;font-weight:700;letter-spacing:0.1em;margin:0 0 24px;">${code}</p>
        <p style="font-size:14px;color:#A6ADD1;">This code expires shortly. If you didn't request it, you can ignore this email.</p>
      </div>
    </div>
  `;
}

function errorResponse(httpCode: number, message: string): Response {
  return new Response(JSON.stringify({ error: { http_code: httpCode, message } }), {
    status: httpCode,
    headers: { 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return errorResponse(400, 'Method not allowed');
  }

  const payload = await req.text();
  const headers = Object.fromEntries(req.headers);

  let user: SendEmailPayload['user'];
  let emailData: SendEmailPayload['email_data'];

  try {
    const wh = new Webhook(hookSecret);
    const verified = wh.verify(payload, headers) as SendEmailPayload;
    user = verified.user;
    emailData = verified.email_data;
  } catch (error) {
    return errorResponse(401, `Webhook signature verification failed: ${(error as Error).message}`);
  }

  try {
    const { error } = await resend.emails.send({
      from: 'Voylo <onboarding@resend.dev>',
      to: [user.email],
      subject: 'Your Voylo sign-in code',
      html: renderOtpEmail(emailData.token),
    });

    if (error) {
      return errorResponse(500, error.message);
    }
  } catch (error) {
    return errorResponse(500, `Failed to send email: ${(error as Error).message}`);
  }

  return new Response(JSON.stringify({}), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
});
