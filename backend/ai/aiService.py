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

    values = {
        "verification_attempts": attempts,
        "failed_verifications": failures,
        "unique_ips": unique_ips
    }

    for name, value in values.items():
        if isinstance(value, bool) or not isinstance(value, (int, float)):
            raise ValueError(f"{name} must be a number")
        if value < 0 or not float(value).is_integer():
            raise ValueError(f"{name} must be a non-negative integer")

    attempts = int(attempts)
    failures = int(failures)
    unique_ips = int(unique_ips)

    if failures > attempts:
        raise ValueError(
            "Failed verifications cannot exceed total verification attempts"
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

    # An ML-detected anomaly must affect the actual security classification.
    # A clean pattern remains stable when only successful attempt counts change.
    risk_score = max(rule_risk, 40.0) if model_anomaly else rule_risk
    risk_score = round(min(100.0, risk_score), 2)

    if risk_score >= 70:
        status = "HIGH_RISK"
    elif risk_score >= 40:
        status = "SUSPICIOUS"
    else:
        status = "NORMAL"

    reasons = []

    if failures:
        reasons.append(
            f"{failures} failed verification attempt(s)"
        )

    if extra_ips:
        reasons.append(
            f"{extra_ips} additional IP address(es) observed"
        )

    if model_anomaly:
        reasons.append("machine-learning model detected an anomalous pattern")

    if status == "HIGH_RISK":
        explanation = "High risk: " + (
            "; ".join(reasons) if reasons
            else "multiple security indicators"
        ) + "."
    elif status == "SUSPICIOUS":
        explanation = "Suspicious activity: " + (
            "; ".join(reasons) if reasons
            else "the risk score exceeded the normal threshold"
        ) + ". Access should be denied or reviewed."
    else:
        explanation = (
            "No significant risk detected by the current indicators."
            if not reasons
            else "Risk indicators remain below the suspicious threshold: "
            + "; ".join(reasons) + "."
        )

    return {
        "riskScore": risk_score,
        "status": status,
        "anomaly": status != "NORMAL",
        "mlAnomaly": model_anomaly,
        "securityRisk": round(rule_risk, 2),
        "failureRisk": round(failure_risk, 2),
        "ipRisk": round(ip_risk, 2),
        "explanation": explanation,
        "indicators": {
            "failedVerifications": failures,
            "additionalIPs": extra_ips,
            "machineLearningAnomaly": model_anomaly
        }
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
