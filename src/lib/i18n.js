/** Return the key when a message is missing so localisation mistakes stay visible. */
export function t(key) {
  return chrome.i18n.getMessage(key) || key;
}
