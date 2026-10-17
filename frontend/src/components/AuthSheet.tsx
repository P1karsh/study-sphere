import { useState} from "react";

function AuthSheet({onClose}: { onClose: () => void }) {

    const [mode, setMode] = useState("Signin");

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [name, setName] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");

    const [error, setError] = useState("");

    const handleSubmit = (s: React.SubmitEvent<HTMLFormElement>) => {
        s.preventDefault();

        setError("");

        if (mode === "Signin") {
            if (!email || !password) {
                setError("Please fill in all fields");
                return;
            }

            if (!email.includes("@")) {
                setError("Please enter a valid email address");
                return;
            }

            console.log("Signing in with:", email, password);
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

            console.log("Signing up with:", name, email, password);
        }
    };

    return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        {mode==="Signin" && 
            <div className="rounded-2xl relative w-full max-w-md bg-background p-10 shadow-xl border-2 border-border">
                <h1 className="text-3xl font-bold text-text">StudySphere</h1>
                <p className="text-muted mb-8">Welcome back!</p>

                <form onSubmit={handleSubmit}>
                    <label htmlFor="email" className="block text-sm font-medium text-text mb-1">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="Email"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <label htmlFor="password" className="block text-sm font-medium text-text mt-6 mb-1">Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="Password"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />
                    
                    {error && (
                        <p className="text-danger text-sm mt-4 p-2 bg-danger/10 rounded-lg">
                            {error}
                        </p>
                    )}

                    <button type="submit" className="flex justify-center bg-success text-text hover:bg-success-hover hover:text-black text-md mt-12 w-full p-2">
                        Sign in
                    </button>

                </form>

                <button className="flex justify-center text-primary hover:text-primary-hover text-md mt-6 w-full ">Forgot Password?</button>

                <button className="flex justify-center text-primary hover:text-primary-hover text-md mt-3 w-full " onClick={() => {setMode("Signup"), setError("")}}>
                    Don't have an account? Sign up
                </button>

                <button className="rounded-xl absolute top-0 right-0 px-5 py-1 bg-danger text-text border border-border" onClick={onClose}>
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
                        placeholder="Name"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                    />

                    <label htmlFor="email" className="block text-sm font-medium text-text mt-4 mb-1">Email</label>
                    <input
                        id="email"
                        type="email"
                        placeholder="Email"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                    />

                    <label htmlFor="password" className="block text-sm font-medium text-text mt-4 mb-1">Password</label>
                    <input
                        id="password"
                        type="password"
                        placeholder="Password"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                    />

                    <label htmlFor="confirm-password" className="block text-sm font-medium text-text mt-4 mb-1">Confirm Password</label>
                    <input
                        id="confirm-password"
                        type="password"
                        placeholder="Confirm Password"
                        className="w-full rounded-lg border border-border bg-surface p-2 text-text"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                    />

                    {error && (
                        <p className="text-danger text-sm mt-4 p-2 bg-danger/10 rounded-lg">
                            {error}
                        </p>
                    )}

                    <button type="submit" className="flex justify-center bg-success text-text hover:bg-success-hover hover:text-black text-md mt-12 w-full p-2">
                        Sign up
                    </button>
                </form>

                <button className="flex justify-center text-primary hover:text-primary-hover text-md mt-3 w-full " onClick={() => {setMode("Signin"), setError("")}}>
                    Already have an account? Sign in
                </button>

                <button className="rounded-xl absolute top-0 right-0 px-5 py-1 bg-danger text-text border border-border" onClick={onClose}>
                    X   
                </button>

            </div>
        }
    </div>
  );
}

export default AuthSheet;