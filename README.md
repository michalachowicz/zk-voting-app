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

ARBITRUM_SEPOLIA_RPC_URL='https://sepolia-rollup.arbitrum.io/rpc'
ARBITRUM_RPC_URL='https://arb1.arbitrum.io/rpc'
PRIVATE_KEY=''
ETHERSCAN_API_KEY=''

ETHERSCAN_API_KEY jest opcjonalne i śłuży do weryfikacji kodu kontraktów w Arbiscan

### 7.2 Plik `leafs.txt`

Utwórz plik:

```bash
touch leafs.txt
```

Plik powinien zawierać identyfikatory uzytkowników do generowanie drzewa Merkle (każdy identyfikator w nowej linii, bez przecinków, kropek i innych zanków odzielających)

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

⚠️ **Przed dodaniem nowej rundy głosowania należy wygenerować drzewo Merkle**

```bash
npm run gen-tree $votingId
```

