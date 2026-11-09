"use client";

import { use } from "react";
import { Editor } from "@/components/editor";

export default function EditEntryPage({ params }: PageProps<"/write/[id]">) {
  const { id } = use(params);
  return <Editor id={id} />;
}
