import AuthSheet from "../components/AuthSheet";
import { useState } from "react";

function Landing() {
  
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      {isOpen && <AuthSheet onClose={() => setIsOpen(false)} />}
      <div className="rounded-2xl bg-surface p-10 shadow-xl border-2 border-border text-center">
        <h1 className="text-5xl font-bold text-text">
          StudySphere
        </h1>

        <p className="mt-6 text-muted">
          Your AI-powered study companion.
        </p>

        <button className="mt-8 rounded-lg bg-primary px-6 py-3 font-semibold text-text transition hover:bg-primary-hover"
        onClick={() => setIsOpen(true)}>
          Get Started
        </button>
      </div>  
    </div>
  );
}

export default Landing;