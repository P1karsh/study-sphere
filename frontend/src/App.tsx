import { useAuth } from "./auth/authContext";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";

function App() {
  const { status } = useAuth();

  if (status === "checking") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted" role="status">Loading StudySphere…</p>
      </div>
    );
  }

  return status === "signedIn" ? <Dashboard /> : <Landing />;
}

export default App;
