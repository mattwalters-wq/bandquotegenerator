"use client";
import PasswordGate from "@/components/PasswordGate";
import EditorPage from "@/components/EditorPage";

export default function Home() {
  return (
    <PasswordGate>
      <EditorPage />
    </PasswordGate>
  );
}
