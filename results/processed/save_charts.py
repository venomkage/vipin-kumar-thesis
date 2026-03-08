from pathlib import Path
import pandas as pd
import matplotlib.pyplot as plt

BASE_DIR = Path(".").resolve()
INPUT_CSV = BASE_DIR / "summary_mean.csv"
OUTPUT_DIR = BASE_DIR / "charts"
OUTPUT_DIR.mkdir(exist_ok=True)

df = pd.read_csv(INPUT_CSV)

scenario_order = ["baseline", "e2ee", "e2ee_translate"]
size_order = ["small", "medium", "large"]

df["scenario"] = pd.Categorical(df["scenario"], categories=scenario_order, ordered=True)
df["size"] = pd.Categorical(df["size"], categories=size_order, ordered=True)
df = df.sort_values(["scenario", "size"]).reset_index(drop=True)

# 1) End-to-End Latency Comparison
pivot1 = df.pivot(index="size", columns="scenario", values="total_e2e_ms").reindex(size_order)
fig, ax = plt.subplots(figsize=(8, 5))
pivot1.plot(kind="bar", ax=ax)
ax.set_title("End-to-End Latency Comparison")
ax.set_xlabel("Message Size")
ax.set_ylabel("Average Total E2E Latency (ms)")
ax.tick_params(axis="x", rotation=0)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "01_latency_comparison.png", dpi=300, bbox_inches="tight")
plt.close(fig)

# 2) Encryption Overhead
subset2 = df[df["scenario"] == "e2ee"].set_index("size").reindex(size_order)
fig, ax = plt.subplots(figsize=(8, 5))
ax.bar(subset2.index, subset2["encrypt_ms"])
ax.set_title("Client-Side Encryption Overhead")
ax.set_xlabel("Message Size")
ax.set_ylabel("Average Encryption Time (ms)")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "02_encryption_overhead.png", dpi=300, bbox_inches="tight")
plt.close(fig)

# 3) Translation Latency
subset3 = df[df["scenario"] == "e2ee_translate"].set_index("size").reindex(size_order)
fig, ax = plt.subplots(figsize=(8, 5))
ax.plot(subset3.index, subset3["translate_ms"], marker="o")
ax.set_title("Translation Latency by Message Size")
ax.set_xlabel("Message Size")
ax.set_ylabel("Average Translation Time (ms)")
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "03_translation_latency.png", dpi=300, bbox_inches="tight")
plt.close(fig)

# 4) Full Pipeline Breakdown
subset4 = (
    df[df["scenario"] == "e2ee_translate"]
    .set_index("size")
    .reindex(size_order)[["encrypt_ms", "relay_ms", "decrypt_ms", "translate_ms"]]
    .fillna(0)
)
fig, ax = plt.subplots(figsize=(8, 5))
subset4.plot(kind="bar", stacked=True, ax=ax)
ax.set_title("Latency Breakdown for E2EE + Translation")
ax.set_xlabel("Message Size")
ax.set_ylabel("Average Time (ms)")
ax.tick_params(axis="x", rotation=0)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "04_pipeline_breakdown_full.png", dpi=300, bbox_inches="tight")
plt.close(fig)

# 5) Payload Size Comparison
pivot5 = df.pivot(index="size", columns="scenario", values="cipher_bytes").reindex(size_order)
fig, ax = plt.subplots(figsize=(8, 5))
pivot5.plot(kind="bar", ax=ax)
ax.set_title("Payload Size Comparison")
ax.set_xlabel("Message Size")
ax.set_ylabel("Average Payload Size (bytes)")
ax.tick_params(axis="x", rotation=0)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "05_payload_size_comparison.png", dpi=300, bbox_inches="tight")
plt.close(fig)

# 6) Zoomed Breakdown
subset6 = (
    df[df["scenario"] == "e2ee_translate"]
    .set_index("size")
    .reindex(size_order)[["encrypt_ms", "relay_ms", "decrypt_ms"]]
    .fillna(0)
)
fig, ax = plt.subplots(figsize=(8, 5))
subset6.plot(kind="bar", stacked=True, ax=ax)
ax.set_title("Zoomed Latency Breakdown (Without Translation)")
ax.set_xlabel("Message Size")
ax.set_ylabel("Average Time (ms)")
ax.tick_params(axis="x", rotation=0)
plt.tight_layout()
plt.savefig(OUTPUT_DIR / "06_pipeline_breakdown_zoom.png", dpi=300, bbox_inches="tight")
plt.close(fig)

print("PNG charts saved to:", OUTPUT_DIR)