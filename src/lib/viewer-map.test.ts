import { describe, it, expect } from "vitest";
import { mapEditorToViewer } from "./viewer-map";

describe("mapEditorToViewer", () => {
  it("treats a resolved editor as an editor", () => {
    const viewer = mapEditorToViewer(
      { _id: "editor-1", name: "Jacob" },
      "Google Name",
    );
    expect(viewer).toEqual({
      isEditor: true,
      editorId: "editor-1",
      name: "Jacob",
    });
  });

  it("treats a null editor as a non-editor and falls back to the auth name", () => {
    const viewer = mapEditorToViewer(null, "Google Name");
    expect(viewer).toEqual({
      isEditor: false,
      editorId: null,
      name: "Google Name",
    });
  });

  it("returns a null name when neither editor nor fallback is present", () => {
    const viewer = mapEditorToViewer(null, null);
    expect(viewer).toEqual({
      isEditor: false,
      editorId: null,
      name: null,
    });
  });
});
