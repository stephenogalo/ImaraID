import json
import os
import sys

import joblib

MODEL_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "identity_model.joblib"
)


def get_value(activity, snake_case, camel_case, default=None):
    if snake_case in activity:
        return activity[snake_case]
    return activity.get(camel_case, default)


def analyse_activity(activity):
    attempts = get_value(
        activity, "verification_attempts", "verificationAttempts", 0
    )
    failures = get_value(
        activity, "failed_verifications", "failedVerifications", 0
    )
    unique_ips = get_value(
        activity, "unique_ips", "uniqueIPs", 1
    )
    recent_failures = get_value(
        activity,
        "recent_failed_verifications",
        "recentFailedVerifications",
        0
    )

    values = {
        "verification_attempts": attempts,
        "failed_verifications": failures,
        "unique_ips": unique_ips,
        "recent_failed_verifications": recent_failures
    }

    for name, value in values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be a number")
        if value < 0 or not float(value).is_integer():
            raise ValueError(f"{name} must be a non-negative integer")

    attempts = int(attempts)
    failures = int(failures)
    unique_ips = int(unique_ips)
    recent_failures = int(recent_failures)

    if failures > attempts:
        raise ValueError(
            "Failed verifications cannot exceed total verification attempts"
        )

    if recent_failures > failures:
        raise ValueError(
            "Recent failed verifications cannot exceed total failures"
        )

    # Total successful attempts do not contribute to risk.
    # We measure failed attempts and IP diversity instead.
    extra_ips = max(0, unique_ips - 1)
    ml_features = [[failures, extra_ips]]

    if not os.path.exists(MODEL_PATH):
        raise FileNotFoundError(
            "AI model is missing. Run: python3 ai/trainModel.py"
        )

    model = joblib.load(MODEL_PATH)
    prediction = int(model.predict(ml_features)[0])
    model_anomaly = prediction == -1

    # Transparent, deterministic security indicators.
    failure_risk = min(60.0, failures * 15.0)
    ip_risk = min(30.0, extra_ips * 10.0)
    rule_risk = min(100.0, failure_risk + ip_risk)

    # Recent failures increase risk because a burst can indicate an attack.
    burst_risk = min(40.0, recent_failures * 10.0)
    combined_risk = min(100.0, rule_risk + burst_risk)

    # An ML-detected anomaly must affect the actual security classification.
    risk_score = max(combined_risk, 40.0) if model_anomaly else combined_risk
    risk_score = round(min(100.0, risk_score), 2)

    if risk_score >= 70:
        status = "HIGH_RISK"
    elif risk_score >= 40:
        status = "SUSPICIOUS"
    else:
        status = "NORMAL"

    reasons = []

    if recent_failures:
        reasons.append(
            f"{recent_failures} failed verification(s) in the last 15 minutes"
        )
    if failures:
        reasons.append(f"{failures} failed verification(s) in total")
    if extra_ips:
        reasons.append(f"activity from {extra_ips} additional IP address(es)")
    if model_anomaly:
        reasons.append("the machine-learning model detected an unusual pattern")

    if status == "HIGH_RISK":
        explanation = "High risk: " + "; ".join(reasons or ["multiple security indicators"]) + "."
    elif status == "SUSPICIOUS":
        explanation = "Suspicious activity: " + "; ".join(reasons or ["risk score exceeded the normal threshold"]) + ". Access should be denied or reviewed."
    else:
        explanation = (
            "No significant risk indicators were detected."
            if not reasons
            else "Activity remains below the suspicious threshold: " + "; ".join(reasons) + "."
        )

    return {
        "riskScore": risk_score,
        "status": status,
        "anomaly": status != "NORMAL",
        "mlAnomaly": model_anomaly,
        "securityRisk": round(rule_risk, 2),
        "failureRisk": round(failure_risk, 2),
        "ipRisk": round(ip_risk, 2),
        "burstRisk": round(burst_risk, 2),
        "recentFailedVerifications": recent_failures,
        "indicators": {
            "failedVerifications": failures,
            "additionalIPs": extra_ips,
            "recentFailedVerifications": recent_failures,
            "machineLearningAnomaly": model_anomaly
        },
        "explanation": explanation
    }


def main():
    try:
        activity = json.load(sys.stdin)

        if not isinstance(activity, dict):
            raise ValueError("Input must be a JSON object")

        result = analyse_activity(activity)
        print(json.dumps(result))

    except Exception as error:
        print(json.dumps({"error": str(error)}))
        sys.exit(1)


if __name__ == "__main__":
    main()
