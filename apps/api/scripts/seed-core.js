const path = require('node:path');

const { compileStrapi, createStrapi } = require('@strapi/strapi');
const aicoContract = require('../src/bootstrap/aico-content-contract.json');

const WARSAW_TIMEZONE = 'Europe/Warsaw';
const APP_DIR = path.resolve(__dirname, '..');

const SUPPORTED_MODES = ['dev', 'stg', 'prod'];

const SIGNS = [
  {
    name: 'Baran',
    date_range: '21.03 - 19.04',
    element: 'Ogień',
    planet: 'Mars',
    description: 'Dynamiczny znak ognia, który działa odważnie i szybko.',
  },
  {
    name: 'Byk',
    date_range: '20.04 - 20.05',
    element: 'Ziemia',
    planet: 'Wenus',
    description: 'Stabilny znak ziemi, ceniący bezpieczeństwo i komfort.',
  },
  {
    name: 'Bliźnięta',
    date_range: '21.05 - 20.06',
    element: 'Powietrze',
    planet: 'Merkury',
    description: 'Komunikatywny znak powietrza o bystrym i ciekawym umyśle.',
  },
  {
    name: 'Rak',
    date_range: '21.06 - 22.07',
    element: 'Woda',
    planet: 'Księżyc',
    description: 'Wrażliwy znak wody, związany z emocjami i domem.',
  },
  {
    name: 'Lew',
    date_range: '23.07 - 22.08',
    element: 'Ogień',
    planet: 'Słońce',
    description: 'Charyzmatyczny znak ognia, który lubi tworzyć i inspirować.',
  },
  {
    name: 'Panna',
    date_range: '23.08 - 22.09',
    element: 'Ziemia',
    planet: 'Merkury',
    description: 'Analityczny znak ziemi, ceniący porządek i praktyczność.',
  },
  {
    name: 'Waga',
    date_range: '23.09 - 22.10',
    element: 'Powietrze',
    planet: 'Wenus',
    description:
      'Harmonijny znak powietrza, nastawiony na relacje i równowagę.',
  },
  {
    name: 'Skorpion',
    date_range: '23.10 - 21.11',
    element: 'Woda',
    planet: 'Pluton',
    description: 'Intensywny znak wody, kojarzony z transformacją i intuicją.',
  },
  {
    name: 'Strzelec',
    date_range: '22.11 - 21.12',
    element: 'Ogień',
    planet: 'Jowisz',
    description: 'Otwarty znak ognia, dążący do rozwoju i przygody.',
  },
  {
    name: 'Koziorożec',
    date_range: '22.12 - 19.01',
    element: 'Ziemia',
    planet: 'Saturn',
    description: 'Ambitny znak ziemi, konsekwentnie realizujący cele.',
  },
  {
    name: 'Wodnik',
    date_range: '20.01 - 18.02',
    element: 'Powietrze',
    planet: 'Uran',
    description: 'Niezależny znak powietrza, myślący przyszłościowo.',
  },
  {
    name: 'Ryby',
    date_range: '19.02 - 20.03',
    element: 'Woda',
    planet: 'Neptun',
    description: 'Empatyczny znak wody, żyjący wyobraźnią i symboliką.',
  },
];

const CATEGORIES = [
  { name: 'Astrologia', slug: 'astrologia' },
  { name: 'Tarot', slug: 'tarot' },
  { name: 'Rozwój', slug: 'rozwoj' },
];

const ARTICLES = [
  {
    title: 'Jak czytać sygnały dnia według własnego znaku',
    slug: 'jak-czytac-sygnaly-dnia-wedlug-znaku',
    excerpt:
      'Krótki rytuał poranny, który pomaga lepiej korzystać z energii dnia.',
    content:
      'Zacznij dzień od chwili ciszy i pytania: jaki jeden krok da mi dziś największy spokój? Sprawdź horoskop, ale traktuj go jako kompas do refleksji. Najważniejsze wskazówki zapisuj wieczorem, aby po tygodniu zobaczyć wzorce.',
    read_time_minutes: 5,
    author: 'Redakcja Star Sign',
    categoryName: 'Astrologia',
  },
  {
    title: 'Karta dnia: jak prowadzić osobiste archiwum odczytów',
    slug: 'karta-dnia-jak-prowadzic-archiwum-odczytow',
    excerpt: 'System notatek, który zamienia tarot w codzienny nawyk.',
    content:
      'Po każdym losowaniu zapisz jedną emocję, jedno zdanie z interpretacji i jedną decyzję na dziś. Po miesiącu wróć do wpisów i sprawdź, co się powtarza. To prosty sposób na budowanie własnego języka symboli.',
    read_time_minutes: 4,
    author: 'Redakcja Star Sign',
    categoryName: 'Tarot',
  },
  {
    title: 'Dlaczego wersja premium działa najlepiej z profilem urodzeniowym',
    slug: 'dlaczego-premium-dziala-z-profilem-urodzeniowym',
    excerpt:
      'Personalizacja treści to różnica między inspiracją a konkretną wskazówką.',
    content:
      'Podstawowy horoskop daje kierunek, a profil urodzeniowy dodaje kontekst. Dzięki danym profilu łatwiej dobrać moment działania, obszar priorytetu i styl komunikatu. To zwiększa trafność i retencję użytkownika.',
    read_time_minutes: 6,
    author: 'Zespół Produktowy',
    categoryName: 'Rozwój',
  },
  {
    title: 'Horoskop dzienny bez chaosu: jak wybrać jedną wskazówkę',
    slug: 'horoskop-dzienny-bez-chaosu',
    excerpt:
      'Prosty sposób na korzystanie z codziennego horoskopu bez nadinterpretacji.',
    content:
      'Najlepszy horoskop dzienny działa jak krótkie pytanie kontrolne. Wybierz jedną wskazówkę, zapisz ją w kalendarzu i sprawdź wieczorem, czy pomogła Ci działać spokojniej. Nie traktuj jej jak wyroku, tylko jak ramę do uważnej decyzji.',
    read_time_minutes: 5,
    author: 'Redakcja Star Sign',
    categoryName: 'Astrologia',
  },
  {
    title: 'Tarot dla początkujących: trzy pytania, które naprawdę pomagają',
    slug: 'tarot-dla-poczatkujacych-trzy-pytania',
    excerpt: 'Jak zadawać pytania kartom, żeby dostać praktyczną odpowiedź.',
    content:
      'Zamiast pytać, co się wydarzy, zapytaj: co warto zobaczyć, czego unikam i jaki pierwszy krok mogę wykonać. Tak ustawione pytania zmieniają tarot w narzędzie refleksji, a nie w obietnicę gotowej przyszłości.',
    read_time_minutes: 6,
    author: 'Redakcja Star Sign',
    categoryName: 'Tarot',
  },
  {
    title: 'Numerologia dnia: jak policzyć osobisty rytm bez tabel',
    slug: 'numerologia-dnia-jak-policzyc-osobisty-rytm',
    excerpt: 'Krótki przewodnik po osobistym numerze dnia i jego zastosowaniu.',
    content:
      'Dodaj dzień, miesiąc i rok do swojej liczby drogi życia, a potem sprowadź wynik do jednej cyfry albo liczby mistrzowskiej. Potraktuj go jako ton dnia: jedynka wspiera start, dwójka rozmowę, czwórka porządek, a dziewiątka domykanie.',
    read_time_minutes: 5,
    author: 'Redakcja Star Sign',
    categoryName: 'Rozwój',
  },
  {
    title: 'Miłosny horoskop bez presji: jak czytać sygnały w relacji',
    slug: 'milosny-horoskop-bez-presji',
    excerpt:
      'Wskazówki dla osób, które chcą korzystać z horoskopu relacyjnie i odpowiedzialnie.',
    content:
      'Horoskop miłosny najlepiej czytać jako zaproszenie do rozmowy. Jeśli tekst mówi o napięciu, nie szukaj winy, tylko nazwij potrzebę. Jeśli mówi o bliskości, wybierz konkretny gest: wiadomość, czas offline albo spokojne pytanie.',
    read_time_minutes: 6,
    author: 'Redakcja Star Sign',
    categoryName: 'Astrologia',
  },
  {
    title: 'Karta dnia w pracy: rytuał przed ważnym spotkaniem',
    slug: 'karta-dnia-w-pracy-rytual-przed-spotkaniem',
    excerpt:
      'Jak użyć jednej karty do przygotowania komunikacji i priorytetów.',
    content:
      'Przed spotkaniem wylosuj kartę i zapisz jedno hasło: czego pilnować w tonie, co uprościć i z czym nie przesadzić. Nawet jeśli traktujesz tarot symbolicznie, taka pauza pomaga wejść w rozmowę z większą uważnością.',
    read_time_minutes: 4,
    author: 'Redakcja Star Sign',
    categoryName: 'Tarot',
  },
  {
    title:
      'Znaki zodiaku i regeneracja: jak odpoczywać zgodnie z temperamentem',
    slug: 'znaki-zodiaku-i-regeneracja',
    excerpt:
      'Ogień, ziemia, powietrze i woda potrzebują innego rodzaju odpoczynku.',
    content:
      'Znaki ognia często odpoczywają przez ruch, ziemi przez rytm i zmysły, powietrza przez zmianę bodźców, a wody przez ciszę i emocjonalne domknięcie. Sprawdź swój element i dobierz odpoczynek do realnego napięcia, nie do mody.',
    read_time_minutes: 7,
    author: 'Redakcja Star Sign',
    categoryName: 'Astrologia',
  },
  {
    title: 'Jak przygotować profil urodzeniowy, żeby personalizacja miała sens',
    slug: 'jak-przygotowac-profil-urodzeniowy',
    excerpt:
      'Jakie dane warto podać i dlaczego godzina urodzenia zmienia kontekst odczytu.',
    content:
      'Data urodzenia daje podstawową mapę, miejsce dopowiada kontekst, a godzina pozwala lepiej pracować z rytmem dnia. Jeśli nie znasz dokładnej godziny, zaznacz przybliżenie i traktuj personalizację jako łagodniejszą sugestię.',
    read_time_minutes: 6,
    author: 'Zespół Produktowy',
    categoryName: 'Rozwój',
  },
  {
    title: 'Tygodniowy przegląd energii: niedzielny rytuał planowania',
    slug: 'tygodniowy-przeglad-energii',
    excerpt:
      'Prosty rytuał, który łączy astrologię, kalendarz i realne priorytety.',
    content:
      'W niedzielę wybierz trzy obszary: relacje, praca, ciało. Do każdego dopisz jedną decyzję i jeden limit. Horoskop tygodniowy potraktuj jako kontekst, a kalendarz jako miejsce, w którym ta refleksja staje się działaniem.',
    read_time_minutes: 5,
    author: 'Redakcja Star Sign',
    categoryName: 'Rozwój',
  },
  {
    title:
      'Finansowy horoskop: jak czytać go bez podejmowania impulsywnych decyzji',
    slug: 'finansowy-horoskop-bez-impulsu',
    excerpt:
      'Astrologiczne inspiracje nie zastępują planu, ale mogą pomóc sprawdzić nastawienie.',
    content:
      'Jeśli horoskop finansowy mówi o szansie, najpierw sprawdź budżet, ryzyko i termin decyzji. Jeśli mówi o ostrożności, nie zamrażaj działań, tylko poszukaj danych. Dobra interpretacja wzmacnia refleksję, nie zastępuje odpowiedzialności.',
    read_time_minutes: 6,
    author: 'Redakcja Star Sign',
    categoryName: 'Astrologia',
  },
];

const PRODUCTS = [
  {
    name: 'Ametyst Intuicji',
    sku: 'AMETYST-INTUICJI',
    price: 49,
    currency: 'PLN',
    stock_status: 'in_stock',
    category: 'Kryształy',
    symbol: 'A',
    tag: 'Bestseller',
    description: 'Naturalny kryształ ametystu wspierający intuicję.',
  },
  {
    name: 'Świeca Intencji Księżyc',
    sku: 'SWIECA-KSIEZYC',
    price: 89,
    currency: 'PLN',
    stock_status: 'in_stock',
    category: 'Świece',
    symbol: 'S',
    tag: 'Nowość',
    description: 'Ręcznie robiona świeca sojowa do wieczornego rytuału.',
  },
  {
    name: 'Zestaw Początkujący Tarot',
    sku: 'TAROT-STARTER',
    price: 120,
    currency: 'PLN',
    stock_status: 'in_stock',
    category: 'Karty',
    symbol: 'T',
    tag: 'Zestaw',
    description: 'Talia kart tarota z przewodnikiem.',
  },
  {
    name: 'Naszyjnik Fazy Księżyca',
    sku: 'NASZYJNIK-FAZY-KSIEZYCA',
    price: 159,
    currency: 'PLN',
    stock_status: 'in_stock',
    category: 'Biżuteria',
    symbol: 'N',
    description: 'Srebrny naszyjnik przedstawiający fazy księżyca.',
  },
  {
    name: 'Kadzidło Biała Szałwia',
    sku: 'KADZIDLO-BIALA-SZALWIA',
    price: 29,
    currency: 'PLN',
    stock_status: 'in_stock',
    category: 'Kadzidła',
    symbol: 'K',
    tag: 'Bestseller',
    description: 'Pęczek białej szałwii do oczyszczania przestrzeni.',
  },
];

const TAROT_CARDS = [
  {
    name: 'Głupiec',
    arcana: 'Wielkie Arkana · 0',
    meaning_upright: 'Nowy początek, spontaniczność i zaufanie do procesu.',
    description: 'Karta otwarcia nowego etapu i odwagi do pierwszego kroku.',
    symbol: 'GLUPIEC',
    slug: 'glupiec',
  },
  {
    name: 'Mag',
    arcana: 'Wielkie Arkana · I',
    meaning_upright: 'Sprawczość, koncentracja i manifestacja celu.',
    description: 'Masz zasoby, aby przejść od zamiaru do działania.',
    symbol: 'MAG',
    slug: 'mag',
  },
  {
    name: 'Kapłanka',
    arcana: 'Wielkie Arkana · II',
    meaning_upright: 'Intuicja, cisza i głębszy wgląd.',
    description: 'Warto słuchać subtelnych sygnałów i nie działać impulsywnie.',
    symbol: 'KAPLANKA',
    slug: 'kaplanka',
  },
  {
    name: 'Cesarzowa',
    arcana: 'Wielkie Arkana · III',
    meaning_upright: 'Tworzenie, obfitość i troska o rozwój.',
    description: 'To dobry moment na pielęgnowanie projektów i relacji.',
    symbol: 'CESARZOWA',
    slug: 'cesarzowa',
  },
  {
    name: 'Kochankowie',
    arcana: 'Wielkie Arkana · VI',
    meaning_upright: 'Wybór zgodny z wartościami i sercem.',
    description: 'Decyzje relacyjne i życiowe wymagają spójności z sobą.',
    symbol: 'KOCHANKOWIE',
    slug: 'kochankowie',
  },
  {
    name: 'Cesarz',
    arcana: 'Wielkie Arkana · IV',
    meaning_upright: 'Struktura, odpowiedzialność i spokojne przywództwo.',
    meaning_reversed: 'Kontrola, sztywność albo brak stabilnych granic.',
    description: 'Karta zachęca do planu, porządku i konsekwencji.',
    symbol: 'CESARZ',
    slug: 'cesarz',
  },
  {
    name: 'Kapłan',
    arcana: 'Wielkie Arkana · V',
    meaning_upright: 'Nauka, tradycja, mentorstwo i wartości.',
    meaning_reversed:
      'Dogmatyzm, presja otoczenia albo potrzeba własnej drogi.',
    description:
      'Szukaj sprawdzonej wiedzy, ale filtruj ją przez własne wartości.',
    symbol: 'KAPLAN',
    slug: 'kaplan',
  },
  {
    name: 'Rydwan',
    arcana: 'Wielkie Arkana · VII',
    meaning_upright: 'Determinacja, ruch i zwycięstwo dzięki dyscyplinie.',
    meaning_reversed: 'Brak kierunku, pośpiech albo walka z samym sobą.',
    description: 'Ustal kierunek i prowadź energię zamiast ją rozpraszać.',
    symbol: 'RYDWAN',
    slug: 'rydwan',
  },
  {
    name: 'Sprawiedliwość',
    arcana: 'Wielkie Arkana · VIII',
    meaning_upright: 'Uczciwość, równowaga i konsekwencje decyzji.',
    meaning_reversed: 'Unikanie odpowiedzialności albo brak przejrzystości.',
    description: 'Karta przypomina, że jasność faktów przynosi spokój.',
    symbol: 'SPRAWIEDLIWOSC',
    slug: 'sprawiedliwosc',
  },
  {
    name: 'Pustelnik',
    arcana: 'Wielkie Arkana · IX',
    meaning_upright: 'Wgląd, samotna refleksja i mądrość doświadczenia.',
    meaning_reversed: 'Izolacja, zwlekanie albo zamknięcie na wsparcie.',
    description: 'Zatrzymaj się, aby zobaczyć, czego naprawdę potrzebujesz.',
    symbol: 'PUSTELNIK',
    slug: 'pustelnik',
  },
  {
    name: 'Koło Fortuny',
    arcana: 'Wielkie Arkana · X',
    meaning_upright: 'Zmiana cyklu, szansa i zwrot sytuacji.',
    meaning_reversed: 'Opór wobec zmiany albo powtarzanie starego schematu.',
    description: 'Nie wszystko kontrolujesz, ale możesz mądrze odpowiedzieć.',
    symbol: 'KOLO_FORTUNY',
    slug: 'kolo-fortuny',
  },
  {
    name: 'Moc',
    arcana: 'Wielkie Arkana · XI',
    meaning_upright: 'Odwaga, łagodność i panowanie nad impulsem.',
    meaning_reversed: 'Wątpliwość, napięcie albo próba forsowania sytuacji.',
    description: 'Największa siła działa spokojnie, bez potrzeby udowadniania.',
    symbol: 'MOC',
    slug: 'moc',
  },
  {
    name: 'Wisielec',
    arcana: 'Wielkie Arkana · XII',
    meaning_upright: 'Nowa perspektywa, pauza i świadome odpuszczenie.',
    meaning_reversed:
      'Tkwienie w zawieszeniu albo opór przed zmianą spojrzenia.',
    description: 'Zmiana kąta patrzenia może odblokować dalszy ruch.',
    symbol: 'WISIELEC',
    slug: 'wisielec',
  },
  {
    name: 'Śmierć',
    arcana: 'Wielkie Arkana · XIII',
    meaning_upright: 'Transformacja, koniec etapu i miejsce na nowe.',
    meaning_reversed: 'Lęk przed końcem, przywiązanie do przeszłości.',
    description: 'Karta mówi o przemianie, nie o dosłownej zapowiedzi straty.',
    symbol: 'SMIERC',
    slug: 'smierc',
  },
  {
    name: 'Umiarkowanie',
    arcana: 'Wielkie Arkana · XIV',
    meaning_upright: 'Harmonia, cierpliwość i łączenie przeciwieństw.',
    meaning_reversed:
      'Przesada, brak rytmu albo trudność w znalezieniu środka.',
    description: 'Najlepszy efekt przyjdzie przez wyważenie, nie skrajności.',
    symbol: 'UMIARKOWANIE',
    slug: 'umiarkowanie',
  },
  {
    name: 'Diabeł',
    arcana: 'Wielkie Arkana · XV',
    meaning_upright: 'Przywiązania, pokusy i świadomość ograniczeń.',
    meaning_reversed:
      'Uwalnianie się, przełamanie schematu albo odzyskanie wpływu.',
    description: 'Zobacz, co odbiera Ci wolność wyboru.',
    symbol: 'DIABEL',
    slug: 'diabel',
  },
  {
    name: 'Wieża',
    arcana: 'Wielkie Arkana · XVI',
    meaning_upright: 'Nagłe ujawnienie prawdy i rozpad nietrwałej struktury.',
    meaning_reversed:
      'Odkładany przełom albo próba ratowania tego, co nie działa.',
    description: 'To moment szczerości, który może oczyścić sytuację.',
    symbol: 'WIEZA',
    slug: 'wieza',
  },
  {
    name: 'Gwiazda',
    arcana: 'Wielkie Arkana · XVII',
    meaning_upright: 'Nadzieja, regeneracja i powrót zaufania.',
    meaning_reversed:
      'Zwątpienie, zmęczenie albo trudność w przyjęciu wsparcia.',
    description: 'Daj sobie czas na odbudowę i łagodny kierunek.',
    symbol: 'GWIAZDA',
    slug: 'gwiazda',
  },
  {
    name: 'Księżyc',
    arcana: 'Wielkie Arkana · XVIII',
    meaning_upright: 'Podświadomość, sny i niejasność wymagająca intuicji.',
    meaning_reversed: 'Rozjaśnienie lęku, wyjście z iluzji albo ukryta prawda.',
    description:
      'Nie wszystko jest jeszcze widoczne, więc sprawdzaj fakty spokojnie.',
    symbol: 'KSIEZYC',
    slug: 'ksiezyc',
  },
  {
    name: 'Słońce',
    arcana: 'Wielkie Arkana · XIX',
    meaning_upright: 'Radość, klarowność i życiowa energia.',
    meaning_reversed:
      'Przygaszona pewność siebie albo opóźnione poczucie lekkości.',
    description: 'Karta wnosi prostotę, ciepło i widoczny postęp.',
    symbol: 'SLONCE',
    slug: 'slonce',
  },
  {
    name: 'Sąd Ostateczny',
    arcana: 'Wielkie Arkana · XX',
    meaning_upright: 'Przebudzenie, decyzja i zamknięcie starego rozdziału.',
    meaning_reversed: 'Unikanie wezwania, samokrytyka albo lęk przed oceną.',
    description: 'Czas usłyszeć, do czego dojrzewałaś lub dojrzewałeś.',
    symbol: 'SAD_OSTATECZNY',
    slug: 'sad-ostateczny',
  },
  {
    name: 'Świat',
    arcana: 'Wielkie Arkana · XXI',
    meaning_upright: 'Spełnienie, integracja i domknięcie cyklu.',
    meaning_reversed:
      'Niedokończenie, brak ostatniego kroku albo rozproszenie.',
    description: 'Zbierasz efekty procesu i możesz przejść dalej pełniej.',
    symbol: 'SWIAT',
    slug: 'swiat',
  },
];

const NUMEROLOGY = [
  {
    number: 1,
    title: 'Lider',
    description: 'Samodzielność i inicjatywa.',
    extended_description:
      'Jedynka buduje przez działanie i odwagę. Wyzwanie: cierpliwość i współpraca.',
  },
  {
    number: 2,
    title: 'Mediator',
    description: 'Wrażliwość i relacje.',
    extended_description:
      'Dwójka wspiera zespoły i relacje. Wyzwanie: stawianie granic.',
  },
  {
    number: 3,
    title: 'Twórca',
    description: 'Ekspresja i komunikacja.',
    extended_description:
      'Trójka rozwija się przez twórczość i słowo. Wyzwanie: konsekwencja.',
  },
  {
    number: 4,
    title: 'Budowniczy',
    description: 'Struktura i porządek.',
    extended_description:
      'Czwórka daje stabilność i system. Wyzwanie: elastyczność.',
  },
  {
    number: 5,
    title: 'Odkrywca',
    description: 'Zmiana i wolność.',
    extended_description:
      'Piątka rośnie przez nowe doświadczenia. Wyzwanie: domykanie rozpoczętych spraw.',
  },
  {
    number: 6,
    title: 'Opiekun',
    description: 'Odpowiedzialność i harmonia.',
    extended_description:
      'Szóstka wnosi opiekę i piękno. Wyzwanie: dbanie o siebie równie mocno jak o innych.',
  },
  {
    number: 7,
    title: 'Analityk',
    description: 'Wiedza i introspekcja.',
    extended_description:
      'Siódemka szuka sensu i głębi. Wyzwanie: nie izolować się od ludzi.',
  },
  {
    number: 8,
    title: 'Strateg',
    description: 'Skuteczność i wpływ.',
    extended_description:
      'Ósemka realizuje cele i zarządza zasobami. Wyzwanie: równowaga między wynikiem a relacjami.',
  },
  {
    number: 9,
    title: 'Humanista',
    description: 'Empatia i misja.',
    extended_description:
      'Dziewiątka działa dla większego dobra. Wyzwanie: kończenie etapów i odpuszczanie.',
  },
  {
    number: 11,
    title: 'Mistrz Intuicji',
    description: 'Silna intuicja, inspiracja i wrażliwość na znaczenia.',
    extended_description:
      'Jedenastka uczy zaufania do wewnętrznego głosu. Wyzwanie: uziemienie wizji w codziennym rytmie.',
  },
  {
    number: 22,
    title: 'Mistrz Budowniczy',
    description: 'Wizja, wpływ i zdolność przekuwania idei w strukturę.',
    extended_description:
      'Dwudziestka dwójka łączy intuicję z organizacją. Wyzwanie: działać krok po kroku, bez paraliżu skalą.',
  },
  {
    number: 33,
    title: 'Mistrz Nauczyciel',
    description: 'Opieka, przewodnictwo i mądrość relacji.',
    extended_description:
      'Trzydziestka trójka niesie energię wspierania innych. Wyzwanie: pomagać bez rezygnowania z siebie.',
  },
];

const DEMO_USER = {
  username: 'demo_starsign',
  email: 'demo@starsign.local',
  password: 'Test1234!',
};

const PREMIUM_USER = {
  username: 'premium_starsign',
  email: 'premium@starsign.local',
  password: 'Test1234!',
};

const BASE_PUBLIC_READ_ACTIONS = [
  'api::article.article.find',
  'api::article.article.findOne',
  'api::category.category.find',
  'api::category.category.findOne',
  'api::horoscope.horoscope.find',
  'api::horoscope.horoscope.findOne',
  'api::numerology-profile.numerology-profile.find',
  'api::numerology-profile.numerology-profile.findOne',
  'api::tarot-card.tarot-card.find',
  'api::tarot-card.tarot-card.findOne',
  'api::zodiac-sign.zodiac-sign.find',
  'api::zodiac-sign.zodiac-sign.findOne',
];

const SHOP_PUBLIC_READ_ACTIONS = [
  'api::product.product.find',
  'api::product.product.findOne',
];
const MANAGED_PUBLIC_READ_ACTIONS = [
  ...BASE_PUBLIC_READ_ACTIONS,
  ...SHOP_PUBLIC_READ_ACTIONS,
];
const READ_ROLE_TYPES = ['public', 'authenticated'];

const dailyHoroscopeTemplates = {
  Ogólny:
    'Dziś najwięcej korzyści przyniesie Ci skupienie na jednym celu i spokojna realizacja planu.',
  Miłosny:
    'W relacjach postaw na prostą rozmowę, uważność i gest, który pokaże drugiej stronie realne zaangażowanie.',
  Zawodowy:
    'W pracy wygrają konkrety: uporządkuj priorytety, dopnij najważniejszy temat i nie rozpraszaj energii.',
  Finansowy:
    'Finanse wymagają dziś rozsądnego tempa. Sprawdź szczegóły, odłóż impulsywną decyzję i wybierz stabilność.',
  Chiński:
    'Dzisiejsza energia Wschodu wspiera cierpliwe działanie, obserwację cykli i spokojne wybieranie właściwego momentu.',
  Celtycki:
    'Rytm natury wzmacnia intuicję. Zwróć uwagę na znaki w rozmowach, powrotach i prostych gestach równowagi.',
  Egipski:
    'Symboliczna opieka dawnych archetypów sprzyja porządkowaniu intencji i ochronie tego, co naprawdę wzmacnia Twoją drogę.',
};

const generalPeriodTemplates = {
  Tygodniowy:
    'Ten tydzień sprzyja porządkowaniu priorytetów i domykaniu spraw, które przeciągały się od dłuższego czasu.',
  Miesięczny:
    'Najbliższy miesiąc wspiera budowanie stabilnych nawyków i rozwój relacji opartych na zaufaniu.',
  Roczny:
    'Ten rok prowadzi Cię w stronę dojrzalszych decyzji, lepszego planowania i odwagi w wyborze własnej drogi.',
};

const buildPremiumContent = (label) => `${label}: Pełna interpretacja Premium.

Relacje: wybierz jedną relację, w której chcesz dziś działać spokojniej i uczciwiej. Nazwij fakt, potrzebę oraz granicę, zanim dopiszesz w myślach intencje drugiej osoby. Premium prowadzi do kontaktu bez presji: krótkiej rozmowy, jednego jasnego zdania i gotowości, aby słuchać odpowiedzi bez natychmiastowego bronienia swojej racji. Dodaj test rzeczywistości: sprawdź, czy reagujesz na aktualną sytuację, czy na wcześniejszy lęk przed odrzuceniem.

Praca: przesuń energię z planowania na domykanie. Wybierz zadanie, które ma widoczny koniec i realnie zmniejszy napięcie. Ustal minimalny dobry rezultat, zamknij rozpraszacze i wykonaj pierwszy krok przed sprawami pobocznymi. Jeżeli pojawi się chaos, wróć do pytania, co dziś buduje stabilność, a co jest tylko reakcją na cudze tempo. Zapisz także koszt decyzji: czas, uwagę albo rozmowę, której nie warto dłużej odkładać.

Energia dnia: ciało potrzebuje prostego rytmu: wody, oddechu, krótkiej pauzy i jednej decyzji mniej. Zwróć uwagę na barki, szczękę oraz dłonie, bo tam najszybciej zapisuje się pośpiech. Nie musisz rozwiązać wszystkiego naraz. Wystarczy, że wybierzesz najspokojniejszy następny krok i wykonasz go bez przeciążania siebie. Po południu oceń pobudzenie w skali od jednego do dziesięciu i najpierw obniż napięcie, zanim odpowiesz na wymagającą wiadomość.

Rytuał: usiądź przy naturalnym świetle albo zapal małą świecę. Zapisz zdanie zaczynające się od słów "Dziś wybieram". Dopisz trzy gesty, które potwierdzą tę intencję w relacjach, pracy i odpoczynku. Przez dziewięć oddechów trzymaj uwagę na sercu, a potem wykonaj pierwszy najmniejszy gest od razu. Wieczorem wróć do notatki i dopisz, co naprawdę zadziałało. Dzięki temu Premium staje się osobistym archiwum wzorców, nie jednorazową inspiracją.

Pytanie refleksyjne: który wybór wzmacnia mój spokój i sprawczość, nawet jeśli wymaga ode mnie większej szczerości niż zwykle? Jaką jedną decyzję mogę odłożyć, dopóki nie wrócę do spokojniejszego oddechu i pełniejszego obrazu sytuacji?`;

const DEV_TOPIC_QUEUE = [
  {
    seedKey: 'dev-1',
    title: 'Kiedy warto działać, a kiedy poczekać? Astrologiczny rytm dnia',
    brief:
      'Artykuł poradnikowy dla początkujących. Forma: checklista poranna i wieczorna. Ton: spokojny i praktyczny.',
    daysOffset: 0,
  },
  {
    seedKey: 'dev-2',
    title: 'Tranzyty tygodnia: 3 momenty, które warto wykorzystać',
    brief:
      'Podsumowanie tygodnia z naciskiem na relacje, finanse i pracę. Zakończ krótkim planem działań.',
    daysOffset: 1,
  },
  {
    seedKey: 'dev-3',
    title: 'Karta dnia w praktyce: jak podjąć jedną dobrą decyzję',
    brief:
      'Krótki materiał edukacyjny o zastosowaniu karty dnia w codziennym planowaniu.',
    daysOffset: 2,
  },
  {
    seedKey: 'dev-4',
    title: 'Horoskop miesięczny a cele finansowe: jak planować mądrzej',
    brief:
      'Artykuł evergreen o łączeniu planowania finansowego z rytmem miesięcznym.',
    daysOffset: 3,
  },
  {
    seedKey: 'dev-5',
    title: '5 błędów przy interpretacji horoskopu i jak ich unikać',
    brief: 'Treść edukacyjna SEO, lista błędów + konkretne rozwiązania.',
    daysOffset: 4,
  },
];

const STG_PROD_TOPIC_QUEUE = [
  {
    seedKey: 'stg-prod-1',
    title: 'Horoskop tygodniowy: jak zaplanować priorytety na najbliższe 7 dni',
    brief:
      'Artykuł praktyczny, struktura: wstęp, 3 obszary życia, podsumowanie z CTA do profilu urodzeniowego.',
    daysOffset: 0,
  },
  {
    seedKey: 'stg-prod-2',
    title: 'Karta dnia i produktywność: krótki rytuał dla zapracowanych',
    brief: 'Dla odbiorcy 25-45, styl prosty, bez ezoterycznego żargonu.',
    daysOffset: 1,
  },
  {
    seedKey: 'stg-prod-3',
    title: 'Miesięczny reset energii: jak domknąć stary miesiąc i wejść w nowy',
    brief:
      'Treść magazynowa, elegancki ton, konkretne ćwiczenia i checklista na koniec artykułu.',
    daysOffset: 2,
  },
  {
    seedKey: 'stg-prod-4',
    title:
      'Jak czytać horoskop miłosny, żeby nie podejmować impulsywnych decyzji',
    brief:
      'Edukacyjny materiał z elementami psychologii relacji. Bez straszenia, bez skrajnych tez.',
    daysOffset: 3,
  },
  {
    seedKey: 'stg-prod-5',
    title: 'Astrologiczny plan tygodnia dla freelancera i małej firmy',
    brief:
      'Nastawienie na planowanie pracy, klientów i regeneracji. Ton profesjonalny.',
    daysOffset: 4,
  },
  {
    seedKey: 'stg-prod-6',
    title: 'Tarot a decyzje zawodowe: kiedy zaufać intuicji, a kiedy danym',
    brief: 'Artykuł balansujący intuicję i pragmatyzm. Sekcja Q&A na końcu.',
    daysOffset: 5,
  },
  {
    seedKey: 'stg-prod-7',
    title: 'Znaki zodiaku i styl komunikacji: przewodnik dla zespołów',
    brief:
      'Format poradnikowy dla HR i liderów zespołów. Konkretne przykłady zachowań.',
    daysOffset: 6,
  },
];

const BLOG_IMAGE_ASSET_KEYS = [
  'blog-astro-01',
  'blog-astro-02',
  'blog-astro-03',
  'blog-astro-04',
  'blog-astro-05',
  'blog-astro-06',
  'blog-astro-07',
];

const DAILY_CARD_IMAGE_ASSET_KEYS = [
  'daily-card-01',
  'daily-card-02',
  'daily-card-03',
  'daily-card-04',
  'daily-card-05',
];

const MEDIA_ASSET_PLACEHOLDERS = [
  ...BLOG_IMAGE_ASSET_KEYS.map((assetKey, index) => ({
    asset_key: assetKey,
    label: `Blog Astro ${String(index + 1).padStart(2, '0')}`,
    purpose: 'blog_article',
    period_scope: 'any',
    priority: 10 - index,
    active: true,
    cooldown_days: 3,
    keywords: ['blog', 'astro', 'article'],
    mapping_source: 'seed',
    mapping_confidence: 1,
    mapping_reasons: ['Seed placeholder'],
    notes: 'Placeholder do ręcznego mapowania obrazu z Media Library.',
  })),
  ...DAILY_CARD_IMAGE_ASSET_KEYS.map((assetKey, index) => ({
    asset_key: assetKey,
    label: `Daily Card ${String(index + 1).padStart(2, '0')}`,
    purpose: 'daily_card',
    period_scope: 'daily',
    priority: 10 - index,
    active: true,
    cooldown_days: 3,
    keywords: ['daily', 'card', 'tarot'],
    mapping_source: 'seed',
    mapping_confidence: 1,
    mapping_reasons: ['Seed placeholder'],
    notes: 'Placeholder do ręcznego mapowania obrazu z Media Library.',
  })),
  {
    asset_key: 'fallback-general-01',
    label: 'Fallback General 01',
    purpose: 'fallback_general',
    period_scope: 'any',
    priority: 1,
    active: true,
    cooldown_days: 3,
    keywords: ['fallback', 'general'],
    mapping_source: 'seed',
    mapping_confidence: 1,
    mapping_reasons: ['Seed placeholder'],
    notes: 'Globalny fallback używany po ręcznym przypięciu pliku media.',
  },
];

const getWarsawDate = (date = new Date()) =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const plusDaysIso = (days) =>
  new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

const plusDaysAtTimeIso = (daysOffset, hour = 6, minute = 0) => {
  const base = new Date();
  base.setUTCDate(base.getUTCDate() + daysOffset);
  base.setUTCHours(hour, minute, 0, 0);
  return base.toISOString();
};

const toBoolean = (value, fallback = false) => {
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (normalized === 'true' || normalized === '1' || normalized === 'yes') {
      return true;
    }
    if (normalized === 'false' || normalized === '0' || normalized === 'no') {
      return false;
    }
  }

  return fallback;
};

const toOptionalBoolean = (value) => {
  if (typeof value !== 'string') {
    return null;
  }

  const normalized = value.trim().toLowerCase();
  if (['true', '1', 'yes'].includes(normalized)) {
    return true;
  }
  if (['false', '0', 'no'].includes(normalized)) {
    return false;
  }

  return null;
};

const toOptionalInteger = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const parsed = Number.parseInt(value.trim(), 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const isRecord = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const firstNonEmpty = (values) =>
  values.find((value) => typeof value === 'string' && value.trim().length > 0)?.trim() || '';

const isShopEnabled = () => toBoolean(process.env.SHOP_ENABLED, false);

const upsertOne = async (strapi, uid, where, data) => {
  const query = strapi.db.query(uid);
  const existing = await query.findOne({ where });

  if (existing) {
    return query.update({
      where: { id: existing.id },
      data,
    });
  }

  return query.create({ data });
};

const resolveRelationId = (value) => {
  if (typeof value === 'number') {
    return value;
  }

  if (value && typeof value === 'object' && typeof value.id === 'number') {
    return value.id;
  }

  return null;
};

const setPermission = (permissions, actionId, enabled) => {
  const [typeName, controllerName, actionName] = actionId.split('.');
  const action =
    permissions?.[typeName]?.controllers?.[controllerName]?.[actionName];

  if (!action) {
    return false;
  }

  action.enabled = enabled;
  return true;
};

const ensureReadPermissions = async (strapi) => {
  const roleService = strapi.plugin('users-permissions').service('role');
  const enabledActions = new Set([
    ...BASE_PUBLIC_READ_ACTIONS,
    ...(isShopEnabled() ? SHOP_PUBLIC_READ_ACTIONS : []),
  ]);

  for (const roleType of READ_ROLE_TYPES) {
    const dbRole = await strapi.db
      .query('plugin::users-permissions.role')
      .findOne({
        where: { type: roleType },
      });

    if (!dbRole) {
      throw new Error(`Brak roli "${roleType}" w users-permissions.`);
    }

    const role = await roleService.findOne(dbRole.id);
    const missingActions = [];

    for (const actionId of MANAGED_PUBLIC_READ_ACTIONS) {
      const exists = setPermission(
        role.permissions,
        actionId,
        enabledActions.has(actionId),
      );
      if (!exists && enabledActions.has(actionId)) {
        missingActions.push(actionId);
      }
    }

    if (missingActions.length > 0) {
      throw new Error(
        `Nie znaleziono akcji dla roli "${roleType}": ${missingActions.join(', ')}`,
      );
    }

    await roleService.updateRole(dbRole.id, {
      name: role.name,
      description: role.description,
      permissions: role.permissions,
    });
  }
};

const seedZodiacSigns = async (strapi) => {
  const byName = new Map();

  for (const sign of SIGNS) {
    const seeded = await upsertOne(
      strapi,
      'api::zodiac-sign.zodiac-sign',
      { name: sign.name },
      sign,
    );
    byName.set(seeded.name, seeded);
  }

  return byName;
};

const seedCategories = async (strapi) => {
  const byName = new Map();

  for (const category of CATEGORIES) {
    const seeded = await upsertOne(
      strapi,
      'api::category.category',
      { name: category.name },
      category,
    );
    byName.set(seeded.name, seeded);
  }

  return byName;
};

const seedArticles = async (strapi, categoriesByName) => {
  const publishedAt = new Date().toISOString();

  for (const article of ARTICLES) {
    const category = categoriesByName.get(article.categoryName);

    await upsertOne(
      strapi,
      'api::article.article',
      { slug: article.slug },
      {
        title: article.title,
        slug: article.slug,
        content: article.content,
        premiumContent: `${buildPremiumContent(article.title)}\n\n${buildPremiumContent(
          `${article.title} - praktyka`,
        )}`,
        isPremium: true,
        excerpt: article.excerpt,
        read_time_minutes: article.read_time_minutes,
        author: article.author,
        category: category?.id || null,
        publishedAt,
      },
    );
  }
};

const seedProducts = async (strapi) => {
  const publishedAt = new Date().toISOString();

  for (const product of PRODUCTS) {
    await upsertOne(
      strapi,
      'api::product.product',
      { sku: product.sku },
      {
        ...product,
        publishedAt,
      },
    );
  }
};

const seedTarotCards = async (strapi) => {
  const bySlug = new Map();
  const publishedAt = new Date().toISOString();

  for (const card of TAROT_CARDS) {
    const seeded = await upsertOne(
      strapi,
      'api::tarot-card.tarot-card',
      { slug: card.slug },
      {
        ...card,
        publishedAt,
      },
    );
    bySlug.set(seeded.slug, seeded);
  }

  return bySlug;
};

const seedDailyTarotDraw = async (strapi, cardsBySlug) => {
  const today = getWarsawDate();
  const firstCard =
    cardsBySlug.get('glupiec') || [...cardsBySlug.values()][0] || null;

  if (!firstCard) {
    return;
  }

  await upsertOne(
    strapi,
    'api::daily-tarot-draw.daily-tarot-draw',
    { draw_date: today },
    {
      draw_date: today,
      card: firstCard.id,
      message:
        'Dziś postaw na odwagę pierwszego kroku i zaufanie do swojej intuicji.',
    },
  );
};

const seedNumerology = async (strapi) => {
  const publishedAt = new Date().toISOString();

  for (const item of NUMEROLOGY) {
    await upsertOne(
      strapi,
      'api::numerology-profile.numerology-profile',
      { number: item.number },
      {
        ...item,
        publishedAt,
      },
    );
  }
};

const seedHoroscopes = async (strapi, signsByName) => {
  const today = getWarsawDate();
  const publishedAt = new Date().toISOString();

  for (const sign of signsByName.values()) {
    for (const [type, baseContent] of Object.entries(dailyHoroscopeTemplates)) {
      await upsertOne(
        strapi,
        'api::horoscope.horoscope',
        {
          zodiac_sign: sign.id,
          period: 'Dzienny',
          date: today,
          type,
        },
        {
          type,
          period: 'Dzienny',
          date: today,
          zodiac_sign: sign.id,
          content: `${sign.name}: ${baseContent}`,
          premiumContent: buildPremiumContent(`${sign.name} ${type}`),
          publishedAt,
        },
      );
    }

    for (const [period, baseContent] of Object.entries(
      generalPeriodTemplates,
    )) {
      await upsertOne(
        strapi,
        'api::horoscope.horoscope',
        {
          zodiac_sign: sign.id,
          period,
          date: today,
          type: 'Ogólny',
        },
        {
          type: 'Ogólny',
          period,
          date: today,
          zodiac_sign: sign.id,
          content: `${sign.name}: ${baseContent}`,
          premiumContent: `${buildPremiumContent(
            `${sign.name} ${period}`,
          )}\n\n${buildPremiumContent(`${sign.name} ${period} - druga warstwa`)}`,
          publishedAt,
        },
      );
    }
  }
};

const ensureSeedUser = async (strapi, signsByName, config) => {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({
    where: { type: 'authenticated' },
  });

  if (!role) {
    throw new Error('Brak roli "authenticated" w users-permissions.');
  }

  const userService = strapi.plugin('users-permissions').service('user');
  const existing = await strapi.db
    .query('plugin::users-permissions.user')
    .findOne({
      where: { email: config.user.email },
    });

  let user;

  if (existing) {
    user = await userService.edit(existing.id, {
      username: config.user.username,
      email: config.user.email,
      password: config.user.password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: role.id,
    });
  } else {
    user = await userService.add({
      username: config.user.username,
      email: config.user.email,
      password: config.user.password,
      provider: 'local',
      confirmed: true,
      blocked: false,
      role: role.id,
    });
  }

  const sign =
    signsByName.get(config.signName) || [...signsByName.values()][0] || null;

  const profile = await upsertOne(
    strapi,
    'api::user-profile.user-profile',
    { user: user.id },
    {
      user: user.id,
      zodiac_sign: sign?.id || null,
      birth_date: config.profile.birth_date,
      birth_time: config.profile.birth_time,
      birth_place: config.profile.birth_place,
      marketing_consent: true,
      subscription_status: config.profile.subscription_status,
      subscription_plan: config.profile.subscription_plan,
      stripe_customer_id: config.profile.stripe_customer_id,
      stripe_subscription_id: config.profile.stripe_subscription_id,
      trial_ends_at: config.profile.trial_ends_at,
      current_period_end: config.profile.current_period_end,
      cancel_at_period_end: false,
      last_synced_at: new Date().toISOString(),
    },
  );

  const today = getWarsawDate();

  for (const reading of config.readings) {
    await upsertOne(
      strapi,
      'api::user-reading.user-reading',
      {
        user: user.id,
        reading_type: reading.reading_type,
        reading_date: today,
      },
      {
        user: user.id,
        reading_type: reading.reading_type,
        title: reading.title.replace('{{today}}', today),
        summary: reading.summary,
        content: reading.content,
        period: reading.period || null,
        sign_slug: sign?.slug || profile?.zodiac_sign?.slug || null,
        reading_date: today,
        is_premium: true,
        source: config.source,
        metadata: reading.metadata || {},
      },
    );
  }
};

const ensureDemoUser = async (strapi, signsByName) =>
  ensureSeedUser(strapi, signsByName, {
    user: DEMO_USER,
    signName: 'Baran',
    source: 'seed-dev-demo',
    profile: {
      birth_date: '1992-04-08',
      birth_time: '08:45:00.000',
      birth_place: 'Warszawa',
      subscription_status: 'trialing',
      subscription_plan: 'monthly',
      stripe_customer_id: 'cus_dev_demo',
      stripe_subscription_id: 'sub_dev_demo',
      trial_ends_at: plusDaysIso(7),
      current_period_end: plusDaysIso(30),
    },
    readings: [
      {
        reading_type: 'horoscope',
        title: 'Horoskop dnia {{today}}',
        summary: 'Dziś warto działać spokojnie i konsekwentnie.',
        content:
          'Wersja premium: skup się na jednym priorytecie i wróć do zadania o najwyższym wpływie. Wieczorem zapisz jeden wniosek z dnia.',
        period: 'dzienny',
      },
      {
        reading_type: 'tarot',
        title: 'Karta dnia: Głupiec',
        summary: 'To dobry moment na pierwszy krok i świeże spojrzenie.',
        content:
          'Wersja premium: zamiast szukać idealnego planu, wybierz najmniejszą możliwą akcję i wykonaj ją jeszcze dziś.',
        metadata: { cardSlug: 'glupiec' },
      },
    ],
  });

const ensurePremiumUser = async (strapi, signsByName) =>
  ensureSeedUser(strapi, signsByName, {
    user: PREMIUM_USER,
    signName: 'Waga',
    source: 'seed-dev-premium',
    profile: {
      birth_date: '1989-10-04',
      birth_time: '19:20:00.000',
      birth_place: 'Kraków',
      subscription_status: 'active',
      subscription_plan: 'annual',
      stripe_customer_id: 'cus_dev_premium',
      stripe_subscription_id: 'sub_dev_premium',
      trial_ends_at: null,
      current_period_end: plusDaysIso(365),
    },
    readings: [
      {
        reading_type: 'horoscope',
        title: 'Premium horoskop dnia {{today}}',
        summary:
          'Pełny odczyt premium z naciskiem na relacje, pracę i regenerację.',
        content:
          'Twoja aktywna subskrypcja premium odblokowuje głębszą interpretację dnia. Dla Wagi najważniejsza jest dziś jakość rozmów: wybierz jedną relację, w której możesz nazwać potrzeby bez nacisku. W pracy postaw na decyzję, która porządkuje kalendarz na kolejne dni.',
        period: 'dzienny',
      },
      {
        reading_type: 'tarot',
        title: 'Premium karta dnia: Gwiazda',
        summary:
          'Karta premium wspiera spokojny powrót do zaufania i długiego planu.',
        content:
          'Gwiazda w odczycie premium mówi o regeneracji po okresie przeciążenia. Nie musisz dziś przyspieszać. Wybierz jedną rzecz, która odbudowuje poczucie wpływu: rozmowę, uporządkowanie przestrzeni albo zapisanie decyzji, którą odkładasz.',
        metadata: { cardSlug: 'gwiazda', premiumFixture: true },
      },
    ],
  });

const getModeDefaults = (mode) => {
  if (mode === 'dev') {
    return {
      includeDemoUser: true,
      includeBootstrapArticles: true,
      includeProducts: true,
      includeTopicQueue: true,
      requireOpenRouterToken: false,
      defaultEnableWorkflows: false,
    };
  }

  if (mode === 'stg') {
    return {
      includeDemoUser: false,
      includeBootstrapArticles: true,
      includeProducts: true,
      includeTopicQueue: true,
      requireOpenRouterToken: true,
      defaultEnableWorkflows: true,
    };
  }

  return {
    includeDemoUser: false,
    includeBootstrapArticles: true,
    includeProducts: true,
    includeTopicQueue: true,
    requireOpenRouterToken: true,
    defaultEnableWorkflows: true,
  };
};

const getAppDir = () => APP_DIR;

const resolveOpenRouterToken = (mode) => {
  const upper = mode.toUpperCase();

  const candidates = [
    process.env[`AICO_OPENROUTER_TOKEN_${upper}`],
    process.env[`OPENROUTER_API_KEY_${upper}`],
    process.env.AICO_OPENROUTER_TOKEN,
    process.env.OPENROUTER_API_KEY,
  ];

  return (
    candidates
      .find((value) => typeof value === 'string' && value.trim().length > 0)
      ?.trim() || ''
  );
};

const resolveOpenRouterModel = (mode) => {
  const upper = mode.toUpperCase();
  return (
    process.env[`AICO_OPENROUTER_MODEL_${upper}`] ||
    process.env.AICO_OPENROUTER_MODEL ||
    process.env.OPENROUTER_MODEL ||
    'openai/gpt-4.1-mini'
  );
};

const resolveImageGenToken = (mode) => {
  const upper = mode.toUpperCase();

  return firstNonEmpty([
    process.env[`AICO_IMAGE_GEN_TOKEN_${upper}`],
    process.env[`REPLICATE_API_TOKEN_${upper}`],
    process.env.AICO_IMAGE_GEN_TOKEN,
    process.env.REPLICATE_API_TOKEN,
  ]);
};

const resolveConfiguredImageGenModel = (mode) => {
  const upper = mode.toUpperCase();

  return firstNonEmpty([
    process.env[`AICO_IMAGE_GEN_MODEL_${upper}`],
    process.env.AICO_IMAGE_GEN_MODEL,
  ]);
};

const resolveImageGenModel = (mode) =>
  resolveConfiguredImageGenModel(mode) || 'openai/gpt-image-2';

const encryptSeedSecret = (strapi, value) => {
  if (!value) {
    return null;
  }

  return strapi.service('admin::encryption').encrypt(value);
};

const resolveModeEnv = (mode, names) => {
  const upper = mode.toUpperCase();
  const candidates = names.flatMap((name) => [
    process.env[`${name}_${upper}`],
    process.env[name],
  ]);

  return firstNonEmpty(candidates);
};

const parseSocialChannels = (value) => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return null;
  }

  const allowed = new Set(['facebook', 'instagram', 'twitter', 'tiktok']);
  const channels = value
    .split(',')
    .map((channel) => channel.trim().toLowerCase())
    .filter((channel) => allowed.has(channel));

  return channels.length > 0 ? Array.from(new Set(channels)) : null;
};

const buildAicoSettingsValue = (strapi, mode, currentSettings = {}) => {
  const current = isRecord(currentSettings) ? currentSettings : {};
  const imageGenToken = resolveImageGenToken(mode);
  const imageGenModel =
    resolveConfiguredImageGenModel(mode) ||
    current.image_gen_model ||
    resolveImageGenModel(mode);
  const autoPublishEnabled = toOptionalBoolean(process.env.AICO_AUTO_PUBLISH_ENABLED);
  const strategyAutopilotEnabled = toOptionalBoolean(
    process.env.AICO_STRATEGY_AUTOPILOT_ENABLED,
  );

  const value = {
    ...current,
    timezone: WARSAW_TIMEZONE,
    locale: 'pl',
    image_gen_model: imageGenModel,
  };

  if (imageGenToken) {
    value.image_gen_api_token_encrypted = encryptSeedSecret(strapi, imageGenToken);
  }

  if (autoPublishEnabled !== null) {
    value.aico_auto_publish_enabled = autoPublishEnabled;
  }

  if (strategyAutopilotEnabled !== null) {
    value.aico_strategy_autopilot_enabled = strategyAutopilotEnabled;
  }

  return {
    value,
    summary: {
      imageGenModel,
      imageGenTokenPresent: Boolean(imageGenToken || current.image_gen_api_token_encrypted),
      autoPublishEnabled:
        value.aico_auto_publish_enabled === undefined
          ? true
          : value.aico_auto_publish_enabled !== false,
      strategyAutopilotEnabled: value.aico_strategy_autopilot_enabled === true,
    },
  };
};

const buildSocialCredentialSeedFields = (strapi, mode, existing = {}) => {
  const current = isRecord(existing) ? existing : {};
  const fbPageId = resolveModeEnv(mode, ['AICO_FACEBOOK_PAGE_ID', 'AICO_FB_PAGE_ID']);
  const fbAccessToken = resolveModeEnv(mode, [
    'AICO_FACEBOOK_ACCESS_TOKEN',
    'AICO_FB_ACCESS_TOKEN',
  ]);
  const igUserId = resolveModeEnv(mode, ['AICO_INSTAGRAM_USER_ID', 'AICO_IG_USER_ID']);
  const igAccessToken = resolveModeEnv(mode, [
    'AICO_INSTAGRAM_ACCESS_TOKEN',
    'AICO_IG_ACCESS_TOKEN',
  ]);
  const xApiKey = resolveModeEnv(mode, ['AICO_X_API_KEY', 'AICO_TWITTER_API_KEY']);
  const xApiSecret = resolveModeEnv(mode, ['AICO_X_API_SECRET', 'AICO_TWITTER_API_SECRET']);
  const xAccessToken = resolveModeEnv(mode, [
    'AICO_X_ACCESS_TOKEN',
    'AICO_TWITTER_ACCESS_TOKEN',
  ]);
  const xAccessTokenSecret = resolveModeEnv(mode, [
    'AICO_X_ACCESS_TOKEN_SECRET',
    'AICO_TWITTER_ACCESS_TOKEN_SECRET',
  ]);
  const enabledChannels = parseSocialChannels(process.env.AICO_SOCIAL_CHANNELS);

  return {
    ...(enabledChannels ? { enabled_channels: enabledChannels } : {}),
    fb_page_id: fbPageId || current.fb_page_id || null,
    fb_access_token_encrypted: fbAccessToken
      ? encryptSeedSecret(strapi, fbAccessToken)
      : current.fb_access_token_encrypted || null,
    ig_user_id: igUserId || current.ig_user_id || null,
    ig_access_token_encrypted: igAccessToken
      ? encryptSeedSecret(strapi, igAccessToken)
      : current.ig_access_token_encrypted || null,
    x_api_key: xApiKey || current.x_api_key || null,
    x_api_secret_encrypted: xApiSecret
      ? encryptSeedSecret(strapi, xApiSecret)
      : current.x_api_secret_encrypted || null,
    x_access_token_encrypted: xAccessToken
      ? encryptSeedSecret(strapi, xAccessToken)
      : current.x_access_token_encrypted || null,
    x_access_token_secret_encrypted: xAccessTokenSecret
      ? encryptSeedSecret(strapi, xAccessTokenSecret)
      : current.x_access_token_secret_encrypted || null,
  };
};

const buildWorkflowAutomationSeedFields = (definition, existing = {}) => {
  const current = isRecord(existing) ? existing : {};
  const isArticleWorkflow = definition.workflow_type === 'article';
  const strategyAutopilotEnabled = toOptionalBoolean(
    process.env.AICO_STRATEGY_AUTOPILOT_ENABLED,
  );
  const strategyAutoApprove = toOptionalBoolean(process.env.AICO_STRATEGY_AUTO_APPROVE_PLAN);
  const minTopicBacklog = toOptionalInteger(process.env.AICO_STRATEGY_MIN_TOPIC_BACKLOG);
  const maxPlanItemsPerTick = toOptionalInteger(
    process.env.AICO_STRATEGY_MAX_PLAN_ITEMS_PER_TICK,
  );

  if (!isArticleWorkflow) {
    return {
      strategy_enabled:
        typeof current.strategy_enabled === 'boolean' ? current.strategy_enabled : false,
      auto_publish_guardrails: isRecord(current.auto_publish_guardrails)
        ? current.auto_publish_guardrails
        : null,
    };
  }

  const strategyEnabled =
    strategyAutopilotEnabled !== null
      ? strategyAutopilotEnabled
      : current.strategy_enabled === true;
  const currentGuardrails = isRecord(current.auto_publish_guardrails)
    ? current.auto_publish_guardrails
    : {};
  const currentStrategy = isRecord(currentGuardrails.strategy)
    ? currentGuardrails.strategy
    : {};
  const strategy = {
    ...currentStrategy,
    enabled: strategyEnabled,
  };

  if (strategyAutopilotEnabled !== null) {
    strategy.autopilot_enabled = strategyAutopilotEnabled;
  }
  if (strategyAutoApprove !== null) {
    strategy.auto_approve_plan = strategyAutoApprove;
  }
  if (minTopicBacklog !== null) {
    strategy.min_topic_backlog = minTopicBacklog;
  }
  if (maxPlanItemsPerTick !== null) {
    strategy.max_plan_items_per_tick = maxPlanItemsPerTick;
  }

  return {
    strategy_enabled: strategyEnabled,
    auto_publish_guardrails: {
      ...currentGuardrails,
      strategy,
    },
  };
};

const buildWorkflowDefinitions = ({
  model,
  encryptedToken,
  enableWorkflows,
  categoryId,
}) => {
  const defaults = aicoContract.workflowDefaults;

  return aicoContract.workflows.map((workflow) => ({
    name: workflow.name,
    enabled: enableWorkflows,
    status: 'idle',
    workflow_type: workflow.workflowType,
    generate_cron: workflow.generateCron,
    publish_cron: workflow.publishCron,
    topic_mode: workflow.topicMode,
    timezone: aicoContract.timezone,
    locale: aicoContract.locale,
    llm_model: model,
    llm_api_token_encrypted: encryptedToken,
    temperature: workflow.temperature,
    max_completion_tokens: workflow.maxCompletionTokens,
    retry_max: defaults.retryMax,
    retry_backoff_seconds: defaults.retryBackoffSeconds,
    daily_request_limit: defaults.dailyRequestLimit,
    daily_token_limit: defaults.dailyTokenLimit,
    allow_manual_edit: defaults.allowManualEdit,
    auto_publish: defaults.autoPublish,
    force_regenerate: defaults.forceRegenerate,
    horoscope_period: workflow.horoscopePeriod,
    horoscope_type_values: workflow.horoscopeTypeValues,
    all_signs: workflow.allSigns,
    article_category:
      workflow.workflowType === 'article' ||
      workflow.workflowType === 'daily_card'
        ? categoryId
        : null,
    prompt_template: aicoContract.prompts[workflow.promptKey],
  }));
};

const seedAicoSettings = async (strapi, mode) => {
  const store = strapi.store({
    type: 'plugin',
    name: 'ai-content-orchestrator',
    key: 'settings',
  });
  const current = await store.get();
  const settings = buildAicoSettingsValue(strapi, mode, current);

  await store.set({
    value: settings.value,
  });

  return settings.summary;
};

const seedAicoWorkflows = async (strapi, mode, categoriesByName) => {
  const defaults = getModeDefaults(mode);
  const enableByDefault = toBoolean(
    process.env.AICO_ENABLE_WORKFLOWS,
    defaults.defaultEnableWorkflows,
  );
  const requireToken =
    enableByDefault &&
    defaults.requireOpenRouterToken &&
    process.env.AICO_ALLOW_MISSING_TOKEN !== 'true';

  const token = resolveOpenRouterToken(mode);

  if (!token && requireToken) {
    throw new Error(
      `[seed:${mode}] Brak tokena OpenRouter. Ustaw AICO_OPENROUTER_TOKEN_${mode.toUpperCase()} albo AICO_OPENROUTER_TOKEN.`,
    );
  }

  const model = resolveOpenRouterModel(mode);

  let encryptedToken = null;
  if (token) {
    encryptedToken = strapi.service('admin::encryption').encrypt(token);
  }

  const enableWorkflows = Boolean(token) && enableByDefault;

  const category =
    categoriesByName.get('Astrologia') ||
    [...categoriesByName.values()][0] ||
    null;
  const categoryId = category?.id || null;

  const definitions = buildWorkflowDefinitions({
    model,
    encryptedToken,
    enableWorkflows,
    categoryId,
    mode,
  });

  const query = strapi.db.query('plugin::ai-content-orchestrator.workflow');
  const byName = new Map();

  for (const definition of definitions) {
    const existing = await query.findOne({ where: { name: definition.name } });

    const tokenToPersist =
      definition.llm_api_token_encrypted ||
      existing?.llm_api_token_encrypted ||
      null;

    const saved = await upsertOne(
      strapi,
      'plugin::ai-content-orchestrator.workflow',
      { name: definition.name },
      {
        ...definition,
        ...buildWorkflowAutomationSeedFields(definition, existing),
        ...buildSocialCredentialSeedFields(strapi, mode, existing),
        llm_api_token_encrypted: tokenToPersist,
        enabled: tokenToPersist ? definition.enabled : false,
      },
    );

    byName.set(saved.name, saved);
  }

  const canonicalWorkflowNames = new Set(
    aicoContract.workflows.map((workflow) => workflow.name),
  );
  for (const legacyName of aicoContract.legacyWorkflowNames.filter(
    (name) => !canonicalWorkflowNames.has(name),
  )) {
    const legacyWorkflow = await query.findOne({
      where: { name: legacyName },
    });

    if (legacyWorkflow?.id) {
      await query.update({
        where: { id: legacyWorkflow.id },
        data: {
          enabled: false,
          status: 'idle',
        },
      });
    }
  }

  const enabledCount = [...byName.values()].filter(
    (workflow) => workflow.enabled,
  ).length;

  return {
    workflowsByName: byName,
    enabledCount,
    tokenPresent: Boolean(token),
    model,
  };
};

const seedAicoMediaAssets = async (strapi) => {
  const query = strapi.db.query('plugin::ai-content-orchestrator.media-asset');
  let seeded = 0;

  for (const definition of MEDIA_ASSET_PLACEHOLDERS) {
    const existing = await query.findOne({
      where: { asset_key: definition.asset_key },
    });

    await upsertOne(
      strapi,
      'plugin::ai-content-orchestrator.media-asset',
      { asset_key: definition.asset_key },
      {
        ...definition,
        asset: resolveRelationId(existing?.asset),
        use_count:
          typeof existing?.use_count === 'number' ? existing.use_count : 0,
        last_used_at: existing?.last_used_at || null,
      },
    );

    seeded += 1;
  }

  return seeded;
};

const seedAicoTopicQueue = async (
  strapi,
  mode,
  workflowsByName,
  categoriesByName,
) => {
  const defaults = getModeDefaults(mode);

  if (!defaults.includeTopicQueue) {
    return 0;
  }

  const topicItems = mode === 'dev' ? DEV_TOPIC_QUEUE : STG_PROD_TOPIC_QUEUE;
  const workflow =
    workflowsByName.get('AICO Blog - Magia i Astrologia') || null;
  const category =
    categoriesByName.get('Astrologia') ||
    [...categoriesByName.values()][0] ||
    null;
  const forceTopicQueue = toBoolean(
    process.env.AICO_SEED_TOPIC_QUEUE_ENABLED,
    false,
  );

  if (!workflow || !category || (!workflow.enabled && !forceTopicQueue)) {
    return 0;
  }

  let seeded = 0;

  for (const [index, item] of topicItems.entries()) {
    const imageAssetKey =
      BLOG_IMAGE_ASSET_KEYS[index % BLOG_IMAGE_ASSET_KEYS.length];

    await upsertOne(
      strapi,
      'plugin::ai-content-orchestrator.topic-queue-item',
      { title: item.title },
      {
        title: item.title,
        brief: item.brief,
        image_asset_key: imageAssetKey,
        status: 'pending',
        scheduled_for: plusDaysAtTimeIso(item.daysOffset, 5, 30),
        processed_at: null,
        error_message: null,
        metadata: {
          seed_mode: mode,
          seed_key: item.seedKey,
          image_asset_key: imageAssetKey,
        },
        workflow: workflow.id,
        article_category: category.id,
      },
    );

    seeded += 1;
  }

  return seeded;
};

const seedWithMode = async (mode) => {
  if (!SUPPORTED_MODES.includes(mode)) {
    throw new Error(
      `Nieobsługiwany seed mode: ${mode}. Użyj jednego z: ${SUPPORTED_MODES.join(', ')}`,
    );
  }

  if (mode === 'prod' && process.env.ALLOW_PRODUCTION_SEED !== 'true') {
    throw new Error(
      'Seed prod jest zablokowany. Ustaw ALLOW_PRODUCTION_SEED=true, jeśli to zamierzone.',
    );
  }

  const defaults = getModeDefaults(mode);

  const appContext = await compileStrapi({ appDir: getAppDir() });
  const app = await createStrapi(appContext).load();

  try {
    const signs = await seedZodiacSigns(app);
    const categories = await seedCategories(app);

    if (defaults.includeBootstrapArticles) {
      await seedArticles(app, categories);
    }

    if (defaults.includeProducts) {
      await seedProducts(app);
    }

    const cards = await seedTarotCards(app);
    await seedDailyTarotDraw(app, cards);
    await seedNumerology(app);
    await seedHoroscopes(app, signs);

    if (defaults.includeDemoUser) {
      await ensureDemoUser(app, signs);
      await ensurePremiumUser(app, signs);
    }

    await ensureReadPermissions(app);
    const settingsSeed = await seedAicoSettings(app, mode);

    const workflowSeed = await seedAicoWorkflows(app, mode, categories);
    const mediaAssetsSeeded = await seedAicoMediaAssets(app);
    const topicsSeeded = await seedAicoTopicQueue(
      app,
      mode,
      workflowSeed.workflowsByName,
      categories,
    );
    const coverage = await app
      .plugin('ai-content-orchestrator')
      .service('media-assets')
      .validateCoverage({ applyWorkflowDisabling: true });

    console.log(`✅ Seed ${mode} zakończony powodzeniem.`);
    console.log(`🔧 AICO model: ${workflowSeed.model}`);
    console.log(
      `🔐 AICO token ustawiony: ${workflowSeed.tokenPresent ? 'tak' : 'nie'}`,
    );
    console.log(`🎨 AICO Media Gen model: ${settingsSeed.imageGenModel}`);
    console.log(
      `🎨 AICO Media Gen token ustawiony: ${settingsSeed.imageGenTokenPresent ? 'tak' : 'nie'}`,
    );
    console.log(
      `🚦 AICO auto-publish globalnie: ${settingsSeed.autoPublishEnabled ? 'tak' : 'nie'}`,
    );
    console.log(
      `🧭 AICO strategy autopilot: ${settingsSeed.strategyAutopilotEnabled ? 'tak' : 'nie'}`,
    );
    console.log(`⚙️ AICO workflow enabled: ${workflowSeed.enabledCount}`);
    console.log(`🖼️ AICO media assets (placeholders): ${mediaAssetsSeeded}`);
    console.log(`🗂️ AICO topic queue items: ${topicsSeeded}`);
    console.log(
      `🧪 AICO media coverage ok: ${coverage.ok ? 'tak' : 'nie'} (missing workflows: ${
        Array.isArray(coverage.missingWorkflows)
          ? coverage.missingWorkflows.length
          : 0
      })`,
    );

    if (defaults.includeDemoUser) {
      console.log('📧 Konto demo: demo@starsign.local');
      console.log('🔑 Hasło demo: Test1234!');
      console.log('📧 Konto premium: premium@starsign.local');
      console.log('🔑 Hasło premium: Test1234!');
    }
  } finally {
    await app.destroy();
  }
};

module.exports = {
  buildAicoSettingsValue,
  buildSocialCredentialSeedFields,
  buildWorkflowAutomationSeedFields,
  getAppDir,
  resolveImageGenModel,
  resolveImageGenToken,
  seedWithMode,
};
