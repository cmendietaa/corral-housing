import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/ai-extract", () => ({ aiConfigured: vi.fn(), extractWithAI: vi.fn() }));
const { aiConfigured, extractWithAI } = await import("@/lib/ai-extract");
const { POST } = await import("./route");

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2, 3]);
const AI_FIELDS = {
  title: "3BD on Sueno",
  address: "6741 Sueno Rd, Isla Vista",
  url: null,
  rentCents: 510000,
  beds: 3,
  baths: 2,
  leaseStart: null,
  leaseEnd: null,
  parking: null,
  laundry: null
};

let ipCounter = 0;
function request(body: FormData | object, ip = `10.0.0.${++ipCounter}`) {
  const url = "http://localhost/api/parse-listing";
  if (body instanceof FormData) return new NextRequest(url, { method: "POST", body, headers: { "x-forwarded-for": ip } });
  return new NextRequest(url, {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json", "x-forwarded-for": ip }
  });
}

function upload(images: Uint8Array[], text?: string) {
  const form = new FormData();
  if (text) form.set("text", text);
  images.forEach((bytes, i) => form.append("image", new Blob([bytes as BlobPart], { type: "image/png" }), `s${i}.png`));
  return form;
}

const LISTING = "4BR/2BA duplex near Pardall, $5,400/mo. W/D in unit.";

beforeEach(() => {
  vi.mocked(aiConfigured).mockReturnValue(true);
  vi.mocked(extractWithAI).mockReset();
});

describe("POST /api/parse-listing", () => {
  it("reads pasted text with the parser when there's no AI key, as before", async () => {
    vi.mocked(aiConfigured).mockReturnValue(false);
    const res = await POST(request({ text: LISTING }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({ source: "parser", fields: { rentCents: 540000, beds: 4 } });
    expect(body.note).toBeUndefined();
  });

  it("sends a screenshot to the model and returns its fields", async () => {
    vi.mocked(extractWithAI).mockResolvedValue(AI_FIELDS);
    const res = await POST(request(upload([PNG])));
    expect(await res.json()).toEqual({ fields: AI_FIELDS, source: "ai" });
    expect(extractWithAI).toHaveBeenCalledWith({
      text: undefined,
      images: [{ type: "image/png", base64: Buffer.from(PNG).toString("base64") }]
    });
  });

  it("says to paste text when a screenshot can't be read and there's no text", async () => {
    vi.mocked(extractWithAI).mockResolvedValue(null);
    const res = await POST(request(upload([PNG])));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/Paste the listing's text instead/);

    vi.mocked(aiConfigured).mockReturnValue(false);
    expect((await POST(request(upload([PNG])))).status).toBe(503);
  });

  it("falls back to the parser for the text when the model fails on text plus screenshots", async () => {
    vi.mocked(extractWithAI).mockResolvedValue(null);
    const body = await (await POST(request(upload([PNG], LISTING)))).json();
    expect(body).toMatchObject({ source: "parser", fields: { rentCents: 540000 } });
    expect(body.note).toMatch(/from the text/);
  });

  it("refuses more than 3 screenshots, oversized files and files that aren't images", async () => {
    expect((await POST(request(upload([PNG, PNG, PNG, PNG])))).status).toBe(400);
    const big = new Uint8Array(1.5 * 1024 * 1024 + 1);
    big.set(PNG);
    expect((await POST(request(upload([big])))).status).toBe(413);
    // Named and typed as a PNG, but it's really SVG text.
    const fake = new TextEncoder().encode("<svg xmlns='http://www.w3.org/2000/svg'></svg>");
    const res = await POST(request(upload([fake])));
    expect(res.status).toBe(415);
    expect(extractWithAI).not.toHaveBeenCalled();
  });

  it("needs some text or a screenshot", async () => {
    expect((await POST(request({ text: "hi" }))).status).toBe(400);
    expect((await POST(request(new FormData()))).status).toBe(400);
  });

  it("counts a screenshot request as 2 of the 10 hourly AI calls", async () => {
    vi.mocked(extractWithAI).mockResolvedValue(AI_FIELDS);
    for (let i = 0; i < 5; i++) expect((await POST(request(upload([PNG]), "10.9.9.9"))).status).toBe(200);
    const res = await POST(request(upload([PNG]), "10.9.9.9"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toMatch(/a lot this hour/);
    expect(extractWithAI).toHaveBeenCalledTimes(5);
  });
});
