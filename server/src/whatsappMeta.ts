/**
 * Meta WhatsApp Cloud API — send OTP text when META_ACCESS_TOKEN + META_WHATSAPP_PHONE_NUMBER_ID are set.
 * @see https://developers.facebook.com/docs/whatsapp/cloud-api
 */
export async function sendWhatsAppOtpTemplate(phoneE164Digits: string, code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const token = process.env.META_ACCESS_TOKEN?.trim();
  const phoneNumberId = process.env.META_WHATSAPP_PHONE_NUMBER_ID?.trim();
  if (!token || !phoneNumberId) {
    return { ok: false, error: "meta_not_configured" };
  }
  const to = phoneE164Digits.startsWith("+") ? phoneE164Digits.slice(1) : phoneE164Digits;
  const url = `https://graph.facebook.com/v21.0/${phoneNumberId}/messages`;
  const body = {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: {
      preview_url: false,
      body: `Tu código Bestie: ${code}\nVence en 10 minutos.`,
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    return { ok: false, error: `meta_http_${res.status}: ${t.slice(0, 200)}` };
  }
  return { ok: true };
}
