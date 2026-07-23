import messages from "./messages/es.json";

type Messages = typeof messages;
type Namespace = keyof Messages;

/**
 * Minimal i18n hook. Returns messages from the active locale.
 * When adding a proper i18n library (next-intl, react-i18next, etc.),
 * replace this implementation. The API (useTranslations) stays the same.
 */
export function useTranslations<T extends Namespace>(ns: T): Messages[T] {
  return messages[ns];
}

export { messages };
