# Mapa projektu Halo

## Architektura

```text
Przeglądarka (React)
  ├── Web Crypto: ECDH + HKDF + AES-256-GCM przed wysłaniem
  ├── REST: konta, szyfrogramy rozmów, upload i historia
  └── Socket.IO: nowe wiadomości, reakcje, pisanie, obecność
                         │
                    Node.js API
                     ├── SQLite: dane relacyjne
                     └── uploads/: pliki lokalne
```

## Katalogi

```text
Chaty/
├── apps/
│   ├── api/
│   │   └── src/
│   │       ├── index.ts       # serwer HTTP i zdarzenia Socket.IO
│   │       ├── app.ts         # endpointy REST, upload i walidacja
│   │       ├── auth.ts        # JWT i middleware autoryzacji
│   │       ├── auth.test.ts   # test tokenów sesji
│   │       ├── config.ts      # walidowane zmienne środowiska
│   │       ├── data.ts        # mapowanie i zapytania odczytowe
│   │       └── db.ts          # schemat i inicjalizacja SQLite
│   └── web/
│       └── src/
│           ├── App.tsx        # logowanie, komunikator i wszystkie przepływy UI
│           ├── api.ts         # typowany klient REST
│           ├── components.tsx # avatar, rozmowa i podgląd załączników
│           ├── main.tsx       # punkt wejścia React
│           └── styles.css     # pastelowy dark mode i responsywność
├── packages/shared/src/
│   └── index.ts               # wspólne modele i kontrakty realtime
├── .env.example               # konfiguracja lokalna i przyszłe wdrożenie
├── package.json               # monorepo npm workspaces
└── README.md                  # uruchomienie i decyzje techniczne
```

## Model danych

- `users` — tag, imię, nazwisko, hash hasła i kolor avatara.
- `users.public_key` oraz zaszyfrowany pakiet klucza prywatnego — materiał E2EE.
- `conversations` — rozmowa oraz wybrany pastelowy akcent.
- `conversation_members` — uczestnicy i znacznik ostatniego odczytu.
- `messages` — treść, nadawca, czas wysłania, odpowiedź i źródło przekazania.
- `attachments` — metadane zdjęć, PDF-ów, plików i głosówek.
- `reactions` — emotki przypisane do wiadomości i użytkownika.

## Najważniejsze przepływy

1. Rejestracja tworzy konto i zwraca 30-dniowy token JWT.
2. Użytkownik wyszukuje osobę po tagu i tworzy rozmowę 1:1.
3. Wiadomość trafia przez REST do bazy, a Socket.IO dostarcza ją obu stronom.
4. Klient emituje chwilowy stan pisania; nie jest on zapisywany w bazie.
5. Załączniki są wysyłane jako `multipart/form-data`, a katalog mediów powstaje z historii rozmowy.
6. Wyszukiwanie filtruje treść bieżącej rozmowy; API obsługuje również zapytanie `q`.
7. Odpowiedź zapisuje odwołanie do wiadomości z tej samej rozmowy.
8. Przekazanie tworzy nową wiadomość w wybranej rozmowie i zachowuje źródło.
9. Przekazywanie E2EE odbywa się po stronie klienta: lokalne odszyfrowanie i ponowne zaszyfrowanie dla rozmowy docelowej.

## Zabezpieczenia i realtime

- Pokoje Socket.IO sprawdzają członkostwo przed dołączeniem i wysłaniem stanu pisania.
- Załączniki nie są publicznym katalogiem; API wydaje je tylko członkom rozmowy.
- Obecność zlicza wszystkie aktywne karty użytkownika.
- Klient utrzymuje jedno połączenie Socket.IO i opuszcza pokój poprzedniej rozmowy.
