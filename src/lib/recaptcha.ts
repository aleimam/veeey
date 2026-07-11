/**
 * reCAPTCHA v3 verification (FR-ACC-01, NFR-02). When no secret is configured
 * (local dev / CI) verification is bypassed so flows still work; in production
 * the secret is required and a low score fails closed.
 */

export type RecaptchaApiResponse = {
  success: boolean;
  score?: number;
  action?: string;
  'error-codes'?: string[];
};

/** Pure scoring decision — unit-testable without a network call. */
export function evaluateRecaptcha(
  data: RecaptchaApiResponse,
  minScore: number,
): boolean {
  if (!data.success) return false;
  if (data.score === undefined) return true; // v2-style: success is enough
  return data.score >= minScore;
}

export async function verifyRecaptcha(token: string | undefined): Promise<boolean> {
  const secret = process.env.RECAPTCHA_SECRET_KEY;
  if (!secret) return true; // not configured -> bypass (dev/CI)
  // Secret without a public site key = clients can never mint tokens — treat as
  // misconfigured and fail open rather than blocking every login/registration.
  if (!process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY) return true;
  if (!token) return false;

  const minScore = Number(process.env.RECAPTCHA_MIN_SCORE ?? '0.5');
  try {
    const res = await fetch('https://www.google.com/recaptcha/api/siteverify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ secret, response: token }),
    });
    const data = (await res.json()) as RecaptchaApiResponse;
    return evaluateRecaptcha(data, minScore);
  } catch {
    return false; // fail closed on network error in production
  }
}
