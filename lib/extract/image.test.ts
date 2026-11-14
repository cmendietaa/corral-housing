import { describe, expect, it } from "vitest";
import { sniffImageType } from "./image";

const bytes = (...b: number[]) => new Uint8Array(b);
const ascii = (s: string) => new Uint8Array([...s].map((c) => c.charCodeAt(0)));

describe("sniffImageType", () => {
  it("recognizes JPEG, PNG and WebP by their first bytes", () => {
    expect(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0))).toBe("image/jpeg");
    expect(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0))).toBe("image/png");
    expect(sniffImageType(ascii("RIFF\0\0\0\0WEBPVP8 "))).toBe("image/webp");
  });

  it("rejects anything else, whatever it's called", () => {
    expect(sniffImageType(ascii("<svg xmlns='http://www.w3.org/2000/svg'>"))).toBeNull();
    expect(sniffImageType(ascii("GIF89a......"))).toBeNull();
    expect(sniffImageType(ascii("%PDF-1.7"))).toBeNull();
    expect(sniffImageType(ascii("RIFF\0\0\0\0WAVEfmt "))).toBeNull();
    expect(sniffImageType(bytes())).toBeNull();
    expect(sniffImageType(bytes(0xff, 0xd8))).toBeNull();
  });
});
