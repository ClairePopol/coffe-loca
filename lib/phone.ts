/**
 * Phone-number login without SMS (free tier).
 *
 * Supabase's free, SMS-less auth is email + password, so each phone number is mapped
 * to an internal address `<62xxxxxxxxxx>@phone.coffeeloca.id`. Members only ever see
 * and type their phone number. The number is also stored in user metadata and in
 * profiles.phone, so WhatsApp OTP verification can be added later without migrating.
 *
 * Requires "Confirm email" to be OFF in Supabase (Authentication → Providers → Email),
 * otherwise Supabase tries to send confirmation mail to these internal addresses.
 */
export const PHONE_EMAIL_DOMAIN = "phone.coffeeloca.id";

/** Normalise Indonesian mobile numbers to 62xxxxxxxxxx (digits only). Returns null if invalid. */
export function normalizePhone(input: string): string | null {
  let digits = input.replace(/\D/g, "");
  if (digits.startsWith("0")) digits = `62${digits.slice(1)}`;
  else if (digits.startsWith("8")) digits = `62${digits}`;
  if (!/^628\d{7,11}$/.test(digits)) return null;
  return digits;
}

export const phoneToAuthEmail = (phone: string) => `${phone}@${PHONE_EMAIL_DOMAIN}`;
export const isPhoneAuthEmail = (email: string | null | undefined) => Boolean(email?.endsWith(`@${PHONE_EMAIL_DOMAIN}`));

/** 6281234567890 → "0812-3456-7890" for display. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const local = phone.startsWith("62") ? `0${phone.slice(2)}` : phone;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, "$1-$2-$3");
}

/** Phone of a signed-in user (from metadata, or derived from the internal address). */
export function userPhone(user: { email?: string | null; user_metadata?: Record<string, unknown> } | null | undefined): string {
  const fromMeta = typeof user?.user_metadata?.phone === "string" ? user.user_metadata.phone : "";
  if (fromMeta) return fromMeta;
  return isPhoneAuthEmail(user?.email) ? (user?.email ?? "").split("@")[0] : "";
}

/** 6281234567890 → "+6281234567890" (E.164, the format Supabase phone auth / Twilio expect). */
export const phoneToE164 = (phone: string) => `+${phone}`;
