import type { Metadata } from "next";
import { DemoBoard } from "./demo-board";

export const metadata: Metadata = {
  title: "Demo board · Corral",
  description: "A fictional Corral board of Isla Vista and Goleta places. Edits stay in your browser."
};

export default function DemoPage() {
  // Read on the server; the key itself never reaches the browser. Adding the key needs a redeploy.
  const photos = Boolean(process.env.GOOGLE_MAPS_API_KEY);
  return <DemoBoard photos={photos} />;
}
