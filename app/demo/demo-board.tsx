"use client";

import { useState } from "react";
import { Board } from "@/components/board/board";
import { createLocalStore } from "@/lib/stores/local";

export function DemoBoard({ photos }: { photos: boolean }) {
  // One store per page visit; it reads localStorage lazily on load().
  const [store] = useState(() => createLocalStore());
  return <Board store={store} photos={photos} />;
}
