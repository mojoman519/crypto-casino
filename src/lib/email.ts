const RESEND_API_KEY = process.env.RESEND_API_KEY
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://crypto-casino-alpha.vercel.app'
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@neonbet.gg'

export async function sendVerificationEmail(
  toEmail: string,
  username: string,
  token: string
): Promise<boolean> {
  if (!RESEND_API_KEY) {
    console.warn('[email] RESEND_API_KEY not set — skipping email')
    return true
  }

  const verifyUrl = `${APP_URL}/api/auth/verify-email?token=${token}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toEmail,
        subject: '🎰 Verify your NeonBet account',
        html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="background:#050508;color:#f8fafc;font-family:system-ui,sans-serif;margin:0;padding:0;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#050508;padding:40px 20px;">
    <tr>
      <td align="center">
        <table width="520" cellpadding="0" cellspacing="0" style="background:rgba(255,255,255,0.03);border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:40px;">
          <tr>
            <td align="center" style="padding-bottom:24px;">
              <div style="background:linear-gradient(135deg,#7c3aed,#ec4899);width:56px;height:56px;border-radius:14px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;">⚡</div>
              <h1 style="margin:16px 0 4px;font-size:28px;font-weight:900;background:linear-gradient(135deg,#a78bfa,#f472b6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;">NeonBet Casino</h1>
            </td>
          </tr>
          <tr>
            <td style="padding-bottom:16px;">
              <h2 style="margin:0 0 8px;font-size:20px;font-weight:700;color:#f8fafc;">Hey ${username}, verify your email</h2>
              <p style="margin:0;color:rgba(248,250,252,0.6);font-size:15px;line-height:1.6;">
                Click the button below to verify your email and unlock your full account. This link expires in 24 hours.
              </p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:24px 0;">
              <a href="${verifyUrl}" style="background:linear-gradient(135deg,#7c3aed,#ec4899);color:white;text-decoration:none;padding:14px 36px;border-radius:12px;font-weight:700;font-size:16px;display:inline-block;">
                ✅ Verify Email
              </a>
            </td>
          </tr>
          <tr>
            <td style="padding-top:16px;border-top:1px solid rgba(255,255,255,0.06);">
              <p style="margin:0;color:rgba(248,250,252,0.3);font-size:12px;text-align:center;">
                If you didn't create an account, ignore this email.<br>
                Link: <a href="${verifyUrl}" style="color:#a78bfa;">${verifyUrl}</a>
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      }),
    })

    return res.ok
  } catch (err) {
    console.error('[email] Failed to send:', err)
    return false
  }
}

export async function sendPasswordResetEmail(
  toEmail: string,
  username: string,
  token: string
): Promise<boolean> {
  if (!RESEND_API_KEY) return true

  const resetUrl = `${APP_URL}/reset-password?token=${token}`

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: FROM_EMAIL,
        to: toEmail,
        subject: '🔑 Reset your NeonBet password',
        html: `
<body style="background:#050508;color:#f8fafc;font-family:system-ui,sans-serif;padding:40px 20px;">
  <div style="max-width:480px;margin:0 auto;background:rgba(255,255,255,0.03);border:1px solid rgba(124,58,237,0.3);border-radius:16px;padding:32px;">
    <h2 style="color:#f8fafc;">Password Reset — ${username}</h2>
    <p style="color:rgba(248,250,252,0.6);">Click below to reset your password. Expires in 1 hour.</p>
    <a href="${resetUrl}" style="background:linear-gradient(135deg,#7c3aed,#ec4899);color:white;text-decoration:none;padding:12px 28px;border-radius:10px;font-weight:700;display:inline-block;margin:16px 0;">
      Reset Password
    </a>
    <p style="color:rgba(248,250,252,0.3);font-size:12px;">If you didn't request this, ignore the email.</p>
  </div>
</body>`,
      }),
    })
    return res.ok
  } catch {
    return false
  }
}
