"use client";

import Stories from "../components/Stories";
import { STORIES } from "../stories_data";

export default function Page() {
  return <Stories stories={STORIES} />;
}