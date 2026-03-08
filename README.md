# Anonymous Real-Time Chat with End-to-End Encryption and Automatic Translation

This repository contains the prototype system developed as part of the thesis:

**“Design and Evaluation of an Anonymous End-to-End Encrypted Real-Time Chat System with Automatic Translation.”**

The project demonstrates how **anonymous communication**, **client-side encryption**, and **machine translation** can be integrated into a real-time messaging platform while evaluating their performance impact.

The system is implemented using modern web technologies and includes an experimental evaluation pipeline used to measure latency, encryption overhead, and translation performance.

---

# Project Overview

Modern messaging platforms increasingly require:

* strong **privacy guarantees**
* **secure communication**
* the ability to communicate across **language barriers**

This project explores how these requirements can be combined in a single system.

The prototype implements a real-time chat platform where:

* users communicate using **anonymous identities**
* messages are protected using **end-to-end encryption**
* translation is optionally applied **after decryption on the receiver side**
* the server acts only as a **message relay**
* detailed telemetry measurements allow evaluation of system performance

The goal of this work is to analyze the performance impact of combining these technologies in a real-time messaging environment.

---

# System Architecture

The system follows a **client–relay architecture**.

The server does **not decrypt or inspect message contents**.

```
Sender Client
     │
     │ 1. Encrypt message (client-side)
     ▼
Encrypted Payload
     │
     │ 2. Send via WebSocket
     ▼
Realtime Relay Server
     │
     │ 3. Forward encrypted message
     ▼
Receiver Client
     │
     │ 4. Decrypt message
     │
     │ 5. Optional translation
     ▼
Message Display
```

Key design principles:

* **Client-side encryption**
* **Minimal server trust**
* **Anonymous identities**
* **Optional translation layer**
* **Telemetry-based evaluation**

---

# Core Features

## Anonymous Identity Model

The system implements a lightweight anonymity model.

Users do not create traditional accounts. Instead:

* an **anonymous identifier** is generated locally
* the identifier is stored in the browser
* no personal information is required

Example identifier:

```
anon_GkURm3w9qViox-3Ttk8L0g
```

This approach allows participation without registration while maintaining session continuity.

---

## End-to-End Encryption

All messages are encrypted **before leaving the client**.

Encryption uses the **libsodium** cryptographic library.

Properties:

* symmetric encryption
* authenticated encryption
* nonce-based encryption
* server cannot decrypt messages

The encryption key is derived from a **shared room secret**.

---

## Real-Time Communication

The system uses **Socket.IO** for realtime messaging.

The server acts only as a **relay node**:

* receives encrypted payload
* forwards it to connected clients
* performs no cryptographic operations

This design minimizes server trust requirements.

---

## Automatic Translation

The system integrates **LibreTranslate** to support multilingual communication.

Translation occurs **after decryption** on the receiving client.

This ensures:

* plaintext is never exposed to the relay server
* encryption guarantees remain intact

Supported languages in the prototype:

* English
* German

---

## Telemetry System

To evaluate system performance, the prototype logs detailed telemetry information.

Each message records metrics such as:

| Metric       | Description                      |
| ------------ | -------------------------------- |
| encrypt_ms   | client-side encryption time      |
| decrypt_ms   | decryption time                  |
| relay_ms     | network and server relay latency |
| translate_ms | translation processing time      |
| total_e2e_ms | total end-to-end delivery time   |
| cipher_bytes | ciphertext payload size          |

These measurements are exported as JSON logs and analyzed using Python scripts.

---

# Repository Structure

```
.
├── apps
│   ├── web
│   │   Next.js frontend application
│   │
│   └── realtime
│       Socket.IO relay server
│
├── results
│   ├── raw
│   │   telemetry logs exported from experiments
│   │
│   ├── processed
│   │   analysis scripts and processed datasets
│   │
│   └── charts
│       generated evaluation figures
│
├── docker-compose.yml
│
└── README.md
```

---

# Technology Stack

Frontend:

* Next.js
* React
* TypeScript
* Socket.IO client

Backend:

* Node.js
* Socket.IO server

Cryptography:

* libsodium
* symmetric authenticated encryption

Translation:

* LibreTranslate

Data Analysis:

* Python
* pandas
* matplotlib

---

# Running the System

## Requirements

* Node.js
* Python 3
* Docker (optional)

---

# 1 Start the Realtime Server

```
cd apps/realtime
npm install
npm run dev
```

The relay server will run on:

```
http://localhost:3001
```

---

# 2 Start the Frontend

```
cd apps/web
npm install
npm run dev
```

Open the client application:

```
http://localhost:3000
```

---

# 3 Start LibreTranslate

Run a local translation server:

```
libretranslate --host 0.0.0.0 --port 5000 --load-only en,de
```

This starts the translation service used by the chat client.

---

# Experimental Evaluation

The prototype was evaluated under controlled conditions to measure performance impact.

Three system configurations were tested:

| Scenario       | Description                                    |
| -------------- | ---------------------------------------------- |
| baseline       | plaintext messaging                            |
| e2ee           | encrypted messaging                            |
| e2ee_translate | encrypted messaging with automatic translation |

Three message sizes were used:

* **small (~20 characters)**
* **medium (~200 characters)**
* **large (~2000 characters)**

For each configuration:

```
5 runs × 10 messages
```

Total messages evaluated:

```
3 scenarios × 3 message sizes × 5 runs × 10 messages = 450 messages
```

---

# Evaluation Metrics

The evaluation focuses on measuring:

* encryption overhead
* relay latency
* translation latency
* total message delivery time
* payload size overhead

This allows a detailed analysis of how each component contributes to overall system performance.

---

# Evaluation Figures

The following figures were generated during the evaluation:

1. **End-to-End Latency Comparison**
2. **Client-Side Encryption Overhead**
3. **Translation Latency by Message Size**
4. **Latency Breakdown for E2EE + Translation**
5. **Zoomed Latency Breakdown (Crypto + Relay)**
6. **Payload Size Comparison**

All figures can be found in:

```
results/processed/charts/
```

---

# Reproducing the Analysis

Navigate to the analysis directory:

```
cd results/processed
```

Create a Python environment:

```
python3 -m venv analysis_env
```

Activate the environment:

macOS / Linux:

```
source analysis_env/bin/activate
```

Install dependencies:

```
pip install -r requirements.txt
```

Run the analysis pipeline:

```
python analysis.py
```

Generate the charts:

```
python save_charts.py
```

Generated figures will appear in:

```
results/processed/charts/
```

---

# Key Findings

The evaluation demonstrates several important insights:

1. **Client-side encryption introduces negligible latency**, typically below 0.5 ms.

2. **Network relay latency remains minimal**, typically around a few milliseconds.

3. **Automatic translation introduces the largest performance cost**, particularly for longer messages.

4. The system demonstrates that **secure encrypted messaging can be implemented with minimal overhead in real-time applications**.

These results suggest that privacy-preserving messaging architectures are feasible without significantly impacting user experience.

---

# Thesis Context

This repository accompanies an academic thesis investigating:

* the feasibility of combining anonymity and encryption
* the performance impact of client-side cryptography
* the cost of integrating machine translation in secure messaging systems

The prototype system and experimental dataset support the evaluation presented in the thesis.

---

# License

This project is provided for **academic and research purposes**.