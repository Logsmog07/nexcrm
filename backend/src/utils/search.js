const SEARCH_MAX_LENGTH = 80;

const normalizeSearchValue = (value) =>
  String(value || "")
    .replace(/[\x00-\x1F\x7F]/g, " ")
    .trim()
    .slice(0, SEARCH_MAX_LENGTH);

const escapeLikePattern = (value) =>
  String(value || "").replace(/[\\%_]/g, (token) => `\\${token}`);

const buildContainsPattern = (value) => {
  const normalized = normalizeSearchValue(value);
  if (!normalized) {
    return null;
  }

  return `%${escapeLikePattern(normalized)}%`;
};

module.exports = {
  buildContainsPattern,
};
