import { useRef, useState } from "react";
import { useAuth } from "../auth/authContext";
import { ApiError } from "../lib/api";

type Mode = "Signin" | "Signup";

function AuthSheet({onClose}: { onClose: () => void }) {

    const { signIn, signUp } = useAuth();

    const [mode, setMode] = useState<Mode>("Signin");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [submitting, setSubmitting] = useState(false);
    // State updates are async, so two very quick clicks could both see
    // submitting === false. A ref flips immediately.
    const inFlight = useRef(false);

    // Field values are kept on purpose so switching back and forth doesn't
    // make people retype anything. Only the messages are cleared.
    const switchMode = (nextMode: Mode) => {
        setMode(nextMode);
        setError("");
        setNotice("");
    };

    // On success the auth state flips to signed in and the app swaps the
    // landing page (and this sheet) for the dashboard, so there's nothing
    // else to do here. On failure, keep everything the user typed.
    const submit = async (request: () => Promise<void>) => {
        inFlight.current = true;
        setSubmitting(true);
        try {
            await request();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : "Something went wrong. Please try again.");
            setSubmitting(false);
        } finally {
            inFlight.current = false;
        }
    };

    const handleSubmit = (s: React.SubmitEvent<HTMLFormElement>) => {
        s.preventDefault();

        // Stops a double click or a held Enter key from sending twice.
        if (inFlight.current) return;

        setError("");
        setNotice("");

        if (mode === "Signin") {
            if (!email || !password) {
                setError("Please fill in all fields");
                return;
            }

            if (!email.includes("@")) {
                setError("Please enter a valid email address");
                return;
            }

            submit(() => signIn(email, password));
        }

        else if (mode === "Signup") {
            if (!name || !email || !password || !confirmPassword) {
                setError("Please fill in all fields");
                return;
            }

            if (!email.includes("@")) {
                setError("Please enter a valid email address");
                return;
            }

            if (password.length < 8) {
                setError("Password must be at least 8 characters");
                return;
            }

            if (password !== confirmPassword) {
                setError("Passwords do not match");
                return;
            }

            submit(() => signUp(name, email, password));
        }
    };

    // There's no email service yet, so we can't send reset links. Say so
    // instead of pretending something happened.
    const handleForgotPassword = () => {
        setError("");
        setNotice("Password reset isn't available yet. It's on the way!");
    };

    return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4" role="dialog" aria-modal="true" aria-label={mode === "Signin" ? "Sign in" : "Sign up"}>
        {mode==="Signin" && 
            <div className="rounded-2xl relative w-full max-w-md bg-background p-10 shadow-xl border-2 border-border">
                <h1 className="text-3xl font-bold text-text">StudySphere</h1>
                <p className="text-muted mb-8">Welcome back!</p>

                <form onSubmit={handleSubmit}>
                    <label htmlFor="email" className="block text-sm font-medium text-text mb-1">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Email"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <label htmlFor="password" className="block text-sm font-medium text-text mt-6 mb-1">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="current-password"
                        placeholder="Password"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    
                    {error && (
                        <p className="text-danger text-sm mt-4 p-2 bg-danger/10 rounded-lg" role="alert">
                            {error}
                        </p>
                    )}

                    {notice && (
                        <p className="text-muted text-sm mt-4 p-2 bg-surface rounded-lg" role="status">
                            {notice}
                        </p>
                    )}

                    <button type="submit" className="flex justify-center bg-success text-text hover:bg-success-hover hover:text-black text-md mt-12 w-full p-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-success disabled:hover:text-text" disabled={submitting}>
                        {submitting ? "Signing in…" : "Sign in"}
                    </button>

                </form>

                <button className="flex justify-center text-primary hover:text-primary-hover text-md mt-6 w-full " onClick={handleForgotPassword}>Forgot Password?</button>

                <button className="flex justify-center text-primary hover:text-primary-hover text-md mt-3 w-full " onClick={() => switchMode("Signup")} disabled={submitting}>
                    Don't have an account? Sign up
                </button>

                <button className="rounded-xl absolute top-0 right-0 px-5 py-1 bg-danger text-text border border-border" onClick={onClose} aria-label="Close">
                    X   
                </button>

            </div>
        }

        {mode==="Signup" &&
            <div className="rounded-2xl relative w-full max-w-md bg-background p-10 shadow-xl border-2 border-border">
                <h1 className="text-3xl font-bold text-text">StudySphere</h1>
                <p className="text-muted mb-8">Let's get started!</p>


                <form onSubmit={handleSubmit}>
                    <label htmlFor="name" className="block text-sm font-medium text-text mb-1">Name</label>
                    <input
                        id="name"
                        type="text"
                        autoComplete="name"
                        placeholder="Name"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <label htmlFor="email" className="block text-sm font-medium text-text mt-4 mb-1">Email</label>
                    <input
                        id="email"
                        type="email"
                        autoComplete="email"
                        placeholder="Email"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <label htmlFor="password" className="block text-sm font-medium text-text mt-4 mb-1">Password</label>
                    <input
                        id="password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Password"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <label htmlFor="confirm-password" className="block text-sm font-medium text-text mt-4 mb-1">Confirm Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        autoComplete="new-password"
                        placeholder="Confirm Password"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {error && (
                        <p className="text-danger text-sm mt-4 p-2 bg-danger/10 rounded-lg" role="alert">
                            {error}
                        </p>
                    )}

                    <button type="submit" className="flex justify-center bg-success text-text hover:bg-success-hover hover:text-black text-md mt-12 w-full p-2 disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:bg-success disabled:hover:text-text" disabled={submitting}>
                        {submitting ? "Creating account…" : "Sign up"}
                    </button>
                </form>

                <button className="flex justify-center text-primary hover:text-primary-hover text-md mt-3 w-full " onClick={() => switchMode("Signin")} disabled={submitting}>
                    Already have an account? Sign in
                </button>

                <button className="rounded-xl absolute top-0 right-0 px-5 py-1 bg-danger text-text border border-border" onClick={onClose} aria-label="Close">
                    X   
                </button>

            </div>
        }
    </div>
  );
}

export default AuthSheet;