import type OpenAI from "openai";
import { describe, expect, it } from "vitest";
import { EMPTY_PARSE } from "@/lib/parse-listing";
import { extractListing } from "./model";
import { PROMPT_VERSION, instructions } from "./prompt";
import { toParsed, type AiListing } from "./schema";

const blank: AiListing = {
  title: null,
  address: null,
  url: null,
  rent_dollars: null,
  beds: null,
  baths: null,
  lease_start: null,
  lease_end: null,
  parking: null,
  laundry: null
};

/** A stand-in for the OpenAI client that returns a canned response and records the request. */
function stubClient(response: { output_parsed: unknown; status?: string; usage?: { input_tokens: number; output_tokens: number } }) {
  const calls: Record<string, unknown>[] = [];
  const client = {
    responses: {
      parse: async (body: Record<string, unknown>) => {
        calls.push(body);
        return response;
      }
    }
  } as unknown as OpenAI;
  return { client, calls };
}

describe("toParsed", () => {
  it("keeps valid fields and converts rent to cents", () => {
    const { fields, dropped } = toParsed({ ...blank, rent_dollars: 5400, beds: 4, baths: 2, laundry: "in_unit" });
    expect(fields).toEqual({ ...EMPTY_PARSE, rentCents: 540000, beds: 4, baths: 2, laundry: "in_unit" });
    expect(dropped).toEqual([]);
  });

  it("drops values that break the app's rules and reports them", () => {
    const { fields, dropped } = toParsed({ ...blank, url: "javascript:alert(1)", beds: 40, rent_dollars: 5, lease_start: "Sept 1" });
    expect(fields).toEqual(EMPTY_PARSE);
    expect(dropped.sort()).toEqual(["beds", "leaseStart", "rentCents", "url"]);
  });

  it("drops a lease end that comes before the start", () => {
    const { fields, dropped } = toParsed({ ...blank, lease_start: "2027-09-01", lease_end: "2027-06-30" });
    expect(fields.leaseStart).toBe("2027-09-01");
    expect(fields.leaseEnd).toBeNull();
    expect(dropped).toEqual(["leaseEnd"]);
  });

  it("treats empty strings as unknown, not as dropped", () => {
    const { fields, dropped } = toParsed({ ...blank, title: "  ", address: "" });
    expect(fields.title).toBeNull();
    expect(fields.address).toBeNull();
    expect(dropped).toEqual([]);
  });
});

describe("extractListing", () => {
  const now = new Date("2026-11-13T12:00:00Z");

  it("sends the fenced text with today's date and returns fields plus telemetry", async () => {
    const { client, calls } = stubClient({
      output_parsed: { ...blank, rent_dollars: 1850, beds: 0 },
      status: "completed",
      usage: { input_tokens: 412, output_tokens: 96 }
    });
    const result = await extractListing(client, { text: "Studio on Trigo, $1,850/mo" }, { model: "test-model", now });

    expect(calls).toHaveLength(1);
    expect(calls[0]).toMatchObject({
      model: "test-model",
      instructions: instructions("2026-11-13"),
      input: "<listing>\nStudio on Trigo, $1,850/mo\n</listing>",
      store: false
    });
    expect(result.fields).toEqual({ ...EMPTY_PARSE, rentCents: 185000, beds: 0 });
    expect(result.usage).toEqual({ inputTokens: 412, outputTokens: 96 });
    expect(result.status).toBe("completed");
    expect(result.model).toBe("test-model");
    expect(result.promptVersion).toBe(PROMPT_VERSION);
    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it("sends screenshots as image parts after the fenced text, at high detail by default", async () => {
    const { client, calls } = stubClient({ output_parsed: { ...blank, beds: 3 } });
    await extractListing(
      client,
      { text: "caption: 3bd on Sueno", images: [{ type: "image/jpeg", base64: "AAAA" }, { type: "image/png", base64: "BBBB" }] },
      { now }
    );
    expect(calls[0]!.input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "<listing>\ncaption: 3bd on Sueno\n</listing>" },
          { type: "input_text", text: "Screenshots of the listing (2):" },
          { type: "input_image", image_url: "data:image/jpeg;base64,AAAA", detail: "high" },
          { type: "input_image", image_url: "data:image/png;base64,BBBB", detail: "high" }
        ]
      }
    ]);
  });

  it("sends a screenshot on its own, with the detail level the caller picks", async () => {
    const { client, calls } = stubClient({ output_parsed: blank });
    await extractListing(client, { images: [{ type: "image/jpeg", base64: "AAAA" }] }, { now, imageDetail: "low" });
    expect(calls[0]!.input).toEqual([
      {
        role: "user",
        content: [
          { type: "input_text", text: "Screenshots of the listing (1):" },
          { type: "input_image", image_url: "data:image/jpeg;base64,AAAA", detail: "low" }
        ]
      }
    ]);
  });

  it("returns no fields for a refusal or cut-off answer", async () => {
    const { client } = stubClient({ output_parsed: null, status: "incomplete" });
    const result = await extractListing(client, { text: "anything" }, { now });
    expect(result.fields).toBeNull();
    expect(result.status).toBe("incomplete");
    expect(result.usage).toBeNull();
  });

  it("returns no fields when the output doesn't match the schema", async () => {
    const { client } = stubClient({ output_parsed: { rent_dollars: "a lot" } });
    expect((await extractListing(client, { text: "anything" }, { now })).fields).toBeNull();
  });

  it("lets API errors through for the caller to handle", async () => {
    const client = { responses: { parse: async () => Promise.reject(new Error("boom")) } } as unknown as OpenAI;
    await expect(extractListing(client, { text: "anything" }, { now })).rejects.toThrow("boom");
  });
});

describe("PROMPT_VERSION", () => {
  it("is a stable 12-character fingerprint", () => {
    expect(PROMPT_VERSION).toMatch(/^[0-9a-f]{12}$/);
  });
});
