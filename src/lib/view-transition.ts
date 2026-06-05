/**
 * A valid CSS `view-transition-name` for a recipe cover, so the image can morph
 * from the card to the detail hero. Prefixed (idents can't start with a digit)
 * and stripped of any characters not allowed in a custom-ident.
 */
export function coverTransitionName(id: string): string {
  return `rc-${id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
}
