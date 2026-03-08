from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pandas as pd

RAW_DIR = Path("../raw").resolve()
OUT_DIR = Path(".").resolve()

SCENARIOS = ["baseline", "e2ee", "e2ee_translate"]
SIZES = ["small", "medium", "large"]


def is_hidden(path: Path) -> bool:
    return path.name.startswith(".")


def load_json(path: Path) -> dict[str, Any]:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def parse_side(filename: str, scenario: str) -> str:
    name = filename.lower()
    if "_sender" in name:
        return "sender"
    if "_receiver" in name:
        return "receiver"
    # baseline files are usually just run01.json etc.
    if scenario == "baseline":
        return "receiver"
    # safe default
    return "unknown"


def parse_run_id(filename: str) -> str:
    stem = Path(filename).stem
    # run01_sender -> run01
    # run01_receiver -> run01
    # run01 -> run01
    return stem.split("_")[0]


def safe_num(v: Any) -> float | None:
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def collect_records() -> list[dict[str, Any]]:
    merged: dict[tuple[str, str, str, str], dict[str, Any]] = {}

    for scenario in SCENARIOS:
        scenario_dir = RAW_DIR / scenario
        if not scenario_dir.exists():
            print(f"Warning: missing scenario folder: {scenario_dir}")
            continue

        for size in SIZES:
            size_dir = scenario_dir / size
            if not size_dir.exists():
                print(f"Warning: missing size folder: {size_dir}")
                continue

            for file_path in sorted(size_dir.iterdir()):
                if is_hidden(file_path) or not file_path.is_file() or file_path.suffix.lower() != ".json":
                    continue

                data = load_json(file_path)
                per_message = data.get("per_message", [])
                if not isinstance(per_message, list):
                    print(f"Warning: no per_message list in {file_path.name}")
                    continue

                side = parse_side(file_path.name, scenario)
                run = parse_run_id(file_path.name)

                for msg in per_message:
                    msg_id = msg.get("msg_id")
                    if not msg_id:
                        continue

                    key = (scenario, size, run, msg_id)
                    row = merged.setdefault(
                        key,
                        {
                            "scenario": scenario,
                            "size": size,
                            "run": run,
                            "msg_id": msg_id,
                            "room_id": msg.get("room_id"),
                            "sender_id": msg.get("sender_id"),
                            "target_lang": None,
                            "displayed_view": None,
                            "encrypt_ms": None,
                            "cipher_bytes": None,
                            "decrypt_ms": None,
                            "relay_ms": None,
                            "translate_ms": None,
                            "total_e2e_ms": None,
                            "decrypt_ok": None,
                            "translate_ok": None,
                        },
                    )

                    # Common metadata
                    if row["room_id"] is None:
                        row["room_id"] = msg.get("room_id")
                    if row["sender_id"] is None:
                        row["sender_id"] = msg.get("sender_id")

                    # Sender file: trust only sender-side metrics
                    if side == "sender":
                        if "encrypt_ms" in msg:
                            row["encrypt_ms"] = safe_num(msg.get("encrypt_ms"))
                        if "bytes_ciphertext" in msg:
                            row["cipher_bytes"] = safe_num(msg.get("bytes_ciphertext"))

                    # Receiver file (or baseline single-file export): trust display-side metrics
                    elif side == "receiver" or scenario == "baseline":
                        if "decrypt_ms" in msg:
                            row["decrypt_ms"] = safe_num(msg.get("decrypt_ms"))
                        if "relay_ms" in msg:
                            row["relay_ms"] = safe_num(msg.get("relay_ms"))
                        if "translate_ms" in msg:
                            row["translate_ms"] = safe_num(msg.get("translate_ms"))
                        if "total_e2e_ms" in msg:
                            row["total_e2e_ms"] = safe_num(msg.get("total_e2e_ms"))
                        if "decrypt_ok" in msg:
                            row["decrypt_ok"] = msg.get("decrypt_ok")
                        if "translate_ok" in msg:
                            row["translate_ok"] = msg.get("translate_ok")
                        if "target_lang" in msg:
                            row["target_lang"] = msg.get("target_lang")
                        if "displayed_view" in msg:
                            row["displayed_view"] = msg.get("displayed_view")

                    # Unknown side: fill any missing values conservatively
                    else:
                        if row["encrypt_ms"] is None and "encrypt_ms" in msg:
                            row["encrypt_ms"] = safe_num(msg.get("encrypt_ms"))
                        if row["cipher_bytes"] is None and "bytes_ciphertext" in msg:
                            row["cipher_bytes"] = safe_num(msg.get("bytes_ciphertext"))
                        if row["decrypt_ms"] is None and "decrypt_ms" in msg:
                            row["decrypt_ms"] = safe_num(msg.get("decrypt_ms"))
                        if row["relay_ms"] is None and "relay_ms" in msg:
                            row["relay_ms"] = safe_num(msg.get("relay_ms"))
                        if row["translate_ms"] is None and "translate_ms" in msg:
                            row["translate_ms"] = safe_num(msg.get("translate_ms"))
                        if row["total_e2e_ms"] is None and "total_e2e_ms" in msg:
                            row["total_e2e_ms"] = safe_num(msg.get("total_e2e_ms"))
                        if row["target_lang"] is None and "target_lang" in msg:
                            row["target_lang"] = msg.get("target_lang")
                        if row["displayed_view"] is None and "displayed_view" in msg:
                            row["displayed_view"] = msg.get("displayed_view")

    return list(merged.values())


def main() -> None:
    rows = collect_records()
    if not rows:
        raise SystemExit("No records found. Check your folder structure and filenames.")

    df = pd.DataFrame(rows)
    df = df.sort_values(["scenario", "size", "run", "msg_id"]).reset_index(drop=True)

    # Save merged per-message data
    per_message_path = OUT_DIR / "per_message_merged.csv"
    df.to_csv(per_message_path, index=False)

    metric_cols = [
        "encrypt_ms",
        "cipher_bytes",
        "decrypt_ms",
        "relay_ms",
        "translate_ms",
        "total_e2e_ms",
    ]

    # Per-run summary: average over the 10 messages in each run
    by_run = (
        df.groupby(["scenario", "size", "run"], dropna=False)[metric_cols]
        .mean(numeric_only=True)
        .reset_index()
        .sort_values(["scenario", "size", "run"])
    )
    by_run_path = OUT_DIR / "summary_by_run.csv"
    by_run.to_csv(by_run_path, index=False)

    # Mean/std across runs
    mean_df = (
        by_run.groupby(["scenario", "size"], dropna=False)[metric_cols]
        .mean(numeric_only=True)
        .reset_index()
        .sort_values(["scenario", "size"])
    )
    std_df = (
        by_run.groupby(["scenario", "size"], dropna=False)[metric_cols]
        .std(numeric_only=True)
        .reset_index()
        .sort_values(["scenario", "size"])
    )

    mean_path = OUT_DIR / "summary_mean.csv"
    std_path = OUT_DIR / "summary_std.csv"
    mean_df.to_csv(mean_path, index=False)
    std_df.to_csv(std_path, index=False)

    print("\nAnalysis complete.\n")
    print(f"Merged per-message CSV: {per_message_path}")
    print(f"Per-run summary CSV:    {by_run_path}")
    print(f"Mean summary CSV:       {mean_path}")
    print(f"Std summary CSV:        {std_path}")

    print("\nMean summary:\n")
    print(mean_df.to_string(index=False))


if __name__ == "__main__":
    main()