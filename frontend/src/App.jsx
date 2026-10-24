import { useEffect, useState } from "react";
import "./App.css";

const API_URL = "http://localhost:5000/api";

function App() {
const [identities, setIdentities] = useState([]);
const [selectedId, setSelectedId] = useState(null);
const [activity, setActivity] = useState(null);

const [loading, setLoading] = useState(true);
const [registering, setRegistering] = useState(false);
const [verifying, setVerifying] = useState(false);

const [error, setError] = useState("");
const [success, setSuccess] = useState("");
const [verificationResult, setVerificationResult] = useState(null);

const [name, setName] = useState("");
const [email, setEmail] = useState("");

// --------------------------------------------------
// LOAD IDENTITIES
// --------------------------------------------------

const loadIdentities = async () => {
try {
const response = await fetch(`${API_URL}/identity`);


  if (!response.ok) {
    throw new Error("Failed to load identities");
  }

  const data = await response.json();

  const list = Array.isArray(data)
    ? data
    : Array.isArray(data.identities)
    ? data.identities
    : [];

  setIdentities(list);

  // Keep current selection if it still exists.
  if (
    selectedId &&
    list.some((identity) => identity.id === selectedId)
  ) {
    return list;
  }

  // Otherwise select the newest identity.
  if (list.length > 0) {
    setSelectedId(list[0].id);
  } else {
    setSelectedId(null);
  }

  return list;
} catch (err) {
  console.error("Identity loading error:", err);
  setError(err.message || "Failed to load identities.");
  return [];
}


};

// --------------------------------------------------
// LOAD ACTIVITY
// --------------------------------------------------

const loadActivity = async (identityId) => {
if (!identityId) {
setActivity(null);
setLoading(false);
return;
}


setLoading(true);
setError("");

try {
  const response = await fetch(
    `${API_URL}/identity/${identityId}/activity`
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Failed to load identity activity"
    );
  }

  setActivity(data);
} catch (err) {
  console.error("Activity loading error:", err);
  setError(err.message || "Failed to load identity activity.");
  setActivity(null);
} finally {
  setLoading(false);
}


};

// --------------------------------------------------
// REGISTER IDENTITY
// --------------------------------------------------

const registerIdentity = async (event) => {
event.preventDefault();


setError("");
setSuccess("");
setVerificationResult(null);

const trimmedName = name.trim();
const trimmedEmail = email.trim();

if (!trimmedName || !trimmedEmail) {
  setError("Name and email are required.");
  return;
}

setRegistering(true);

try {
  const response = await fetch(
    `${API_URL}/identity/register`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        name: trimmedName,
        email: trimmedEmail
      })
    }
  );

  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data.message || "Identity registration failed."
    );
  }

  setSuccess(
    "Identity registered successfully. Cryptographic identity and blockchain registration completed."
  );

  setName("");
  setEmail("");

  // Refresh identity list.
  const updatedIdentities = await loadIdentities();

  // Select newly created identity.
  const newIdentityId =
    data.identity?.id ||
    data.id ||
    updatedIdentities[0]?.id;

  if (newIdentityId) {
    setSelectedId(Number(newIdentityId));
    await loadActivity(Number(newIdentityId));
  }
} catch (err) {
  console.error("Registration error:", err);
  setError(
    err.message || "Identity registration failed."
  );
} finally {
  setRegistering(false);
}


};

// --------------------------------------------------
// VERIFY IDENTITY
// --------------------------------------------------

const verifyIdentity = async () => {
if (!selectedId) {
setError("Please select an identity first.");
return;
}


setVerifying(true);
setError("");
setSuccess("");
setVerificationResult(null);

try {
  const response = await fetch(
    `${API_URL}/identity/${selectedId}/verify`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      }
    }
  );

  const data = await response.json();

  setVerificationResult(data);

  if (!response.ok) {
    setError(
      data.message || "Identity verification failed."
    );
  } else if (
    data.verified &&
    data.accessGranted
  ) {
    setSuccess(
      "Identity successfully verified. Access granted."
    );
  } else if (data.verified) {
    setError(
      data.message ||
        "Identity was verified but access was blocked."
    );
  } else {
    setError(
      data.message ||
        "Identity verification failed."
    );
  }

  // Refresh activity so the new authentication event
  // and updated AI risk score are displayed.
  await loadActivity(selectedId);
} catch (err) {
  console.error("Verification error:", err);

  setError(
    "Unable to connect to the identity verification service."
  );
} finally {
  setVerifying(false);
}


};

// --------------------------------------------------
// INITIAL LOAD
// --------------------------------------------------

useEffect(() => {
loadIdentities();
}, []);

// --------------------------------------------------
// LOAD SELECTED IDENTITY ACTIVITY
// --------------------------------------------------

useEffect(() => {
if (selectedId) {
setVerificationResult(null);
loadActivity(selectedId);
}
}, [selectedId]);

// --------------------------------------------------
// HELPERS
// --------------------------------------------------

const formatDate = (date) => {
if (!date) {
return "N/A";
}


const parsedDate = new Date(date);

if (Number.isNaN(parsedDate.getTime())) {
  return "Invalid date";
}

return parsedDate.toLocaleString();


};

const getRiskClass = (status) => {
switch (status) {
case "HIGH_RISK":
return "high";


  case "SUSPICIOUS":
    return "suspicious";

  default:
    return "normal";
}


};

const getVerificationClass = () => {
if (!verificationResult) {
return "";
}


if (
  verificationResult.verified &&
  verificationResult.accessGranted
) {
  return "verification-success";
}

return "verification-failed";


};

const selectedIdentity = identities.find(
(identity) => identity.id === selectedId
);

const events = Array.isArray(activity?.events)
? activity.events
: [];

const verificationAttempts =
activity?.stats?.verificationAttempts ?? 0;

const failedVerifications =
activity?.stats?.failedVerifications ?? 0;

const uniqueIPs =
activity?.stats?.uniqueIPs ?? 0;

const riskScore =
activity?.ai?.riskScore ?? 0;

const aiStatus =
activity?.ai?.status || "UNKNOWN";

const did =
activity?.identity?.did ||
selectedIdentity?.did ||
"DID NOT AVAILABLE";

const publicKey =
selectedIdentity?.publicKey || "";

// --------------------------------------------------
// UI
// --------------------------------------------------

return ( <div className="app">


  {/* HEADER */}

  <header className="topbar">
    <div className="brand">
      <div className="brand-icon">◆</div>

      <div>
        <h1>AIID Security</h1>
        <span>
          Self-Sovereign Identity Platform
        </span>
      </div>
    </div>

    <div className="system-status">
      <span className="status-dot"></span>
      SYSTEM ONLINE
    </div>
  </header>

  <main className="dashboard">

    {/* HERO */}

    <section className="hero">
      <div>
        <p className="eyebrow">
          AI-ENHANCED BLOCKCHAIN IDENTITY
        </p>

        <h2>
          Identity Security
          <br />
          <span>
            Intelligence Dashboard
          </span>
        </h2>

        <p className="hero-text">
          Secure digital identities using
          decentralized identifiers, blockchain
          verification, cryptography and
          AI-powered anomaly detection.
        </p>
      </div>

      <div className="hero-badge">
        <div className="shield">⬢</div>
        <span>AI PROTECTED</span>
      </div>
    </section>

    {/* REGISTER */}

    <section className="register-panel">
      <div className="register-heading">
        <p className="card-label">
          IDENTITY MANAGEMENT
        </p>

        <h3>Register New Identity</h3>

        <p>
          Create a decentralized identity and
          register its cryptographic identity
          on the blockchain.
        </p>
      </div>

      <form
        className="register-form"
        onSubmit={registerIdentity}
      >
        <div className="input-group">
          <label>FULL NAME</label>

          <input
            type="text"
            placeholder="e.g. John Kamau"
            value={name}
            onChange={(event) =>
              setName(event.target.value)
            }
            disabled={registering}
          />
        </div>

        <div className="input-group">
          <label>EMAIL ADDRESS</label>

          <input
            type="email"
            placeholder="john@example.com"
            value={email}
            onChange={(event) =>
              setEmail(event.target.value)
            }
            disabled={registering}
          />
        </div>

        <button
          type="submit"
          className="register-button"
          disabled={registering}
        >
          {registering
            ? "REGISTERING..."
            : "＋ REGISTER IDENTITY"}
        </button>
      </form>
    </section>

    {/* MESSAGES */}

    {success && (
      <div className="success-box">
        <strong>✓ SUCCESS</strong>
        <span>{success}</span>
      </div>
    )}

    {error && (
      <div className="error-box">
        <strong>System Message</strong>
        <p>{error}</p>
      </div>
    )}

    {/* IDENTITY SELECTOR */}

    <section className="control-panel">
      <div>
        <label htmlFor="identity">
          SELECT IDENTITY
        </label>

        <select
          id="identity"
          value={selectedId ?? ""}
          onChange={(event) => {
            const value = event.target.value;

            setSelectedId(
              value ? Number(value) : null
            );
          }}
          disabled={identities.length === 0}
        >
          {identities.length > 0 ? (
            identities.map((identity) => (
              <option
                key={identity.id}
                value={identity.id}
              >
                #{identity.id} — {identity.name}
              </option>
            ))
          ) : (
            <option value="">
              No identities available
            </option>
          )}
        </select>
      </div>

      <div className="identity-actions">

        <button
          className="refresh-button"
          onClick={() =>
            loadActivity(selectedId)
          }
          disabled={loading || !selectedId}
        >
          ↻ Refresh Analysis
        </button>

        <button
          className="verify-button"
          onClick={verifyIdentity}
          disabled={
            verifying ||
            !selectedId ||
            loading
          }
        >
          {verifying
            ? "VERIFYING..."
            : "✓ VERIFY IDENTITY"}
        </button>

      </div>
    </section>

    {/* SELECTED IDENTITY SUMMARY */}

    {selectedIdentity && (
      <section className="identity-card">

        <div className="identity-main">

          <div className="identity-avatar">
            {selectedIdentity.name
              ? selectedIdentity.name
                  .charAt(0)
                  .toUpperCase()
              : "I"}
          </div>

          <div>
            <p className="card-label">
              SELECTED DIGITAL IDENTITY
            </p>

            <h3>
              {selectedIdentity.name}
            </h3>

            <p className="email">
              {selectedIdentity.email}
            </p>
          </div>

        </div>

        <div className="did">
          <span>
            DECENTRALIZED IDENTIFIER
          </span>

          <code>{did}</code>
        </div>

      </section>
    )}

    {/* VERIFICATION RESULT */}

    {verificationResult && (
      <section
        className={`verification-result ${getVerificationClass()}`}
      >
        <div className="verification-result-header">

          <div>
            <p className="card-label">
              LIVE VERIFICATION RESULT
            </p>

            <h3>
              {verificationResult.accessGranted
                ? "Identity Verified"
                : verificationResult.verified
                ? "Identity Verified — Access Blocked"
                : "Identity Verification Failed"}
            </h3>
          </div>

          <span
            className={
              verificationResult.accessGranted
                ? "verified-badge"
                : "blocked-badge"
            }
          >
            {verificationResult.accessGranted
              ? "✓ ACCESS GRANTED"
              : "✕ ACCESS BLOCKED"}
          </span>

        </div>

        <div className="verification-result-grid">

          <div>
            <span>
              CRYPTOGRAPHIC STATUS
            </span>

            <strong>
              {verificationResult.verified
                ? "✓ VERIFIED"
                : "✕ FAILED"}
            </strong>
          </div>

          <div>
            <span>AI STATUS</span>

            <strong>
              {verificationResult.ai?.status ||
                "N/A"}
            </strong>
          </div>

          <div>
            <span>RISK SCORE</span>

            <strong>
              {verificationResult.ai?.riskScore ??
                "N/A"}
            </strong>
          </div>

          <div>
            <span>
              SECURITY DECISION
            </span>

            <strong>
              {verificationResult.securityDecision ||
                "N/A"}
            </strong>
          </div>

        </div>

        <p className="verification-message">
          {verificationResult.message ||
            "Verification process completed."}
        </p>

      </section>
    )}

    {/* LOADING */}

    {loading && (
      <div className="loading">
        <div className="loader"></div>
        Loading identity intelligence...
      </div>
    )}

    {/* ACTIVITY */}

    {activity && !loading && (
      <>

        {/* STATISTICS */}

        <section className="stats-grid">

          <div className="stat-card">
            <span className="stat-icon">◎</span>

            <div>
              <p>
                VERIFICATION ATTEMPTS
              </p>

              <strong>
                {verificationAttempts}
              </strong>
            </div>
          </div>

          <div className="stat-card danger">
            <span className="stat-icon">!</span>

            <div>
              <p>
                FAILED VERIFICATIONS
              </p>

              <strong>
                {failedVerifications}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">◉</span>

            <div>
              <p>
                UNIQUE IP ADDRESSES
              </p>

              <strong>
                {uniqueIPs}
              </strong>
            </div>
          </div>

          <div className="stat-card">
            <span className="stat-icon">◆</span>

            <div>
              <p>AI RISK SCORE</p>

              <strong>
                {riskScore}
              </strong>
            </div>
          </div>

        </section>

        {/* ANALYSIS */}

        <section className="analysis-grid">

          {/* AI PANEL */}

          <div className="panel ai-panel">

            <div className="panel-header">

              <div>
                <p className="card-label">
                  MACHINE LEARNING
                </p>

                <h3>
                  AI Security Analysis
                </h3>
              </div>

              <span
                className={`risk-badge ${getRiskClass(
                  aiStatus
                )}`}
              >
                {aiStatus}
              </span>

            </div>

            <div className="risk-display">

              <div className="risk-circle">

                <div>
                  <strong>
                    {riskScore}
                  </strong>

                  <span>/ 100</span>
                </div>

              </div>

              <div className="risk-information">

                <div className="risk-row">
                  <span>
                    Anomaly detected
                  </span>

                  <strong
                    className={
                      activity.ai?.anomaly
                        ? "danger-text"
                        : "success-text"
                    }
                  >
                    {activity.ai?.anomaly
                      ? "YES"
                      : "NO"}
                  </strong>
                </div>

                <div className="risk-row">
                  <span>
                    Security decision
                  </span>

                  <strong>
                    {activity.securityDecision ||
                      "N/A"}
                  </strong>
                </div>

                <div className="risk-row">
                  <span>Access</span>

                  <strong
                    className={
                      activity.accessGranted
                        ? "success-text"
                        : "danger-text"
                    }
                  >
                    {activity.accessGranted
                      ? "GRANTED"
                      : "BLOCKED"}
                  </strong>
                </div>

              </div>
            </div>

            <div className="ai-explanation">

              <span>AI ASSESSMENT</span>

              <p>
                {aiStatus === "HIGH_RISK"
                  ? "The machine-learning model detected highly abnormal identity activity. Access has been blocked."
                  : aiStatus === "SUSPICIOUS"
                  ? "The machine-learning model detected suspicious authentication behaviour. Security review is required."
                  : "The machine-learning model found no significant anomaly in the identity's authentication behaviour."}
              </p>

            </div>

          </div>

          {/* BLOCKCHAIN */}

          <div className="panel blockchain-panel">

            <div className="panel-header">

              <div>
                <p className="card-label">
                  DECENTRALIZED TRUST
                </p>

                <h3>
                  Blockchain Verification
                </h3>
              </div>

              <span className="verified-badge">
                ✓ VERIFIED
              </span>

            </div>

            <div className="verification-list">

              <div>
                <span className="check">✓</span>

                <div>
                  <strong>
                    Identity Registered
                  </strong>

                  <small>
                    Identity exists in the
                    identity registry
                  </small>
                </div>
              </div>

              <div>
                <span className="check">✓</span>

                <div>
                  <strong>
                    Decentralized Identifier
                  </strong>

                  <small>
                    DID associated with
                    registered identity
                  </small>
                </div>
              </div>

              <div>
                <span className="check">✓</span>

                <div>
                  <strong>
                    Cryptographic Identity
                  </strong>

                  <small>
                    Public key associated with
                    the identity
                  </small>
                </div>
              </div>

              <div>
                <span className="check">✓</span>

                <div>
                  <strong>
                    AI Security Layer
                  </strong>

                  <small>
                    Behaviour analyzed by ML
                    anomaly detector
                  </small>
                </div>
              </div>

            </div>

            {publicKey && (
              <div className="did">
                <span>
                  PUBLIC KEY
                </span>

                <code>
                  {publicKey}
                </code>
              </div>
            )}

          </div>

        </section>

        {/* AUTHENTICATION EVENTS */}

        <section className="panel activity-panel">

          <div className="panel-header">

            <div>
              <p className="card-label">
                AUDIT TRAIL
              </p>

              <h3>
                Authentication Activity
              </h3>
            </div>

            <span className="event-count">
              {events.length} EVENTS
            </span>

          </div>

          <div className="table-wrapper">

            <table>

              <thead>
                <tr>
                  <th>EVENT</th>
                  <th>RESULT</th>
                  <th>IP ADDRESS</th>
                  <th>TIMESTAMP</th>
                </tr>
              </thead>

              <tbody>

                {events.length > 0 ? (
                  events.map((event) => (
                    <tr key={event.id}>

                      <td>
                        <span className="event-id">
                          #{event.id}
                        </span>
                      </td>

                      <td>
                        <span
                          className={`event-result ${
                            event.success
                              ? "success"
                              : "failure"
                          }`}
                        >
                          {event.success
                            ? "✓ SUCCESS"
                            : "✕ FAILED"}
                        </span>
                      </td>

                      <td>
                        <code>
                          {event.ipAddress ||
                            "UNKNOWN"}
                        </code>
                      </td>

                      <td>
                        {formatDate(
                          event.createdAt
                        )}
                      </td>

                    </tr>
                  ))
                ) : (
                  <tr>
                    <td
                      colSpan="4"
                      style={{
                        textAlign: "center"
                      }}
                    >
                      No authentication events
                      recorded yet.
                    </td>
                  </tr>
                )}

              </tbody>

            </table>

          </div>

        </section>

      </>
    )}

    {/* EMPTY STATE */}

    {!loading &&
      identities.length === 0 && (
        <section className="panel">
          <div className="panel-header">
            <div>
              <p className="card-label">
                IDENTITY REGISTRY
              </p>

              <h3>
                No identities registered
              </h3>

              <p>
                Register your first digital
                identity using the form above.
              </p>
            </div>
          </div>
        </section>
      )}

  </main>

  <footer>
    <span>
      AI-Enhanced Blockchain-Based
      Self-Sovereign Identity
    </span>

    <span>
      Kenya e-Government Security
      Research Platform
    </span>
  </footer>

</div>


);
}

export default App;
