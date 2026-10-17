import { useState } from "react";
import { useAuth } from "../auth/authContext";

export default function Dashboard() {
    const { user, signOut } = useAuth();
    const [signingOut, setSigningOut] = useState(false);

    const firstName = user?.name.split(" ")[0] ?? "there";

    const handleSignOut = async () => {
        setSigningOut(true);
        // signOut always flips the app back to the landing page, even if the
        // request fails, so there's nothing to reset here afterwards.
        await signOut().catch(() => {});
    };

    return (
        <div className="min-h-screen bg-background text-text">
            <header className="border-b border-border/30 bg-surface">
                <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
                    <h1 className="text-xl font-bold">StudySphere</h1>

                    <div className="flex items-center gap-4">
                        <span className="hidden text-sm text-muted sm:inline">{user?.email}</span>
                        <button
                            className="rounded-lg border border-border px-4 py-2 text-sm hover:bg-background disabled:cursor-not-allowed disabled:opacity-60"
                            onClick={handleSignOut}
                            disabled={signingOut}
                        >
                            {signingOut ? "Signing out…" : "Sign out"}
                        </button>
                    </div>
                </div>
            </header>

            <main className="mx-auto max-w-5xl px-4 py-10 sm:px-6">
                <h2 className="text-3xl font-bold">Welcome, {firstName}!</h2>
                <p className="mt-2 text-muted">Your AI-powered study companion.</p>

                <section className="mt-10 rounded-2xl border-2 border-dashed border-border/40 bg-surface p-10 text-center">
                    <h3 className="text-lg font-semibold">Your study tools will live here</h3>
                    <p className="mt-2 text-muted">
                        You're signed in. The first study features are on their way.
                    </p>
                </section>
            </main>
        </div>
    );
}
