import type { Metadata } from "next";
import InfoSheet from "./InfoSheet";

export const metadata: Metadata = {
  title: "Subsea Test Lab: project info",
};

export default function InfoPage() {
  return <InfoSheet />;
}
