import type { Listing } from "@/lib/listing";
import type { Photo } from "@/lib/stores/types";

/** What a place's photo frames show. */
export type Cover = { kind: "photo"; photo: Photo } | { kind: "street" } | { kind: "none" };

/**
 * The photo that leads for a place:
 * - the one the group picked (Street View, or one of their photos), if it's still there;
 * - otherwise the first photo they added;
 * - otherwise Street View, unless they hid it.
 */
export function resolveCover(listing: Pick<Listing, "cover" | "streetView"> | undefined, photos: Photo[]): Cover {
  const cover = listing?.cover ?? null;
  const streetView = listing?.streetView ?? true;
  if (cover === "street" && streetView) return { kind: "street" };
  const picked = cover && cover !== "street" ? photos.find((p) => p.id === cover) : undefined;
  if (picked) return { kind: "photo", photo: picked };
  if (photos[0]) return { kind: "photo", photo: photos[0] };
  return streetView ? { kind: "street" } : { kind: "none" };
}
