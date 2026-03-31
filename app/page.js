"use client";
import PasswordGate from "@/components/PasswordGate";
import MainApp from "@/components/MainApp";

export default function Home() {
  return (
    <PasswordGate>
      <MainApp />
    </PasswordGate>
  );
}
