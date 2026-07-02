# Halo

Kompletny komunikator webowy 1:1 w TypeScript: konta identyfikowane unikalnym tagiem, wiadomości realtime, wskaźnik pisania, status online, reakcje, zdjęcia, PDF-y, pliki, głosówki, linki i wyszukiwanie w rozmowie.

## Uruchomienie

Wymagane: Node.js 20+ oraz npm.

```bash
cp .env.example .env
npm install
npm run dev
```

Interfejs będzie dostępny pod `http://localhost:5173`, API pod `http://localhost:4000`. Aby przetestować rozmowę, utwórz dwa konta w dwóch różnych profilach przeglądarki.

## Polecenia

```bash
npm run dev        # klient i API
npm run build      # kompilacja produkcyjna
npm run test       # testy
npm run typecheck  # kontrola typów
```

## Dane i wdrożenie

Wersja lokalna zapisuje bazę w `data/chat.db`, a załączniki w `uploads/`. Oba katalogi są ignorowane przez Git. Sekret JWT w `.env.example` trzeba bezwzględnie zmienić przed publicznym wdrożeniem.

Na start wybrano własny serwer Node.js + Socket.IO i SQLite. Pozwala to uruchomić cały produkt lokalnie bez kont zewnętrznych i obsługuje logowanie `tag + hasło`, którego Firebase Auth nie zapewnia bez dodatkowej warstwy. Dla produkcji na prywatnym serwerze rekomendowany jest PostgreSQL oraz magazyn zgodny z S3; odpowiednie zmienne są przygotowane w `.env.example`, ale adapter produkcyjny celowo nie jest jeszcze podłączony.

## Ograniczenia przed publicznym wdrożeniem

- Należy przenieść pliki do prywatnego bucketu i wydawać krótkotrwałe podpisane adresy URL.
- Należy dodać reverse proxy z HTTPS, rate limiting i kopie zapasowe.
- SQLite sprawdzi się dla jednej instancji i małego ruchu; skalowanie horyzontalne wymaga PostgreSQL oraz adaptera Redis dla Socket.IO.

Szczegółowy układ kodu znajduje się w [PROJECT_MAP.md](./PROJECT_MAP.md).
