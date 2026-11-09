import { describe, expect, it } from "vitest";
import { imageIds, isEmptyBody, parseBody, plainText } from "./rich";

const doc = (content: unknown[]) => JSON.stringify({ type: "doc", content });
const p = (t: string) => ({ type: "paragraph", content: [{ type: "text", text: t }] });

describe("rich bodies", () => {
  it("treats legacy plain text as paragraphs", () => {
    expect(plainText("one\ntwo")).toBe("one\ntwo");
    expect(parseBody("hello").content).toHaveLength(1);
  });
  it("does not choke on text that looks like JSON", () => {
    expect(plainText("{not json")).toBe("{not json");
    expect(plainText('{"a":1}')).toBe('{"a":1}');
  });
  it("extracts text from lists and formatting", () => {
    const body = doc([
      { type: "orderedList", content: [{ type: "listItem", content: [p("first")] }, { type: "listItem", content: [p("second")] }] },
      { type: "paragraph", content: [{ type: "text", text: "bold", marks: [{ type: "bold" }] }] },
    ]);
    expect(plainText(body)).toBe("first\nsecond\nbold");
  });
  it("finds image ids, including nested ones", () => {
    const body = doc([{ type: "image", attrs: { imageId: "a" } }, { type: "bulletList", content: [{ type: "listItem", content: [{ type: "image", attrs: { imageId: "b" } }] }] }]);
    expect(imageIds(body).sort()).toEqual(["a", "b"]);
  });
  it("knows when a body is empty", () => {
    expect(isEmptyBody("")).toBe(true);
    expect(isEmptyBody(doc([{ type: "paragraph" }]))).toBe(true);
    expect(isEmptyBody(doc([{ type: "image", attrs: { imageId: "a" } }]))).toBe(false);
  });
});
