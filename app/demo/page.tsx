import type { Metadata } from "next";
import { DemoBoard } from "./demo-board";

export const metadata: Metadata = {
  title: "Demo board · Corral",
  description: "A fictional Corral board of Isla Vista and Goleta places. Edits stay in your browser."
};

export default function DemoPage() {
  return <DemoBoard />;
}
