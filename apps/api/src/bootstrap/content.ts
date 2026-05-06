import type { Core } from '@strapi/strapi';
import {
  AICO_LEGACY_WORKFLOW_NAMES,
  buildAicoWorkflowDefinitions,
} from './aico-contract';
import { ensureSeedMedia } from './seed-media';
import { toBoolean } from '../utils/features';
import { evaluatePremiumContentQuality } from '../utils/premium-quality';

const WARSAW_TIMEZONE = 'Europe/Warsaw';

type SeedRecord = Record<string, unknown>;

type SeededEntity = {
  id: number;
  name?: string;
  slug?: string;
};

const SIGNS = [
  {
    name: 'Baran',
    slug: 'baran',
    date_range: '21.03 - 19.04',
    element: 'Ogień',
    planet: 'Mars',
    description: 'Dynamiczny znak ognia, który działa odważnie i szybko.',
  },
  {
    name: 'Byk',
    slug: 'byk',
    date_range: '20.04 - 20.05',
    element: 'Ziemia',
    planet: 'Wenus',
    description: 'Stabilny znak ziemi, ceniący bezpieczeństwo i komfort.',
  },
  {
    name: 'Bliźnięta',
    slug: 'bliznieta',
    date_range: '21.05 - 20.06',
    element: 'Powietrze',
    planet: 'Merkury',
    description: 'Komunikatywny znak powietrza o bystrym i ciekawym umyśle.',
  },
  {
    name: 'Rak',
    slug: 'rak',
    date_range: '21.06 - 22.07',
    element: 'Woda',
    planet: 'Księżyc',
    description: 'Wrażliwy znak wody, związany z emocjami i domem.',
  },
  {
    name: 'Lew',
    slug: 'lew',
    date_range: '23.07 - 22.08',
    element: 'Ogień',
    planet: 'Słońce',
    description: 'Charyzmatyczny znak ognia, który lubi tworzyć i inspirować.',
  },
  {
    name: 'Panna',
    slug: 'panna',
    date_range: '23.08 - 22.09',
    element: 'Ziemia',
    planet: 'Merkury',
    description: 'Analityczny znak ziemi, ceniący porządek i praktyczność.',
  },
  {
    name: 'Waga',
    slug: 'waga',
    date_range: '23.09 - 22.10',
    element: 'Powietrze',
    planet: 'Wenus',
    description:
      'Harmonijny znak powietrza, nastawiony na relacje i równowagę.',
  },
  {
    name: 'Skorpion',
    slug: 'skorpion',
    date_range: '23.10 - 21.11',
    element: 'Woda',
    planet: 'Pluton',
    description: 'Intensywny znak wody, kojarzony z transformacją i intuicją.',
  },
  {
    name: 'Strzelec',
    slug: 'strzelec',
    date_range: '22.11 - 21.12',
    element: 'Ogień',
    planet: 'Jowisz',
    description: 'Otwarty znak ognia, dążący do rozwoju i przygody.',
  },
  {
    name: 'Koziorożec',
    slug: 'koziorozec',
    date_range: '22.12 - 19.01',
    element: 'Ziemia',
    planet: 'Saturn',
    description: 'Ambitny znak ziemi, konsekwentnie realizujący cele.',
  },
  {
    name: 'Wodnik',
    slug: 'wodnik',
    date_range: '20.01 - 18.02',
    element: 'Powietrze',
    planet: 'Uran',
    description: 'Niezależny znak powietrza, myślący przyszłościowo.',
  },
  {
    name: 'Ryby',
    slug: 'ryby',
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

const PREMIUM_ARTICLE_SLUGS = new Set([
  'jak-czytac-sygnaly-dnia-wedlug-znaku',
  'karta-dnia-jak-prowadzic-archiwum-odczytow',
  'dlaczego-premium-dziala-z-profilem-urodzeniowym',
  'tygodniowy-przeglad-energii',
]);

const buildArticlePremiumContent = (title: string): string =>
  `Pełna interpretacja Premium do artykułu "${title}".

Relacje: potraktuj temat artykułu jak lustro dla jednej konkretnej relacji. Zapisz, w której rozmowie najczęściej uciekasz w domysły, a potem nazwij fakt, potrzebę i granicę. Premium nie prosi o dramatyczny gest, tylko o spokojną obecność: jedno zdanie wypowiedziane prosto, bez tłumaczenia się i bez nacisku na natychmiastową odpowiedź. Jeśli czujesz napięcie, wróć do pytania, czy chcesz dziś budować bliskość, czy tylko wygrać spór. Dodaj też mały test rzeczywistości: sprawdź, czy Twoja interpretacja zachowania drugiej osoby wynika z faktów, czy z wcześniejszego lęku. To odróżnia intuicję od automatycznej obrony.

Praca: wybierz jeden obszar działania, w którym temat artykułu może stać się praktycznym ruchem. Nie planuj całego miesiąca naraz. Wybierz zadanie, które ma widoczny koniec, określ minimalny dobry rezultat i dopisz, co zrobisz, jeśli energia spadnie. To rozszerzenie Premium ma prowadzić do konkretu: jednego maila, jednej decyzji, jednej rozmowy albo jednego zamkniętego etapu, który porządkuje dalszą drogę. Jeśli temat dotyka ambicji, nazwij również koszt: czas, koncentrację albo emocjonalne napięcie. Dzięki temu wybierasz świadomie, zamiast tylko reagować na presję wyniku.

Energia dnia: obserwuj, czy Twoje ciało przyspiesza, gdy pojawia się temat kontroli, oceny albo oczekiwań. Jeżeli tak, zwolnij rytm o pół kroku: wypij wodę, rozluźnij szczękę, przenieś uwagę na stopy. Energia dnia sprzyja temu, co jest proste i powtarzalne. Najmocniejszy efekt przyniesie nie wielka deklaracja, ale konsekwentne wracanie do jednego spokojnego wyboru. W drugiej części dnia sprawdź, czy nie oddajesz swojej uwagi drobnym rozproszeniom. Jedno świadome "nie teraz" może dziś ochronić więcej energii niż dodatkowa godzina wysiłku.

Rytuał: przygotuj kartkę i zapisz trzy zdania. Pierwsze: co dziś widzę wyraźniej. Drugie: czego nie chcę już wzmacniać swoim lękiem. Trzecie: jaki gest pokaże mi, że jestem po swojej stronie. Po zapisaniu połóż dłoń na sercu albo na brzuchu i przez dziewięć oddechów powtarzaj w myślach krótką intencję. Na koniec zrób jedną rzecz w przestrzeni: uporządkuj biurko, przewietrz pokój albo odłóż telefon. Jeżeli możesz, wróć do tej kartki wieczorem i dopisz jedno zdanie o tym, co faktycznie zadziałało. Premium ma budować pamięć własnych wzorców, nie tylko chwilową inspirację.

Pytanie refleksyjne: gdyby moja decyzja miała wynikać z zaufania do siebie, a nie z potrzeby udowodnienia czegoś innym, co zrobiłabym dzisiaj inaczej? Jaką jedną decyzję mogę odłożyć, dopóki nie wrócę do spokojniejszego oddechu i pełniejszego obrazu sytuacji?`;

const TAROT_CARDS = [
  {
    name: 'Głupiec',
    arcana: 'Wielkie Arkana · 0',
    slug: 'glupiec',
    symbol: 'GLUPIEC',
    meaning_upright: 'Nowy początek, spontaniczność i zaufanie do procesu.',
    meaning_reversed:
      'Nieprzemyślane ryzyko, chaos i lekceważenie konsekwencji.',
    description: 'Karta otwarcia nowego etapu i odwagi do pierwszego kroku.',
  },
  {
    name: 'Mag',
    arcana: 'Wielkie Arkana · I',
    slug: 'mag',
    symbol: 'MAG',
    meaning_upright: 'Sprawczość, koncentracja i manifestacja celu.',
    meaning_reversed:
      'Rozproszenie, manipulacja albo niewykorzystany potencjał.',
    description: 'Masz zasoby, aby przejść od zamiaru do działania.',
  },
  {
    name: 'Kapłanka',
    arcana: 'Wielkie Arkana · II',
    slug: 'kaplanka',
    symbol: 'KAPLANKA',
    meaning_upright: 'Intuicja, cisza i głębszy wgląd.',
    meaning_reversed:
      'Zagłuszona intuicja, sekrety albo brak kontaktu ze sobą.',
    description: 'Warto słuchać subtelnych sygnałów i nie działać impulsywnie.',
  },
  {
    name: 'Cesarzowa',
    arcana: 'Wielkie Arkana · III',
    slug: 'cesarzowa',
    symbol: 'CESARZOWA',
    meaning_upright: 'Tworzenie, obfitość i troska o rozwój.',
    meaning_reversed:
      'Zastój, nadopiekuńczość albo zaniedbanie własnych potrzeb.',
    description: 'To dobry moment na pielęgnowanie projektów i relacji.',
  },
  {
    name: 'Cesarz',
    arcana: 'Wielkie Arkana · IV',
    slug: 'cesarz',
    symbol: 'CESARZ',
    meaning_upright: 'Struktura, odpowiedzialność i spokojne przywództwo.',
    meaning_reversed: 'Kontrola, sztywność albo brak stabilnych granic.',
    description: 'Karta zachęca do planu, porządku i konsekwencji.',
  },
  {
    name: 'Kapłan',
    arcana: 'Wielkie Arkana · V',
    slug: 'kaplan',
    symbol: 'KAPLAN',
    meaning_upright: 'Nauka, tradycja, mentorstwo i wartości.',
    meaning_reversed:
      'Dogmatyzm, presja otoczenia albo potrzeba własnej drogi.',
    description:
      'Szukaj sprawdzonej wiedzy, ale filtruj ją przez własne wartości.',
  },
  {
    name: 'Kochankowie',
    arcana: 'Wielkie Arkana · VI',
    slug: 'kochankowie',
    symbol: 'KOCHANKOWIE',
    meaning_upright: 'Wybór zgodny z wartościami i sercem.',
    meaning_reversed: 'Rozdarcie, niejasność intencji albo decyzja pod presją.',
    description: 'Decyzje relacyjne i życiowe wymagają spójności z sobą.',
  },
  {
    name: 'Rydwan',
    arcana: 'Wielkie Arkana · VII',
    slug: 'rydwan',
    symbol: 'RYDWAN',
    meaning_upright: 'Determinacja, ruch i zwycięstwo dzięki dyscyplinie.',
    meaning_reversed: 'Brak kierunku, pośpiech albo walka z samym sobą.',
    description: 'Ustal kierunek i prowadź energię zamiast ją rozpraszać.',
  },
  {
    name: 'Sprawiedliwość',
    arcana: 'Wielkie Arkana · VIII',
    slug: 'sprawiedliwosc',
    symbol: 'SPRAWIEDLIWOSC',
    meaning_upright: 'Uczciwość, równowaga i konsekwencje decyzji.',
    meaning_reversed: 'Unikanie odpowiedzialności albo brak przejrzystości.',
    description: 'Karta przypomina, że jasność faktów przynosi spokój.',
  },
  {
    name: 'Pustelnik',
    arcana: 'Wielkie Arkana · IX',
    slug: 'pustelnik',
    symbol: 'PUSTELNIK',
    meaning_upright: 'Wgląd, samotna refleksja i mądrość doświadczenia.',
    meaning_reversed: 'Izolacja, zwlekanie albo zamknięcie na wsparcie.',
    description: 'Zatrzymaj się, aby zobaczyć, czego naprawdę potrzebujesz.',
  },
  {
    name: 'Koło Fortuny',
    arcana: 'Wielkie Arkana · X',
    slug: 'kolo-fortuny',
    symbol: 'KOLO_FORTUNY',
    meaning_upright: 'Zmiana cyklu, szansa i zwrot sytuacji.',
    meaning_reversed: 'Opór wobec zmiany albo powtarzanie starego schematu.',
    description: 'Nie wszystko kontrolujesz, ale możesz mądrze odpowiedzieć.',
  },
  {
    name: 'Moc',
    arcana: 'Wielkie Arkana · XI',
    slug: 'moc',
    symbol: 'MOC',
    meaning_upright: 'Odwaga, łagodność i panowanie nad impulsem.',
    meaning_reversed: 'Wątpliwość, napięcie albo próba forsowania sytuacji.',
    description: 'Największa siła działa spokojnie, bez potrzeby udowadniania.',
  },
  {
    name: 'Wisielec',
    arcana: 'Wielkie Arkana · XII',
    slug: 'wisielec',
    symbol: 'WISIELEC',
    meaning_upright: 'Nowa perspektywa, pauza i świadome odpuszczenie.',
    meaning_reversed:
      'Tkwienie w zawieszeniu albo opór przed zmianą spojrzenia.',
    description: 'Zmiana kąta patrzenia może odblokować dalszy ruch.',
  },
  {
    name: 'Śmierć',
    arcana: 'Wielkie Arkana · XIII',
    slug: 'smierc',
    symbol: 'SMIERC',
    meaning_upright: 'Transformacja, koniec etapu i miejsce na nowe.',
    meaning_reversed: 'Lęk przed końcem, przywiązanie do przeszłości.',
    description: 'Karta mówi o przemianie, nie o dosłownej zapowiedzi straty.',
  },
  {
    name: 'Umiarkowanie',
    arcana: 'Wielkie Arkana · XIV',
    slug: 'umiarkowanie',
    symbol: 'UMIARKOWANIE',
    meaning_upright: 'Harmonia, cierpliwość i łączenie przeciwieństw.',
    meaning_reversed:
      'Przesada, brak rytmu albo trudność w znalezieniu środka.',
    description: 'Najlepszy efekt przyjdzie przez wyważenie, nie skrajności.',
  },
  {
    name: 'Diabeł',
    arcana: 'Wielkie Arkana · XV',
    slug: 'diabel',
    symbol: 'DIABEL',
    meaning_upright: 'Przywiązania, pokusy i świadomość ograniczeń.',
    meaning_reversed:
      'Uwalnianie się, przełamanie schematu albo odzyskanie wpływu.',
    description: 'Zobacz, co odbiera Ci wolność wyboru.',
  },
  {
    name: 'Wieża',
    arcana: 'Wielkie Arkana · XVI',
    slug: 'wieza',
    symbol: 'WIEZA',
    meaning_upright: 'Nagłe ujawnienie prawdy i rozpad nietrwałej struktury.',
    meaning_reversed:
      'Odkładany przełom albo próba ratowania tego, co nie działa.',
    description: 'To moment szczerości, który może oczyścić sytuację.',
  },
  {
    name: 'Gwiazda',
    arcana: 'Wielkie Arkana · XVII',
    slug: 'gwiazda',
    symbol: 'GWIAZDA',
    meaning_upright: 'Nadzieja, regeneracja i powrót zaufania.',
    meaning_reversed:
      'Zwątpienie, zmęczenie albo trudność w przyjęciu wsparcia.',
    description: 'Daj sobie czas na odbudowę i łagodny kierunek.',
  },
  {
    name: 'Księżyc',
    arcana: 'Wielkie Arkana · XVIII',
    slug: 'ksiezyc',
    symbol: 'KSIEZYC',
    meaning_upright: 'Podświadomość, sny i niejasność wymagająca intuicji.',
    meaning_reversed: 'Rozjaśnienie lęku, wyjście z iluzji albo ukryta prawda.',
    description:
      'Nie wszystko jest jeszcze widoczne, więc sprawdzaj fakty spokojnie.',
  },
  {
    name: 'Słońce',
    arcana: 'Wielkie Arkana · XIX',
    slug: 'slonce',
    symbol: 'SLONCE',
    meaning_upright: 'Radość, klarowność i życiowa energia.',
    meaning_reversed:
      'Przygaszona pewność siebie albo opóźnione poczucie lekkości.',
    description: 'Karta wnosi prostotę, ciepło i widoczny postęp.',
  },
  {
    name: 'Sąd Ostateczny',
    arcana: 'Wielkie Arkana · XX',
    slug: 'sad-ostateczny',
    symbol: 'SAD_OSTATECZNY',
    meaning_upright: 'Przebudzenie, decyzja i zamknięcie starego rozdziału.',
    meaning_reversed: 'Unikanie wezwania, samokrytyka albo lęk przed oceną.',
    description: 'Czas usłyszeć, do czego dojrzewałaś lub dojrzewałeś.',
  },
  {
    name: 'Świat',
    arcana: 'Wielkie Arkana · XXI',
    slug: 'swiat',
    symbol: 'SWIAT',
    meaning_upright: 'Spełnienie, integracja i domknięcie cyklu.',
    meaning_reversed:
      'Niedokończenie, brak ostatniego kroku albo rozproszenie.',
    description: 'Zbierasz efekty procesu i możesz przejść dalej pełniej.',
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

const getWarsawDate = (date = new Date()): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: WARSAW_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);

const upsertOne = async (
  strapi: Core.Strapi,
  uid: string,
  where: SeedRecord,
  data: SeedRecord,
): Promise<SeededEntity> => {
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

const resolveOpenRouterToken = (): string => {
  const env = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
  const candidates = [
    process.env[`AICO_OPENROUTER_TOKEN_${env}`],
    process.env[`OPENROUTER_API_KEY_${env}`],
    process.env.AICO_OPENROUTER_TOKEN,
    process.env.OPENROUTER_API_KEY,
  ];

  return (
    candidates
      .find((value) => typeof value === 'string' && value.trim().length > 0)
      ?.trim() || ''
  );
};

const resolveOpenRouterModel = (): string =>
  process.env.AICO_OPENROUTER_MODEL ||
  process.env.OPENROUTER_MODEL ||
  'openai/gpt-4.1-mini';

const resolveImageGenToken = (): string => {
  const env = process.env.NODE_ENV === 'production' ? 'PROD' : 'DEV';
  const candidates = [
    process.env[`AICO_IMAGE_GEN_TOKEN_${env}`],
    process.env[`REPLICATE_API_TOKEN_${env}`],
    process.env.AICO_IMAGE_GEN_TOKEN,
    process.env.REPLICATE_API_TOKEN,
    process.env.OPENAI_API_KEY,
  ];

  return (
    candidates
      .find((value) => typeof value === 'string' && value.trim().length > 0)
      ?.trim() || ''
  );
};

const resolveImageGenModel = (): string =>
  process.env.AICO_IMAGE_GEN_MODEL || 'openai/gpt-image-2';

const encryptToken = (strapi: Core.Strapi, token: string): string | null => {
  if (!token) {
    return null;
  }

  return strapi.service('admin::encryption').encrypt(token);
};

const seedZodiacSigns = async (
  strapi: Core.Strapi,
): Promise<Map<string, SeededEntity>> => {
  const byName = new Map<string, SeededEntity>();

  for (const sign of SIGNS) {
    const seeded = await upsertOne(
      strapi,
      'api::zodiac-sign.zodiac-sign',
      { name: sign.name },
      sign,
    );
    if (seeded.name) {
      byName.set(seeded.name, seeded);
    }
  }

  return byName;
};

const seedCategories = async (
  strapi: Core.Strapi,
): Promise<Map<string, SeededEntity>> => {
  const byName = new Map<string, SeededEntity>();

  for (const category of CATEGORIES) {
    const seeded = await upsertOne(
      strapi,
      'api::category.category',
      { name: category.name },
      category,
    );
    if (seeded.name) {
      byName.set(seeded.name, seeded);
    }
  }

  return byName;
};

const seedArticles = async (
  strapi: Core.Strapi,
  categoriesByName: Map<string, SeededEntity>,
): Promise<void> => {
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
        premiumContent: PREMIUM_ARTICLE_SLUGS.has(article.slug)
          ? buildArticlePremiumContent(article.title)
          : null,
        isPremium: PREMIUM_ARTICLE_SLUGS.has(article.slug),
        excerpt: article.excerpt,
        read_time_minutes: article.read_time_minutes,
        author: article.author,
        category: category?.id || null,
        publishedAt,
      },
    );
  }
};

const seedTarotCards = async (
  strapi: Core.Strapi,
): Promise<Map<string, SeededEntity>> => {
  const bySlug = new Map<string, SeededEntity>();
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
    if (seeded.slug) {
      bySlug.set(seeded.slug, seeded);
    }
  }

  return bySlug;
};

const seedDailyTarotDraw = async (
  strapi: Core.Strapi,
  cardsBySlug: Map<string, SeededEntity>,
): Promise<void> => {
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

const seedNumerology = async (strapi: Core.Strapi): Promise<void> => {
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

const DAILY_HOROSCOPE_TEMPLATES = {
  Ogólny:
    'Twój dzień zapowiada się wyjątkowo harmonijnie. Pamiętaj o chwili dla siebie.',
  Miłosny:
    'Energia Wenus sprzyja dziś szczerym rozmowom i romantycznym gestom.',
  Zawodowy:
    'To dobry moment na planowanie długoterminowych projektów i budowanie relacji w zespole.',
  Finansowy:
    'Ostrożność w wydatkach przyniesie Ci spokój w nadchodzących dniach.',
  Chiński:
    'Dzisiejsza energia Wschodu podpowiada spokojne działanie, uważną obserwację i korzystanie z mądrości cykli.',
  Celtycki:
    'Rytm natury wzmacnia intuicję. Zwróć uwagę na znaki w codziennych rozmowach i drobnych powrotach do równowagi.',
  Egipski:
    'Symboliczna opieka dawnych bóstw sprzyja porządkowaniu intencji i wybieraniu tego, co naprawdę wzmacnia Twoją drogę.',
};

const buildHoroscopePremiumContent = (signName: string, type: string): string =>
  `${signName}: Pełna interpretacja Premium dla typu ${type}.

Relacje: dzisiejszy rytm najmocniej pokazuje, gdzie prosisz o bliskość pośrednio, zamiast nazwać ją wprost. Wybierz jedną relację i sprawdź, czy Twoje milczenie chroni spokój, czy tylko przedłuża napięcie. Premium zachęca do miękkiej odwagi: krótkiej rozmowy, jasnego komunikatu i zgody na to, że druga osoba może potrzebować chwili. Nie chodzi o presję, lecz o uczciwy kontakt z sercem. Jeśli w tle wraca stary schemat, nazwij go bez oskarżania siebie: "tak reaguję, kiedy boję się odrzucenia". Taka świadomość od razu zmniejsza siłę automatu.

Praca: energia typu ${type} wspiera porządkowanie priorytetów. Zamiast rozpoczynać trzy nowe sprawy, domknij jedną, która realnie zdejmie ciężar z myśli. Najlepszy ruch to ten, który ma mierzalny koniec: wysłany dokument, spisana decyzja, rozmowa z właściwą osobą albo konkretny termin. Jeżeli pojawi się chaos, wróć do pytania, co dziś buduje stabilność, a co jest tylko reakcją na cudze tempo. Dla znaku ${signName} szczególnie ważne jest odróżnienie ambicji od napięcia. Ambicja daje kierunek, napięcie każe udowadniać wartość zbyt szybko.

Energia dnia: dla znaku ${signName} ważny jest dziś spokojny kontakt z ciałem. Zwróć uwagę na oddech, kark i dłonie, bo tam najszybciej zapisuje się pośpiech. Woda, regularny posiłek i pięć minut bez ekranu mogą dać więcej jasności niż kolejna analiza. Ten dzień nie wymaga perfekcji. Wymaga rytmu, który pozwoli Ci usłyszeć intuicję, zanim odpowiesz światu. Po południu sprawdź poziom pobudzenia w skali od jednego do dziesięciu. Jeśli wynik jest wysoki, najpierw obniż napięcie, a dopiero potem podejmuj decyzję.

Rytuał: usiądź przy naturalnym świetle albo zapal małą świecę. Zapisz intencję zaczynającą się od słów: "Dziś wybieram...". Potem dopisz trzy konkretne gesty, które potwierdzą tę intencję w relacjach, pracy i odpoczynku. Przez dziewięć spokojnych oddechów trzymaj uwagę na sercu. Na koniec wykonaj pierwszy, najmniejszy gest od razu, aby energia nie została tylko pięknym zdaniem. Wieczorem wróć do intencji i dopisz, gdzie była najłatwiejsza, a gdzie wymagała odwagi. To zamieni horoskop w osobistą mapę, nie jednorazowy tekst.

Pytanie refleksyjne: który wybór wzmacnia mój spokój i sprawczość, nawet jeśli wymaga ode mnie większej szczerości niż zwykle? Jaką jedną decyzję mogę odłożyć, dopóki nie wrócę do spokojniejszego oddechu i pełniejszego obrazu sytuacji?`;

const GENERAL_PERIOD_TEMPLATES = {
  Tygodniowy:
    'Nadchodzący tydzień będzie czasem intensywnego wzrostu i nowych możliwości.',
  Miesięczny:
    'Ten miesiąc sprzyja refleksji nad dotychczasowymi osiągnięciami i wyznaczaniu nowych celów.',
  Roczny:
    'Cały rok upłynie pod znakiem transformacji i odkrywania własnego potencjału.',
};

const seedHoroscopes = async (
  strapi: Core.Strapi,
  signsByName: Map<string, SeededEntity>,
): Promise<void> => {
  const today = getWarsawDate();
  const publishedAt = new Date().toISOString();

  for (const sign of signsByName.values()) {
    for (const [type, baseContent] of Object.entries(
      DAILY_HOROSCOPE_TEMPLATES,
    )) {
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
          premiumContent: buildHoroscopePremiumContent(String(sign.name), type),
          publishedAt,
        },
      );
    }

    for (const [period, baseContent] of Object.entries(
      GENERAL_PERIOD_TEMPLATES,
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
          premiumContent: buildHoroscopePremiumContent(
            String(sign.name),
            period,
          ),
          publishedAt,
        },
      );
    }
  }
};

const backfillPremiumContent = async (strapi: Core.Strapi): Promise<void> => {
  const horoscopeQuery = strapi.db.query('api::horoscope.horoscope');
  const horoscopes = (await horoscopeQuery.findMany({
    populate: { zodiac_sign: true },
    limit: 1000,
  })) as Array<{
    id: number;
    content?: string | null;
    premiumContent?: string | null;
    period?: string | null;
    type?: string | null;
    zodiac_sign?: { name?: string | null } | null;
  }>;

  for (const horoscope of horoscopes) {
    const kind =
      horoscope.period === 'Dzienny' ? 'horoscope-daily' : 'horoscope-periodic';
    const quality = evaluatePremiumContentQuality({
      content: horoscope.content,
      premiumContent: horoscope.premiumContent,
      kind,
    });

    if (!quality.valid) {
      await horoscopeQuery.update({
        where: { id: horoscope.id },
        data: {
          premiumContent: buildHoroscopePremiumContent(
            horoscope.zodiac_sign?.name || 'Twój znak',
            horoscope.type || horoscope.period || 'Ogólny',
          ),
        },
      });
    }
  }

  const articleQuery = strapi.db.query('api::article.article');
  const articles = (await articleQuery.findMany({ limit: 1000 })) as Array<{
    id: number;
    title?: string | null;
    content?: string | null;
    premiumContent?: string | null;
    isPremium?: boolean | null;
  }>;

  for (const article of articles) {
    const quality = evaluatePremiumContentQuality({
      content: article.content,
      premiumContent: article.premiumContent,
      kind: 'article',
    });

    if (!quality.valid || !article.isPremium) {
      await articleQuery.update({
        where: { id: article.id },
        data: {
          premiumContent: buildArticlePremiumContent(
            article.title || 'Materiał Star Sign',
          ),
          isPremium: true,
        },
      });
    }
  }
};

export const ensureBootstrapContent = async (
  strapi: Core.Strapi,
): Promise<void> => {
  const signs = await seedZodiacSigns(strapi);
  const categories = await seedCategories(strapi);
  await seedArticles(strapi, categories);
  const cards = await seedTarotCards(strapi);
  await ensureSeedMedia(strapi, {
    articleSlugs: ARTICLES.map((article) => article.slug),
  });
  await seedDailyTarotDraw(strapi, cards);
  await seedNumerology(strapi);
  await seedHoroscopes(strapi, signs);
  await backfillPremiumContent(strapi);
  await ensureGlobalSettings(strapi);
};

export const ensureHoroscopeWorkflows = async (
  strapi: Core.Strapi,
): Promise<void> => {
  await upsertAicoWorkflows(strapi, ['horoscope']);
};

export const ensureArticleWorkflows = async (
  strapi: Core.Strapi,
): Promise<void> => {
  await upsertAicoWorkflows(strapi, ['article']);
};

export const ensureDailyCardWorkflows = async (
  strapi: Core.Strapi,
): Promise<void> => {
  await upsertAicoWorkflows(strapi, ['daily_card']);
};

const upsertAicoWorkflows = async (
  strapi: Core.Strapi,
  workflowTypes: Array<'horoscope' | 'article' | 'daily_card'>,
): Promise<void> => {
  const token = resolveOpenRouterToken();
  const encryptedToken = encryptToken(strapi, token);
  const enableWorkflows =
    Boolean(encryptedToken) &&
    toBoolean(process.env.AICO_ENABLE_WORKFLOWS, false);
  const model = resolveOpenRouterModel();
  const query = strapi.db.query('plugin::ai-content-orchestrator.workflow');

  const categories = (await strapi.entityService.findMany(
    'api::category.category',
    {
      limit: 10,
    },
  )) as any[];
  const defaultCatId = categories[0]?.id || null;

  const definitions = buildAicoWorkflowDefinitions({
    model,
    encryptedToken,
    enableWorkflows,
    categoryId: defaultCatId,
  }).filter((definition) => workflowTypes.includes(definition.workflow_type));

  for (const definition of definitions) {
    const existing = await query.findOne({
      where: { name: definition.name },
    });
    const tokenToPersist =
      encryptedToken || existing?.llm_api_token_encrypted || null;

    await upsertOne(
      strapi,
      'plugin::ai-content-orchestrator.workflow',
      { name: definition.name },
      {
        ...definition,
        llm_api_token_encrypted: tokenToPersist,
        enabled: tokenToPersist ? definition.enabled : false,
      },
    );
  }

  for (const legacyName of AICO_LEGACY_WORKFLOW_NAMES) {
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
};

export const ensureGlobalSettings = async (
  strapi: Core.Strapi,
): Promise<void> => {
  const store = strapi.store({
    type: 'plugin',
    name: 'ai-content-orchestrator',
    key: 'settings',
  });
  const current = (await store.get()) as Record<string, unknown> | null;

  if (!current || !current.image_gen_model) {
    const model = resolveImageGenModel();
    const token = resolveImageGenToken();
    const encryptedToken = token ? encryptToken(strapi, token) : null;

    await store.set({
      value: {
        timezone: WARSAW_TIMEZONE,
        locale: 'pl',
        image_gen_model: model,
        image_gen_api_token_encrypted: encryptedToken,
        ...(current || {}),
      },
    });
    strapi.log.info(
      '[aico] Global settings seeded or updated with Media Gen config.',
    );
  }
};
