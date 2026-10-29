
import { useCallback, useEffect, useMemo, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? String(value)
    : date.toLocaleString();
}

function StatusPill({ children, type = "neutral" }) {
  return <span className={`status-pill ${type}`}>{children}</span>;
}

function App() {
  const [identities, setIdentities] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [search, setSearch] = useState("");
  const [activity, setActivity] = useState(null);
  const [verificationResult, setVerificationResult] = useState(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [revoking, setRevoking] = useState(false);


  const [loading, setLoading] = useState(true);
  const [registering, setRegistering] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const request = useCallback(async (url, options = {}) => {
    const response = await fetch(`${API_URL}${url}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        data.message ||
          data.error ||
          `Request failed (${response.status})`
      );
    }

    return data;
  }, []);

  const loadIdentities = useCallback(
    async (preferredId = "") => {
      const data = await request("/identity");

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.identities)
          ? data.identities
          : [];

      setIdentities(list);

      setSelectedId((current) => {
        const preferred = preferredId || current;

        if (
          list.some(
            (identity) =>
              String(identity.id) === String(preferred)
          )
        ) {
          return String(preferred);
        }

        return list.length ? String(list[0].id) : "";
      });

      return list;
    },
    [request]
  );

  const loadActivity = useCallback(
    async (id) => {
      if (!id) {
        setActivity(null);
        return;
      }

      try {
        const data = await request(
          `/identity/${encodeURIComponent(id)}/activity`
        );
        setActivity(data);
      } catch {
        setActivity(null);
      }
    },
    [request]
  );

  useEffect(() => {
    let active = true;

    async function initialise() {
      setLoading(true);
      setError("");

      try {
        const data = await request("/identity");

        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.identities)
            ? data.identities
            : [];

        if (!active) return;

        setIdentities(list);
        setSelectedId(
          list.length ? String(list[0].id) : ""
        );
      } catch (err) {
        if (active) {
          setError(
            `Could not load identities. ${err.message}`
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    initialise();

    return () => {
      active = false;
    };
  }, [request]);

  useEffect(() => {
    setVerificationResult(null);
    setSuccess("");
    setError("");
    loadActivity(selectedId);
  }, [selectedId, loadActivity]);

  // Only consider the selected identity valid if it exists
  // in the registered list AND matches the current search.
  const selectedIdentity = useMemo(() => {
    const query = search.trim().toLowerCase();

    const selected = identities.find(
      (item) => String(item.id) === String(selectedId)
    );

    if (!selected) return null;
    if (!query) return selected;

    const values = [
      selected.name,
      selected.email,
      selected.did,
      selected.id,
    ];

    return values.some((value) =>
      String(value ?? "").toLowerCase().includes(query)
    )
      ? selected
      : null;
  }, [identities, selectedId, search]);

  const filteredIdentities = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return identities;

    return identities.filter((identity) =>
      [
        identity.name,
        identity.email,
        identity.did,
        identity.id,
      ].some((value) =>
        String(value ?? "").toLowerCase().includes(query)
      )
    );
  }, [identities, search]);

  const stats = activity?.stats || {};
  const events = Array.isArray(activity?.events)
    ? activity.events
    : [];

  const riskScore =
    verificationResult?.ai?.riskScore ??
    activity?.ai?.riskScore;

  const aiStatus =
    verificationResult?.ai?.status ??
    activity?.ai?.status;

  function beginEditIdentity() {
    if (!selectedIdentity) return;

    setEditName(selectedIdentity.name || "");
    setEditEmail(selectedIdentity.email || "");
    setEditMode(true);
    setError("");
    setSuccess("");
  }

  function cancelEditIdentity() {
    setEditMode(false);
    setEditName("");
    setEditEmail("");
  }

  async function saveIdentityChanges() {
    if (!selectedIdentity) return;

    if (!editName.trim() || !editEmail.trim()) {
      setError("Enter both the name and email address.");
      return;
    }

    setError("");
    setSuccess("");
    setSavingEdit(true);

    try {
      await request(`/identity/${encodeURIComponent(selectedIdentity.id)}`, {
        method: "PUT",
        body: JSON.stringify({
          name: editName.trim(),
          email: editEmail.trim(),
        }),
      });

      await loadIdentities(selectedIdentity.id);
      setEditMode(false);
      setSuccess("Identity details updated successfully.");
    } catch (err) {
      setError(`Could not update identity: ${err.message}`);
    } finally {
      setSavingEdit(false);
    }
  }

  async function revokeSelectedIdentity() {
    if (!selectedIdentity) return;

    const isActive =
      selectedIdentity.active === true ||
      Number(selectedIdentity.active ?? 1) === 1;

    if (!isActive) {
      setError("This identity has already been revoked.");
      return;
    }

    const confirmed = window.confirm(
      `Revoke the identity for ${selectedIdentity.name || "this person"}? ` +
      "This will deactivate it on the blockchain and prevent future verification. " +
      "The identity record and its history will be preserved."
    );

    if (!confirmed) return;

    setError("");
    setSuccess("");
    setVerificationResult(null);
    setRevoking(true);

    try {
      const result = await request(
        `/identity/${encodeURIComponent(selectedIdentity.id)}/revoke`,
        { method: "POST", body: JSON.stringify({}) }
      );

      await loadIdentities(selectedIdentity.id);
      await loadActivity(selectedIdentity.id);

      setEditMode(false);
      setSuccess(
        result.message || "Identity revoked successfully."
      );
    } catch (err) {
      setError(`Could not revoke identity: ${err.message}`);
    } finally {
      setRevoking(false);
    }
  }

  async function registerIdentity(event) {
    event.preventDefault();

    setError("");
    setSuccess("");
    setVerificationResult(null);

    if (!name.trim() || !email.trim()) {
      setError(
        "Enter both the person's name and email address."
      );
      return;
    }

    setRegistering(true);

    try {
      const result = await request("/identity/register", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
        }),
      });

      const created = result.identity || result;
      const newId = created.id ?? result.id;

      setName("");
      setEmail("");

      setSuccess(
        `Identity registered successfully${
          newId !== undefined ? ` (ID ${newId})` : ""
        }.`
      );

      const list = await loadIdentities(newId ?? "");

      if (
        newId !== undefined &&
        list.some(
          (item) => String(item.id) === String(newId)
        )
      ) {
        setSelectedId(String(newId));
        setSearch("");
      }
    } catch (err) {
      setError(`Registration failed: ${err.message}`);
    } finally {
      setRegistering(false);
    }
  }

  async function verifyIdentity() {
    // Never send a verification request when the search
    // has no matching registered identity.
    if (!selectedIdentity) {
      setError(
        "Access denied: no matching registered identity was found."
      );
      setSuccess("");
      setVerificationResult(null);
      return;
    }

    setError("");
    setSuccess("");
    setVerificationResult(null);
    setVerifying(true);

    try {
      const result = await request(
        `/identity/${encodeURIComponent(selectedIdentity.id)}/verify`,
        {
          method: "POST",
          body: JSON.stringify({}),
        }
      );

      setVerificationResult(result);

      if (result.verified !== true) {
        setError(
          result.message ||
            "Identity verification failed. Access denied."
        );
      } else if (result.accessGranted === true) {
        setSuccess(
          "Identity verified successfully. Access granted."
        );
      } else {
        setError(
          result.message ||
            `Identity authenticated, but access was denied. Security decision: ${
              result.securityDecision || "ACCESS_DENIED"
            }.`
        );
      }

      await loadActivity(selectedIdentity.id);
    } catch (err) {
      setVerificationResult(null);
      setSuccess("");
      setError(`Verification failed: ${err.message}`);
    } finally {
      setVerifying(false);
    }
  }

  const blockchainVerified =
    verificationResult?.blockchain?.verified === true;

  const blockchainActive =
    verificationResult?.blockchain?.active === true;

  const cryptoVerified =
    verificationResult?.verified === true;

  const accessGranted =
    verificationResult?.verified === true &&
    verificationResult?.accessGranted === true;

  const hasVerification = verificationResult !== null;

  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#dashboard"
          aria-label="ImaraID dashboard"
        >
          <span className="brand-mark">I</span>
          <span>
            <strong>
              Imara<span>ID</span>
            </strong>
            <small>Digital identity security</small>
          </span>
        </a>

        <div className="topbar-right">
          <span className="system-indicator">
            <span />
            Local system
          </span>
          <a className="topbar-link" href="#dashboard">
            Dashboard
          </a>
        </div>
      </header>

      <main id="dashboard" className="page-content">
        <section className="welcome-section">
          <div>
            <p className="eyebrow">
              IDENTITY ASSURANCE PLATFORM
            </p>
            <h1>Identity security dashboard</h1>
            <p className="welcome-copy">
              Register digital identities, verify authenticity
              and review AI-assisted security decisions.
            </p>
          </div>

          <div className="header-chip">
            <span className="chip-icon">◆</span>
            Blockchain + AI
          </div>
        </section>

        {error && (
          <div className="notice error-notice" role="alert">
            <strong>Access or operation error</strong>
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError("")}
              aria-label="Dismiss error"
            >
              ×
            </button>
          </div>
        )}

        {success && (
          <div
            className="notice success-notice"
            role="status"
          >
            <strong>Success</strong>
            <span>{success}</span>
            <button
              type="button"
              onClick={() => setSuccess("")}
              aria-label="Dismiss message"
            >
              ×
            </button>
          </div>
        )}

        <section
          className="metric-grid"
          aria-label="Identity activity summary"
        >
          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-icon indigo">ID</span>
              <span className="metric-label">REGISTERED</span>
            </div>
            <strong className="metric-value">
              {loading ? "…" : identities.length}
            </strong>
            <span className="metric-foot">
              Identities in the registry
            </span>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-icon teal">✓</span>
              <span className="metric-label">
                VERIFICATION ATTEMPTS
              </span>
            </div>
            <strong className="metric-value">
              {stats.verificationAttempts ?? 0}
            </strong>
            <span className="metric-foot">
              For the selected identity
            </span>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-icon amber">!</span>
              <span className="metric-label">
                FAILED ATTEMPTS
              </span>
            </div>
            <strong className="metric-value">
              {stats.failedVerifications ?? 0}
            </strong>
            <span className="metric-foot">
              Recorded unsuccessful attempts
            </span>
          </article>

          <article className="metric-card">
            <div className="metric-top">
              <span className="metric-icon blue">AI</span>
              <span className="metric-label">
                AI RISK SCORE
              </span>
            </div>
            <strong className="metric-value">
              {riskScore === undefined || riskScore === null
                ? "—"
                : Number(riskScore).toFixed(1)}
            </strong>
            <span className="metric-foot">
              {aiStatus || "Run verification for analysis"}
            </span>
          </article>
        </section>

        <div className="main-grid">
          <section className="panel registration-panel">
            <div className="panel-heading">
              <div className="section-icon">＋</div>
              <div>
                <h2>Register an identity</h2>
                <p>Create a digital identity record</p>
              </div>
            </div>

            <form
              className="identity-form"
              onSubmit={registerIdentity}
            >
              <label htmlFor="person-name">Full name</label>
              <input
                id="person-name"
                value={name}
                onChange={(event) =>
                  setName(event.target.value)
                }
                placeholder="Enter full name"
                autoComplete="name"
                required
              />

              <label htmlFor="person-email">
                Email address
              </label>
              <input
                id="person-email"
                type="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="person@example.com"
                autoComplete="email"
                required
              />

              <button
                className="primary-button"
                type="submit"
                disabled={registering}
              >
                {registering
                  ? "Registering identity…"
                  : "Register identity"}
                {!registering && <span>→</span>}
              </button>
            </form>

            <div className="info-note">
              <span>i</span>
              <p>
                Registration creates the identity record and
                initiates the configured identity and
                blockchain workflow.
              </p>
            </div>
          </section>

          <section className="panel verification-panel">
            <div className="panel-heading">
              <div className="section-icon verify-icon">
                ✓
              </div>
              <div>
                <h2>Verify an identity</h2>
                <p>Find and verify a registered record</p>
              </div>
            </div>

            <label htmlFor="identity-search">
              Search registered identities
            </label>
            <input
              id="identity-search"
              className="search-input"
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
              placeholder="Search by name, email, DID or ID…"
            />

            <label htmlFor="identity-select">
              Select identity
            </label>
            <select
              id="identity-select"
              value={
                selectedIdentity ? String(selectedId) : ""
              }
              onChange={(event) =>
                setSelectedId(event.target.value)
              }
              disabled={
                loading || filteredIdentities.length === 0
              }
            >
              <option value="">
                {filteredIdentities.length === 0
                  ? "No matching identities"
                  : "Select a registered identity"}
              </option>

              {filteredIdentities.map((identity) => (
                <option
                  key={identity.id}
                  value={String(identity.id)}
                >
                  {identity.name || "Unnamed identity"} ·{" "}
                  {identity.email || `ID ${identity.id}`}
                </option>
              ))}
            </select>

            {selectedIdentity ? (
              <>
                <div className="selected-identity">
                  <div className="avatar">
                    {(selectedIdentity.name || "I").trim().charAt(0).toUpperCase()}
                  </div>
                  <div className="selected-details">
                    <strong>{selectedIdentity.name || "Unnamed identity"}</strong>
                    <span>{selectedIdentity.email || "No email recorded"}</span>
                    <small>{selectedIdentity.did || `Identity ID: ${selectedIdentity.id}`}</small>
                  </div>
                  <StatusPill
                    type={
                      selectedIdentity.active === false ||
                      Number(selectedIdentity.active ?? 1) === 0
                        ? "bad" : "good"
                    }
                  >
                    {selectedIdentity.active === false ||
                    Number(selectedIdentity.active ?? 1) === 0
                      ? "Revoked" : "Active"}
                  </StatusPill>
                </div>

                <div className="identity-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={editMode ? cancelEditIdentity : beginEditIdentity}
                    disabled={savingEdit || revoking}
                  >
                    {editMode ? "Cancel edit" : "Edit identity"}
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={revokeSelectedIdentity}
                    disabled={
                      savingEdit || revoking ||
                      selectedIdentity.active === false ||
                      Number(selectedIdentity.active ?? 1) === 0
                    }
                  >
                    {revoking ? "Revoking…" : "Revoke identity"}
                  </button>
                </div>

                {editMode && (
                  <form
                    className="identity-edit-form"
                    onSubmit={(event) => {
                      event.preventDefault();
                      saveIdentityChanges();
                    }}
                  >
                    <h3>Edit identity details</h3>
                    <label htmlFor="edit-identity-name">Full name</label>
                    <input
                      id="edit-identity-name"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      required
                      maxLength={120}
                      disabled={savingEdit}
                    />
                    <label htmlFor="edit-identity-email">Email address</label>
                    <input
                      id="edit-identity-email"
                      type="email"
                      value={editEmail}
                      onChange={(event) => setEditEmail(event.target.value)}
                      required
                      maxLength={254}
                      disabled={savingEdit}
                    />
                    <button className="primary-button" type="submit" disabled={savingEdit}>
                      {savingEdit ? "Saving changes…" : "Save changes"}
                    </button>
                  </form>
                )}
              </>
            ) : (
              <div className="empty-selection">
                {loading ? "Loading identity records…" : "No registered identity matches your search."}
              </div>
            )}

            <button
              className="primary-button verify-button"
              type="button"
              onClick={verifyIdentity}
              disabled={
                verifying || loading || !selectedIdentity ||
                selectedIdentity.active === false ||
                Number(selectedIdentity.active ?? 1) === 0
              }
            >
              {verifying
                ? "Verifying identity…"
                : "Verify selected identity"}
              {!verifying && <span>→</span>}
            </button>

            <p className="form-helper">
              Only a matching registered identity can be
              submitted for verification. A name search alone
              does not authenticate a person.
            </p>
          </section>
        </div>

        <section className="panel results-panel">
          <div className="panel-heading results-heading">
            <div className="section-icon result-icon">
              ✓
            </div>
            <div>
              <h2>Security verification result</h2>
              <p>
                Cryptographic, blockchain and AI assessment
              </p>
            </div>

            {hasVerification && (
              <StatusPill
                type={accessGranted ? "good" : "bad"}
              >
                {accessGranted
                  ? "Access granted"
                  : "Access denied"}
              </StatusPill>
            )}
          </div>

          {!hasVerification ? (
            <div className="result-empty">
              <div className="empty-shield">◇</div>
              <strong>No new verification result</strong>
              <p>
                Select a registered identity and run
                verification to view its security assessment
                here.
              </p>
            </div>
          ) : (
            <>
              <div className="result-summary">
                <div>
                  <span className="result-caption">
                    SECURITY DECISION
                  </span>
                  <h3>
                    {verificationResult.securityDecision ||
                      (accessGranted
                        ? "VERIFIED"
                        : "NOT VERIFIED")}
                  </h3>
                  <p>
                    {verificationResult.message ||
                      "Verification request completed."}
                  </p>
                </div>

                <StatusPill
                  type={accessGranted ? "good" : "bad"}
                >
                  {accessGranted
                    ? "Access granted"
                    : "Access not granted"}
                </StatusPill>
              </div>

              <div className="checks-grid">
                <div className="check-card">
                  <span className="check-label">
                    Cryptographic verification
                  </span>
                  <StatusPill
                    type={cryptoVerified ? "good" : "bad"}
                  >
                    {cryptoVerified
                      ? "Verified"
                      : "Not verified"}
                  </StatusPill>
                  <small>
                    Digital signature and identity verification
                    result
                  </small>
                </div>

                <div className="check-card">
                  <span className="check-label">
                    Blockchain record
                  </span>
                  <StatusPill
                    type={
                      blockchainVerified && blockchainActive
                        ? "good"
                        : "bad"
                    }
                  >
                    {blockchainVerified && blockchainActive
                      ? "Verified and active"
                      : "Not confirmed"}
                  </StatusPill>
                  <small>
                    {verificationResult.blockchain
                      ?.contractAddress
                      ? `Contract: ${verificationResult.blockchain.contractAddress}`
                      : "Based on the returned blockchain verification response"}
                  </small>
                </div>

                <div className="check-card">
                  <span className="check-label">
                    AI risk assessment
                  </span>
                  <StatusPill
                    type={
                      verificationResult.ai?.anomaly
                        ? "bad"
                        : "neutral"
                    }
                  >
                    {verificationResult.ai?.status ||
                      "No status returned"}
                  </StatusPill>
                  <small>
                    Risk score:{" "}
                    {verificationResult.ai?.riskScore ??
                      "Not provided"}
                    {verificationResult.ai?.anomaly === true
                      ? " · Anomaly detected"
                      : ""}
                  </small>
                </div>
              </div>

              {verificationResult.blockchain?.identityHash && (
                <div className="hash-row">
                  <span>Blockchain identity hash</span>
                  <code>
                    {verificationResult.blockchain.identityHash}
                  </code>
                </div>
              )}
            </>
          )}
        </section>

        <section className="panel activity-panel">
          <div className="panel-heading activity-heading">
            <div className="section-icon activity-icon">
              ≋
            </div>
            <div>
              <h2>Identity activity</h2>
              <p>
                Recent events for the selected identity
              </p>
            </div>

            <button
              className="secondary-button"
              type="button"
              onClick={() => loadActivity(selectedId)}
              disabled={!selectedId}
            >
              Refresh activity
            </button>
          </div>

          {!selectedId ? (
            <div className="table-empty">
              Register or select an identity to view its
              activity.
            </div>
          ) : events.length === 0 ? (
            <div className="table-empty">
              No activity events are available for this
              identity yet.
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event ID</th>
                    <th>Event type</th>
                    <th>Outcome</th>
                    <th>IP address</th>
                    <th>Date and time</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((event, index) => (
                    <tr
                      key={
                        event.id ??
                        `${event.createdAt}-${index}`
                      }
                    >
                      <td>{event.id ?? "—"}</td>
                      <td>
                        {({
                          IDENTITY_REGISTERED: "Identity registered",
                          IDENTITY_UPDATED: "Identity updated",
                          IDENTITY_REVOKED: "Identity revoked",
                          VERIFICATION_SUCCEEDED: "Verification",
                          VERIFICATION_FAILED: "Verification",
                        })[event.eventType] || event.eventType || "Verification"}
                      </td>
                      <td>
                        <StatusPill
                          type={
                            event.eventType === "IDENTITY_REVOKED"
                              ? "bad"
                              : event.eventType === "IDENTITY_REGISTERED" ||
                                event.eventType === "IDENTITY_UPDATED"
                                ? "good"
                                : event.success ? "good" : "bad"
                          }
                        >
                          {event.eventType === "IDENTITY_REGISTERED"
                            ? "Registered"
                            : event.eventType === "IDENTITY_UPDATED"
                              ? "Updated"
                              : event.eventType === "IDENTITY_REVOKED"
                                ? "Revoked"
                                : event.success ? "Successful" : "Unsuccessful"}
                        </StatusPill>
                      </td>
                      <td>{event.ipAddress || "—"}</td>
                      <td>{formatDate(event.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <footer className="page-footer">
          <span>
            <strong>ImaraID</strong> · AI-enhanced blockchain
            identity security
          </span>
          <span>Local development environment</span>
        </footer>
      </main>
    </div>
  );
}

export default App;
