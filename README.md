# Kōdama - コーダマ

Kōdama is a Tauri-based IDE with a Vue frontend, featuring an AI system powered by Ollama.

---

## Prerequisites

Before setting up the project, ensure you have the following installed:

- [**Node.js**](https://nodejs.org/) (LTS version recommended)
- [**pnpm**](https://pnpm.io/) (preferred package manager, install via `npm i -g pnpm`)
- [**Rust**](https://www.rust-lang.org/) (latest stable version, install via [rustup](https://rustup.rs/))
- [**Tauri CLI**](https://tauri.app/) (install via `cargo install tauri-cli`)
- [**Ollama**](https://ollama.ai/) (for AI chatbot functionality, install via their website)

---

## Installation

Clone the repository and install dependencies:

```sh
# Clone the repository
git clone https://github.com/FabioArdis/kodama.git
cd kodama

# Install dependencies
pnpm install
```

---

## Running in Development Mode

### 1 - Start the Ollama server (ensure it's running in the background)

```sh
ollama serve
```

### 2 - Run the development server

```sh
pnpm dev
```

This will start Kōdama in a browser environment with live reloading.

### 2a - Run the full app (for native testing)

```sh
pnpm tauri dev
```

This will build and launch Kōdama.

---

## Building for Production

To create a production build of Kōdama:

```sh
pnpm tauri build
```

This will generate a native build of Kōdama in the `src-tauri/target/release` folder.

---