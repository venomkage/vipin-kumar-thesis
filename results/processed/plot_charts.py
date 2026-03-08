from pathlib import Path

import pandas as pd
import matplotlib.pyplot as plt

BASE_DIR = Path(".").resolve()
INPUT_CSV = BASE_DIR / "summary_mean.csv"

# Load summary data
df = pd.read_csv(INPUT_CSV)

scenario_order = ["baseline", "e2ee", "e2ee_translate"]
size_order = ["small", "medium", "large"]

df["scenario"] = pd.Categorical(df["scenario"], categories=scenario_order, ordered=True)
df["size"] = pd.Categorical(df["size"], categories=size_order, ordered=True)
df = df.sort_values(["scenario", "size"]).reset_index(drop=True)

print("Loaded data:")
print(df)

fig, axes = plt.subplots(3, 2, figsize=(15, 14))
axes = axes.flatten()

# 1) End-to-end latency comparison
pivot1 = df.pivot(index="size", columns="scenario", values="total_e2e_ms").reindex(size_order)
pivot1.plot(kind="bar", ax=axes[0])
axes[0].set_title("End-to-End Latency Comparison")
axes[0].set_xlabel("Message Size")
axes[0].set_ylabel("Average Total E2E Latency (ms)")
axes[0].tick_params(axis="x", rotation=0)
axes[0].legend(title="Scenario")

# 2) Encryption overhead (ONLY e2ee)
subset2 = df[df["scenario"] == "e2ee"].set_index("size").reindex(size_order)
axes[1].bar(subset2.index, subset2["encrypt_ms"])
axes[1].set_title("Client-Side Encryption Overhead")
axes[1].set_xlabel("Message Size")
axes[1].set_ylabel("Average Encryption Time (ms)")
axes[1].tick_params(axis="x", rotation=0)

# 3) Translation latency
subset3 = df[df["scenario"] == "e2ee_translate"].set_index("size").reindex(size_order)
axes[2].plot(subset3.index, subset3["translate_ms"], marker="o")
axes[2].set_title("Translation Latency by Message Size")
axes[2].set_xlabel("Message Size")
axes[2].set_ylabel("Average Translation Time (ms)")

# 4) Pipeline breakdown
subset4 = (
    df[df["scenario"] == "e2ee_translate"]
    .set_index("size")
    .reindex(size_order)[["encrypt_ms", "relay_ms", "decrypt_ms", "translate_ms"]]
    .fillna(0)
)
subset4.plot(kind="bar", stacked=True, ax=axes[3])
axes[3].set_title("Latency Breakdown for E2EE + Translation")
axes[3].set_xlabel("Message Size")
axes[3].set_ylabel("Average Time (ms)")
axes[3].tick_params(axis="x", rotation=0)
axes[3].legend(title="Component")

# 5) Payload size comparison
pivot5 = df.pivot(index="size", columns="scenario", values="cipher_bytes").reindex(size_order)
pivot5.plot(kind="bar", ax=axes[4])
axes[4].set_title("Payload Size Comparison")
axes[4].set_xlabel("Message Size")
axes[4].set_ylabel("Average Payload Size (bytes / proxy)")
axes[4].tick_params(axis="x", rotation=0)
axes[4].legend(title="Scenario")

# 6) Zoomed breakdown (without translation)
subset_zoom = (
    df[df["scenario"] == "e2ee_translate"]
    .set_index("size")
    .reindex(size_order)[["encrypt_ms", "relay_ms", "decrypt_ms"]]
    .fillna(0)
)
subset_zoom.plot(kind="bar", stacked=True, ax=axes[5])
axes[5].set_title("Zoomed Latency Breakdown (Without Translation)")
axes[5].set_xlabel("Message Size")
axes[5].set_ylabel("Average Time (ms)")
axes[5].tick_params(axis="x", rotation=0)
axes[5].legend(title="Component")

plt.tight_layout()
plt.show()