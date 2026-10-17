import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import App from "../App";
import AuthProvider from "../auth/AuthProvider";
import { ada, callsTo, deferred, fakeApi } from "./fakeApi";

const signedOut = { status: 401, body: { detail: "Not signed in" } };

function renderApp() {
  const user = userEvent.setup();
  render(
    <AuthProvider>
      <App />
    </AuthProvider>,
  );
  return user;
}

async function openSheet(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole("button", { name: "Get Started" }));
}

describe("starting state", () => {
  it("shows the landing page when there is no session", async () => {
    fakeApi({ "GET /api/auth/me": signedOut });
    renderApp();
    expect(await screen.findByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("goes straight to the dashboard when a session already exists", async () => {
    fakeApi({ "GET /api/auth/me": { status: 200, body: ada } });
    renderApp();
    expect(await screen.findByText("Welcome, Ada!")).toBeInTheDocument();
  });

  it("falls back to the landing page if the server can't be reached", async () => {
    fakeApi({ "GET /api/auth/me": "network-error" });
    renderApp();
    expect(await screen.findByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });
});

describe("switching between sign in and sign up", () => {
  it("keeps typed values and clears the error", async () => {
    fakeApi({ "GET /api/auth/me": signedOut });
    const user = renderApp();
    await openSheet(user);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.click(screen.getByRole("button", { name: "Sign in" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Please fill in all fields");

    await user.click(screen.getByRole("button", { name: /Sign up/ }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");

    await user.type(screen.getByLabelText("Name"), "Ada");
    await user.click(screen.getByRole("button", { name: /Sign in/ }));
    await user.click(screen.getByRole("button", { name: /Sign up/ }));
    expect(screen.getByLabelText("Name")).toHaveValue("Ada");
  });
});

describe("client-side validation", () => {
  it.each([
    [{ name: "Ada", email: "ada@example.com", password: "12345678", confirm: "" }, "Please fill in all fields"],
    [{ name: "Ada", email: "ada@example.com", password: "short", confirm: "short" }, "Password must be at least 8 characters"],
    [{ name: "Ada", email: "ada@example.com", password: "12345678", confirm: "87654321" }, "Passwords do not match"],
  ])("blocks sign up without calling the API: %o", async (fields, message) => {
    const fetchMock = fakeApi({ "GET /api/auth/me": signedOut });
    const user = renderApp();
    await openSheet(user);
    await user.click(screen.getByRole("button", { name: /Sign up/ }));

    await user.type(screen.getByLabelText("Name"), fields.name);
    await user.type(screen.getByLabelText("Email"), fields.email);
    await user.type(screen.getByLabelText("Password"), fields.password);
    if (fields.confirm) await user.type(screen.getByLabelText("Confirm Password"), fields.confirm);
    await user.click(screen.getByRole("button", { name: "Sign up" }));

    expect(screen.getByRole("alert")).toHaveTextContent(message);
    expect(callsTo(fetchMock, "POST", "/api/auth/register")).toHaveLength(0);
  });
});

describe("signing in", () => {
  it("shows the dashboard after a successful sign in", async () => {
    const fetchMock = fakeApi({
      "GET /api/auth/me": signedOut,
      "POST /api/auth/login": { status: 200, body: ada },
    });
    const user = renderApp();
    await openSheet(user);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "analytical-engine");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByText("Welcome, Ada!")).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, "POST", "/api/auth/login")[0];
    expect(JSON.parse(init!.body as string)).toEqual({ email: "ada@example.com", password: "analytical-engine" });
    expect(init!.credentials).toBe("include");
  });

  it("shows the server's error and keeps what was typed", async () => {
    fakeApi({
      "GET /api/auth/me": signedOut,
      "POST /api/auth/login": { status: 401, body: { detail: "Invalid email or password" } },
    });
    const user = renderApp();
    await openSheet(user);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "wrong-password");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(screen.getByLabelText("Email")).toHaveValue("ada@example.com");
    expect(screen.getByLabelText("Password")).toHaveValue("wrong-password");
    expect(screen.getByRole("button", { name: "Sign in" })).toBeEnabled();
  });

  it("explains when the network is down", async () => {
    fakeApi({ "GET /api/auth/me": signedOut, "POST /api/auth/login": "network-error" });
    const user = renderApp();
    await openSheet(user);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "analytical-engine");
    await user.click(screen.getByRole("button", { name: "Sign in" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Can't reach StudySphere");
  });

  it("disables the button while waiting and only sends one request", async () => {
    const pending = deferred<{ status: number; body?: unknown }>();
    const fetchMock = fakeApi({
      "GET /api/auth/me": signedOut,
      "POST /api/auth/login": () => pending.promise,
    });
    const user = renderApp();
    await openSheet(user);

    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "analytical-engine");

    // Two submits back to back, before React has re-rendered with the button
    // disabled - the case a plain state check would miss.
    const form = screen.getByLabelText("Password").closest("form")!;
    act(() => {
      fireEvent.submit(form);
      fireEvent.submit(form);
    });

    expect(screen.getByRole("button", { name: "Signing in…" })).toBeDisabled();
    expect(callsTo(fetchMock, "POST", "/api/auth/login")).toHaveLength(1);

    pending.resolve({ status: 200, body: ada });
    expect(await screen.findByText("Welcome, Ada!")).toBeInTheDocument();
  });
});

describe("signing up", () => {
  async function fillSignUp(user: ReturnType<typeof userEvent.setup>) {
    await openSheet(user);
    await user.click(screen.getByRole("button", { name: /Sign up/ }));
    await user.type(screen.getByLabelText("Name"), "Ada Lovelace");
    await user.type(screen.getByLabelText("Email"), "ada@example.com");
    await user.type(screen.getByLabelText("Password"), "analytical-engine");
    await user.type(screen.getByLabelText("Confirm Password"), "analytical-engine");
    await user.click(screen.getByRole("button", { name: "Sign up" }));
  }

  it("creates the account and signs the user in", async () => {
    const fetchMock = fakeApi({
      "GET /api/auth/me": signedOut,
      "POST /api/auth/register": { status: 201, body: ada },
    });
    const user = renderApp();
    await fillSignUp(user);

    expect(await screen.findByText("Welcome, Ada!")).toBeInTheDocument();
    const [, init] = callsTo(fetchMock, "POST", "/api/auth/register")[0];
    // The confirmation is checked in the browser and never sent.
    expect(JSON.parse(init!.body as string)).toEqual({
      name: "Ada Lovelace",
      email: "ada@example.com",
      password: "analytical-engine",
    });
  });

  it("shows a duplicate-email error from the server", async () => {
    fakeApi({
      "GET /api/auth/me": signedOut,
      "POST /api/auth/register": { status: 409, body: { detail: "An account with this email already exists" } },
    });
    const user = renderApp();
    await fillSignUp(user);

    expect(await screen.findByRole("alert")).toHaveTextContent("An account with this email already exists");
    expect(screen.getByLabelText("Name")).toHaveValue("Ada Lovelace");
  });
});

describe("signing out and expired sessions", () => {
  it("signs out and returns to the landing page", async () => {
    const fetchMock = fakeApi({
      "GET /api/auth/me": { status: 200, body: ada },
      "POST /api/auth/logout": { status: 204 },
    });
    const user = renderApp();

    await user.click(await screen.findByRole("button", { name: "Sign out" }));

    expect(await screen.findByRole("button", { name: "Get Started" })).toBeInTheDocument();
    expect(callsTo(fetchMock, "POST", "/api/auth/logout")).toHaveLength(1);
  });

  it("still leaves the dashboard if the sign out request fails", async () => {
    fakeApi({ "GET /api/auth/me": { status: 200, body: ada }, "POST /api/auth/logout": "network-error" });
    const user = renderApp();

    await user.click(await screen.findByRole("button", { name: "Sign out" }));
    expect(await screen.findByRole("button", { name: "Get Started" })).toBeInTheDocument();
  });

  it("drops back to the landing page when the session has expired", async () => {
    let sessionValid = true;
    fakeApi({
      "GET /api/auth/me": () => (sessionValid ? { status: 200, body: ada } : signedOut),
    });
    renderApp();
    expect(await screen.findByText("Welcome, Ada!")).toBeInTheDocument();

    sessionValid = false;
    document.dispatchEvent(new Event("visibilitychange"));

    await waitFor(() => expect(screen.getByRole("button", { name: "Get Started" })).toBeInTheDocument());
  });
});

describe("forgot password", () => {
  it("says honestly that reset isn't available yet", async () => {
    fakeApi({ "GET /api/auth/me": signedOut });
    const user = renderApp();
    await openSheet(user);

    await user.click(screen.getByRole("button", { name: "Forgot Password?" }));
    expect(screen.getByRole("status")).toHaveTextContent("Password reset isn't available yet");
  });
});
