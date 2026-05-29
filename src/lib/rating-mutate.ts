export type StoredRating = {
  _key: string;
  _type: "rating";
  editor: { _type: "reference"; _ref: string };
  value: number;
};

export function ratingKey(editorId: string): string {
  return `rating-${editorId}`;
}

export function upsertRating(
  ratings: StoredRating[],
  editorId: string,
  value: number,
): StoredRating[] {
  const key = ratingKey(editorId);
  const next: StoredRating = {
    _key: key,
    _type: "rating",
    editor: { _type: "reference", _ref: editorId },
    value,
  };
  const exists = ratings.some((r) => r._key === key);
  return exists
    ? ratings.map((r) => (r._key === key ? next : r))
    : [...ratings, next];
}
