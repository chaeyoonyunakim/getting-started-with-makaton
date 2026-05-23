/**
 * Centralised sanitiser for any user-controlled string that is interpolated
 * into an LLM prompt (or proxied to an upstream prompt-generating API).
 *
 * Goals (in order):
 *   1. Strip prompt-injection payloads ("ignore previous instructions",
 *      role-impersonation markers, fenced code blocks, HTML/XML tags,
 *      tool-call delimiters, zero-width characters, control characters).
 *   2. Normalise whitespace and Unicode confusables so reviewers can read
 *      what was sent to the model.
 *   3. Enforce a length cap so a single field cannot blow out the model's
 *      context window or smuggle a multi-kilobyte payload.
 *
 * The function is pure, has no Deno/Node-only APIs, and is shared by every
 * edge function that builds an AI prompt. It is also exercised by unit
 * tests under src/test/sanitizePromptInput.test.ts.
 */

export interface SanitizeOptions {
  /** Hard cap on the returned string (default 80). */
  maxLength?: number;
  /** Value returned when the sanitised string would be empty (default ""). */
  fallback?: string;
  /**
   * If true, allow a slightly wider punctuation set suitable for short
   * human-readable phrases (commas, apostrophes, question marks). Defaults
   * to false (label/identifier mode).
   */
  allowPunctuation?: boolean;
}

/**
 * Patterns that match common prompt-injection phrasing. Each match is
 * replaced with a single space so the surrounding text stays readable but
 * the directive is destroyed. The list is intentionally conservative — we
 * only target phrases that have no legitimate use inside a Makaton label,
 * pupil name, category, or colour.
 */
const INJECTION_PATTERNS: RegExp[] = [
  // "Ignore (all) previous/above/prior instructions/prompts/rules"
  /ignore\s+(all\s+|any\s+)?(previous|prior|above|earlier|the\s+above)\s+(instructions?|prompts?|rules?|messages?|context)/gi,
  // "Disregard / forget (the) (system) prompt/instructions"
  /(disregard|forget|override|bypass)\s+(the\s+|your\s+|all\s+)?(system\s+|previous\s+|prior\s+)?(prompt|instructions?|rules?|guidelines?)/gi,
  // Role-impersonation prefixes ("system:", "assistant:", "user:") at any
  // position — strip the marker but keep the text after it.
  /\b(system|assistant|user|developer|tool)\s*:\s*/gi,
  // Common jailbreak markers / chat templates.
  /<\|(?:im_start|im_end|endoftext|system|assistant|user|tool|function|channel)\|>/gi,
  /\[\/?(?:INST|SYS|s|system|assistant|user)\]/gi,
  /###\s*(system|assistant|user|instruction)s?\b/gi,
  // "You are now ..." style persona overrides.
  /you\s+are\s+(now|actually|really)\s+[^.\n]{0,80}/gi,
  // "Act as ..." style persona overrides.
  /\bact\s+as\s+(?:an?\s+|the\s+)?[^.\n]{0,60}/gi,
  // Tool / function calling delimiters.
  /<\/?(?:tool_call|function_call|function|tool)[^>]*>/gi,
];

/**
 * Characters that have no business inside a short label or name and which
 * are commonly used by injection payloads to break out of the surrounding
 * context: backticks, triple backticks (markdown code fences), curly
 * braces (template delimiters), angle brackets (HTML/XML), pipes
 * (markdown table cells), dollar signs (template literals), and quotes.
 */
const STRUCTURAL_CHAR_RE = /[`{}<>|$"]/g;

/** Zero-width and bidi-override characters used to hide payloads. */
const HIDDEN_CHAR_RE = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;

/** All ASCII / Unicode C0 + C1 control characters. */
// eslint-disable-next-line no-control-regex
const CONTROL_CHAR_RE = /[\u0000-\u001F\u007F-\u009F]/g;

export function sanitizePromptInput(
  value: unknown,
  options: SanitizeOptions = {},
): string {
  const { maxLength = 80, fallback = "", allowPunctuation = false } = options;

  if (typeof value !== "string") return fallback;

  let out = value.normalize("NFKC");

  // 1. Drop hidden + control characters before anything else, so they
  //    cannot smuggle a payload past the regex passes below.
  out = out.replace(HIDDEN_CHAR_RE, "");
  out = out.replace(CONTROL_CHAR_RE, " ");

  // 2. Remove HTML/XML tags entirely (keep their inner text).
  out = out.replace(/<\/?[a-zA-Z][^>]*>/g, " ");

  // 3. Remove fenced code blocks and inline backtick spans.
  out = out.replace(/```[\s\S]*?```/g, " ");
  out = out.replace(/`[^`]*`/g, " ");

  // 4. Strip known injection phrasings.
  for (const re of INJECTION_PATTERNS) out = out.replace(re, " ");

  // 5. Strip structural / template characters.
  out = out.replace(STRUCTURAL_CHAR_RE, " ");

  // 6. Whitelist: letters, numbers, spaces, and a small punctuation set.
  //    Anything else (newlines, tabs, slashes, brackets, @, #, *, etc.)
  //    is replaced with a space.
  const allowed = allowPunctuation
    ? /[^\p{L}\p{N}\s\-_.,'?!]/gu
    : /[^\p{L}\p{N}\s\-_.]/gu;
  out = out.replace(allowed, " ");

  // 7. Collapse repeated whitespace and trim.
  out = out.replace(/\s+/g, " ").trim();

  // 8. Enforce length cap.
  if (out.length > maxLength) out = out.slice(0, maxLength).trim();

  return out.length > 0 ? out : fallback;
}

/** Convenience: sanitise then guarantee a non-empty default. */
export function sanitizeLabel(value: unknown, fallback = "symbol"): string {
  return sanitizePromptInput(value, { maxLength: 80, fallback });
}
