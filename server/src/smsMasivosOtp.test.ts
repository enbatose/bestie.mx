import { afterEach, describe, expect, it, vi } from "vitest";
import { smsMasivosSendSms } from "./smsMasivosOtp.js";

describe("smsMasivosSendSms", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it("posts the 10-digit national number to /sms/send", async () => {
    vi.stubEnv("SMSMASIVOS_API_KEY", "test-key");
    vi.stubEnv("SMSMASIVOS_SANDBOX", "");
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await smsMasivosSendSms("+523312345678", "Bestie: tu solicitud ARCO");
    expect(r).toEqual({ ok: true, sandbox: false });
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.smsmasivos.com.mx/sms/send");
    expect((init.headers as Record<string, string>).apikey).toBe("test-key");
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    expect(body.numbers).toBe("3312345678");
    expect(body.country_code).toBe("52");
    expect(body.message).toBe("Bestie: tu solicitud ARCO");
    expect(body.sandbox).toBeUndefined();
  });

  it("sets sandbox when SMSMASIVOS_SANDBOX=1", async () => {
    vi.stubEnv("SMSMASIVOS_API_KEY", "test-key");
    vi.stubEnv("SMSMASIVOS_SANDBOX", "1");
    const fetchMock = vi.fn().mockResolvedValue({
      status: 200,
      json: async () => ({ success: true }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const r = await smsMasivosSendSms("3312345678", "hola");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.sandbox).toBe(true);
    const body = JSON.parse(String((fetchMock.mock.calls[0] as [string, RequestInit])[1].body)) as {
      sandbox?: number;
    };
    expect(body.sandbox).toBe(1);
  });
});
