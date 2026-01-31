# ZK Voting App – Instrukcja uruchomienia

Ten dokument opisuje **krok po kroku** proces instalacji i uruchomienia aplikacji **zk-voting-app** na systemie Linux (testowane WSL2).

---

## 1. Aktualizacja systemu i instalacja zależności

```bash
sudo apt update && sudo apt install -y git curl build-essential jq
```

---

## 2. Instalacja Rust (cargo)

Circom wymaga środowiska Rust.

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
```

Podczas instalacji:

* naciśnij **Enter** (domyślna konfiguracja)

Następnie załaduj środowisko:

```bash
source "$HOME/.cargo/env"
```

Sprawdzenie:

```bash
cargo --version
```

---

## 3. Instalacja Circom

```bash
git clone https://github.com/iden3/circom.git
cd circom
cargo build --release
cargo install --path circom
cd ..
```

Sprawdzenie:

```bash
circom --version
```

---

## 4. Instalacja Node.js (NVM + Node 22)

### Instalacja NVM

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.5/install.sh | bash
```

Załaduj NVM:

```bash
source ~/.bashrc
```

### Instalacja i użycie Node.js 22

```bash
nvm install 22
nvm use 22
```

Sprawdzenie:

```bash
node -v
npm -v
```

---

## 5. Pobranie projektu

```bash
git clone https://github.com/michalachowicz/zk-voting-app.git
cd zk-voting-app
```

---

## 6. Instalacja zależności npm

```bash
npm install
```

---

## 7. Konfiguracja środowiska

### 7.1 Plik `.env`

W katalogu głównym projektu utwórz plik `.env`:

Uzupełnij go zgodnie z poniższym przykładem:

```txt
ARBITRUM_SEPOLIA_RPC_URL='https://sepolia-rollup.arbitrum.io/rpc'
ARBITRUM_RPC_URL='https://arb1.arbitrum.io/rpc'
PRIVATE_KEY=''
ETHERSCAN_API_KEY=''
```

ETHERSCAN_API_KEY jest opcjonalne i śłuży do weryfikacji kodu kontraktów w Arbiscan

---

## 8. Budowa obwodów (Circuits)

```bash
npm run build-circuit
```

---

## 9. Deployment aplikacji

```bash
npm run deploy
```

---

## 10. Uruchomienie aplikacji

```bash
npm run start
```

Aplikacja powinna być dostępna pod adresem

---

## 11. Generowanie drzewa przed dodaniem rundy głosowania

**Przed dodaniem nowej rundy głosowania należy wygenerować drzewo Merkle**

Do wygenerowania drzewa niezbędne jest wpisanie identyfikatorów użytkowników do pliku ./inputs/leafs.txt
Każdy identyfikator użytkownika musi być w nowej linii, bez znaków odzielających
zgodnie z poniższym przykładem:

```txt
0x2a73ab2d2bd3c65c2a5402c33f8443af7bf3722e2c5e7ac07a2b0fcdd7d1ef87
0x029378c7f52c8f1241417fd2592bc17074e1d25ac6ddacc293696cee553d6c92
0x07f9d837cb17b0d36320ffe93ba52345f1b728571a568265caac97559dbc952a
0x05f6b6f121c2ac4f1ed9230109adba16bfae1d6f93d49ef01a042707ef6220fd
0x2a2490f35995ec9a8bafa5aa99e0a0125de1af86641616c2516bd515e4f26abb
```

```bash
npm run gen-tree $votingId
```

