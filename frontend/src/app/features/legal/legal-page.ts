import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';

type LegalPageKey = 'terms' | 'privacy' | 'cookies' | 'disclaimer';

/**
 * Treści prawne serwisu. Redagowane zgodnie z metodologią Lex Machina:
 * przywołujemy wyłącznie przepisy zweryfikowane w oficjalnych źródłach
 * (ISAP / Dz.U.); tam, gdzie pełna weryfikacja numeru artykułu nie była
 * możliwa, stosujemy zasadę „brak numeru jest lepszy niż błędny numer"
 * i wskazujemy sam akt prawny.
 */
const LEGAL_PAGES: Record<
  LegalPageKey,
  {
    title: string;
    updatedAt: string;
    sections: Array<{ heading: string; body: string }>;
  }
> = {
  terms: {
    title: 'Regulamin',
    updatedAt: '26 sierpnia 2026',
    sections: [
      {
        heading: 'Postanowienia ogólne i definicje',
        body: 'Niniejszy Regulamin określa zasady świadczenia usług drogą elektroniczną przez Serwis Star Sign (dalej: „Serwis"), w tym udostępniania treści astrologicznych, tarota i numerologii oraz funkcji konta użytkownika i subskrypcji premium. Regulamin uwzględnia wymogi ustawy z dnia 18 lipca 2002 r. o świadczeniu usług drogą elektroniczną oraz — wobec Konsumentów — ustawy z dnia 30 maja 2014 r. o prawach konsumenta. Pojęcia pisane wielką literą mają znaczenie nadane im w treści Regulaminu.',
      },
      {
        heading: 'Charakter usługi',
        body: 'Serwis udostępnia treści o charakterze informacyjno-rozrywkowym (horoskopy, odczyty tarota, numerologia, artykuły redakcyjne), tworzone z wykorzystaniem narzędzi wspomaganych sztuczną inteligencją i poddawane kontroli redakcyjnej. Treści nie stanowią porady prawnej, medycznej, psychologicznej ani innej profesjonalnej porady. Pełne zastrzeżenia opisuje strona Zastrzeżenia.',
      },
      {
        heading: 'Rejestracja i konto użytkownika',
        body: 'Korzystanie z części funkcji wymaga rejestracji konta z użyciem adresu e-mail lub dostawcy tożsamości wskazanego w formularzu logowania. Użytkownik zobowiązany jest podawać dane zgodne z prawdą oraz zabezpieczyć dostęp do konta przed osobami trzecimi. Konto jest bezpłatne; płatna jest wyłącznie subskrypcja premium opisana poniżej.',
      },
      {
        heading: 'Subskrypcja premium — cena i cykl rozliczeniowy',
        body: 'Subskrypcja premium odblokowuje rozszerzone odczyty, historię zapisanych treści oraz inne funkcje oznaczone jako premium. Ceny podawane są w złotych polskich i obejmują podatki. Subskrypcja zawierana jest na okres miesięczny albo roczny i odnawia się automatycznie, chyba że zostanie anulowana najpóźniej do dnia odnowienia. Anulowanie jest możliwe w każdej chwili w ustawieniach konta; dostęp premium pozostaje aktywny do końca opłaconego okresu.',
      },
      {
        heading: 'Płatności',
        body: 'Obsługę płatności i przechowywania środków identyfikacyjnych karty zapewnia zewnętrzny operator płatności Stripe Payments Europe, Ltd., który działa jako niezależny administrator danych w zakresie obsługi transakcji. Serwis nie przechowuje numerów kart płatniczych. W przypadku nieudanej płatności dostęp premium może zostać ograniczony do czasu uregulowania należności.',
      },
      {
        heading: 'Umowa o dostarczanie treści cyfrowych',
        body: 'Przedmiotem subskrypcji jest dostarczanie treści cyfrowych w rozumieniu przepisów Kodeksu cywilnego o umowie zobowiązującej do dostarczania treści cyfrowej oraz działu III części 3 ustawy o prawach konsumenta. Serwis zobowiązuje się dostarczać treści zgodne z umową i aktualizować je w rozsądnym zakresie; Użytkownik zobowiązany jest do korzystania z nich zgodnie z Regulaminem i prawem.',
      },
      {
        heading: 'Prawo odstąpienia od umowy — Konsument',
        body: 'Konsument zawierający umowę na odległość ma prawo odstąpić od niej bez podania przyczyny w terminie 14 dni od dnia zawarcia umowy (art. 27 ustawy o prawach konsumenta). Jeżeli Konsument zażąda dostarczenia treści cyfrowych przed upływem tego terminu i wyrazi na to wyraźną zgodę wraz ze świadomością utraty prawa odstąpienia, prawo odstąpienia przysługuje zgodnie z art. 38 pkt 13 ustawy o prawach konsumenta. Odstąpienie można złożyć drogą e-mail na adres kontaktowy wskazany w stopce; potwierdzamy jego otrzymanie bez zbędnej zwłoki.',
      },
      {
        heading: 'Reklamacje i niezgodność z umową',
        body: 'W przypadku stwierdzenia niezgodności treści lub funkcji z umową Użytkownik może złożyć reklamację drogą e-mail na adres kontaktowy wskazany w stopce, opisując problem i preferowane rozwiązanie. Reklamacje rozpatrujemy w terminie 14 dni od otrzymania. Od odpowiedzialności za brak zgodności treści cyfrowych z umową stosuje się przepisy Kodeksu cywilnego, według których roszczenia z tytułu braku zgodności ulegają przedawnieniu na zasadach ogólnych, a uprawnienia Użytkownika obejmują m.in. doprowadzenie do zgodności, obniżenie ceny oraz odstąpienie od umowy.',
      },
      {
        heading: 'Ochrona danych osobowych',
        body: 'Administratorem danych osobowych jest Administrator Serwisu. Zasady przetwarzania danych, cele, podstawy prawne, prawa osób, których dane dotyczą, oraz informacje o odbiorcach danych opisuje Polityka prywatności dostępna w stopce serwisu.',
      },
      {
        heading: 'Zmiany Regulaminu',
        body: 'Administrator może zmienić Regulamin z ważnych powodów, takich jak zmiana przepisów prawa, zakresu funkcji czy modelu płatności. O zmianie informujemy z wyprzedzeniem co najmniej 14 dni przez publikację w Serwisie oraz wiadomością e-mail. Zmiany nie naruszają praw nabytych; kontynuowanie korzystania z Serwisu po wejściu zmian w życie oznacza ich akceptację, a brak akceptacji umożliwia wypowiedzenie umowy bez ponoszenia kosztów.',
      },
      {
        heading: 'Postanowienia abuzywne',
        body: 'Żadne postanowienie Regulaminu nie modyfikuje ani nie wyłącza uprawnień Konsumenta wynikających z przepisów bezwzględnie obowiązujących. Postanowienie nieważalne w świetle art. 385¹ Kodeksu cywilnego nie wiąże stron, a pozostała część Regulaminu zachowuje moc.',
      },
      {
        heading: 'Prawo właściwe i rozwiązywanie sporów',
        body: 'Umowa podlega prawu polskiemu. W sprawach z udziałem Konsumenta właściwe są sądy zgodnie z przepisami Kodeksu postępowania cywilnego. Europejska Platforma Rozstrzygania Sporów Online została wyłączona z dnia 20 lipca 2025 r. na podstawie rozporządzenia Parlamentu Europejskiego i Rady (UE) 2024/3228; Konsumentom przysługują krajowe drogi dochodzenia roszczeń, w tym pozasądowe rozwiązywanie sporów konsumenckich prowadzone przez Inspekcję Handlową.',
      },
      {
        heading: 'Postanowienia końcowe',
        body: 'Umowa zawierana jest na czas nieoznaczony (konta bezpłatne) albo na czas oznaczony odpowiadający cyklowi rozliczeniowemu (subskrypcja) i może być wypowiedziana w każdej chwili z zachowaniem opisanego wyżej trybu. W sprawach nieuregulowanych stosuje się prawo polskie. Kontakt z Administratorem jest możliwy na adres e-mail wskazany w stopce serwisu.',
      },
    ],
  },
  privacy: {
    title: 'Polityka prywatności',
    updatedAt: '26 sierpnia 2026',
    sections: [
      {
        heading: 'Administrator danych',
        body: 'Administratorem danych osobowych przetwarzanych w Serwisie jest Administrator Serwisu, dostępny pod adresem e-mail wskazanym w stopce. Administracja nie powołała Inspektora Ochrony Danych; wszystkie zapytania w zakresie ochrony danych kieruj na adres kontaktowy.',
      },
      {
        heading: 'Zakres i źródła danych',
        body: 'Przetwarzamy dane podane przy rejestracji (adres e-mail, identyfikator dostawcy logowania), dane profilu uzupełniane przez Użytkownika (np. znak zodiaku, data urodzenia — wyłącznie do personalizacji treści), historię odczytów i zapisanych treści, dane transakcyjne przekazywane przez operatora płatności (identyfikator subskrypcji, status płatności — bez pełnych numerów kart), adres e-mail newslettera oraz techniczne dane o korzystaniu z Serwisu zbierane przez pliki cookies i narzędzia analityczne.',
      },
      {
        heading: 'Cele i podstawy prawne',
        body: 'Dane przetwarzamy w celu: świadczenia usług i obsługi konta (art. 6 ust. 1 lit. b RODO — wykonanie umowy), realizacji płatności subskrypcji (lit. b), personalizacji treści i rozwoju Serwisu na podstawie uzasadnionego interesu (lit. f), wysyłki newslettera i marketingu za zgodą (lit. a) oraz wypełnienia obowiązków prawnych, np. rachunkowych (lit. c). Personalizacja astrologiczna nie stanowi decyzji opartej wyłącznie na zautomatyzowanym przetwarzaniu w rozumieniu art. 22 RODO — nie wywołuje skutków prawnych ani nie wpływa w podobnie istotny sposób na sytuację osoby.',
      },
      {
        heading: 'Odbiorcy danych i transfery',
        body: 'Odbiorcami danych są: Stripe Payments Europe, Ltd. (obsługa płatności; siedziba w Irlandii), Google Ireland Limited (Google Analytics 4 — z włączoną anonimizacją/adaptacją adresów IP; ewentualne Google Ads/AdSense po uzyskaniu zgody) oraz dostawca hostingu i infrastruktury serwerowej zlokalizowanej na terenie Europejskiego Obszaru Gospodarczego. Przekazania do Stanów Zjednoczonych, jeśli występują, odbywają się na podstawie decyzji wykonawczej Komisji w sprawie adekwatności EU–USA Data Privacy Framework.',
      },
      {
        heading: 'Okres przechowywania',
        body: 'Dane konta przechowujemy przez czas korzystania z Serwisu, a po usunięciu konta — przez okres niezbędny do rozliczeń, dochodzenia roszczeń i wypełnienia obowiązków prawnych (zwykle do 5 lat od końca roku rozliczeniowego dla dokumentów księgowych). Dane newslettera usuwamy niezwłocznie po wypisaniu się, o ile obowiązek ich dalszego przechowywania nie wynika z przepisów.',
      },
      {
        heading: 'Prawa osób, których dane dotyczą',
        body: 'Masz prawo dostępu do danych (art. 15 RODO), ich sprostowania (art. 16), usunięcia (art. 17), ograniczenia przetwarzania (art. 18), przenoszenia danych (art. 20), sprzeciwu wobec przetwarzania opartego na uzasadnionym interesie (art. 21) oraz cofnięcia zgody w dowolnym momencie bez wpływu na zgodność z prawem przetwarzania dokonanego przed cofnięciem. Masz również prawo wniesienia skargi do Prezesa Urzędu Ochrony Danych Osobowych.',
      },
      {
        heading: 'Bezpieczeństwo',
        body: 'Stosujemy szyfrowanie transmisji (TLS), hashowanie haseł, kontrolę dostępu na poziomie serwera i bazodanowym oraz ograniczenie retencji logów. W razie naruszenia ochrony danych osobowego mogącego powodować ryzyko dla praw osób informujemy organ nadzorczy i zainteresowane osoby zgodnie z art. 33 i 34 RODO.',
      },
      {
        heading: 'Pliki cookies',
        body: 'Szczegółowe informacje o plikach cookies, ich kategoriach, podstawach prawnych i sposobie zarządzania nimi znajdują się na stronie Ciasteczka dostępnej w stopce serwisu.',
      },
      {
        heading: 'Zmiany Polityki',
        body: 'Polityka może być aktualizowana w związku ze zmianami przepisów, orzecznictwa lub zakresu usług. O istotnych zmianach informujemy w Serwisie, a data aktualizacji wskazana wyżej zawsze odpowiada wersji obowiązującej.',
      },
    ],
  },
  cookies: {
    title: 'Ciasteczka',
    updatedAt: '26 sierpnia 2026',
    sections: [
      {
        heading: 'Czym są pliki cookies',
        body: 'Cookies to małe pliki tekstowe zapisywane na Twoim urządzeniu przez serwis internetowy. Służą m.in. utrzymaniu sesji logged-in, zapamiętaniu preferencji oraz pomiarowi ruchu. Korzystamy z nich na podstawie art. 173 ustawy o świadczeniu usług drogą elektroniczną oraz — w zakresie danych osobowych — RODO.',
      },
      {
        heading: 'Cookies niezbędne',
        body: 'Niezbędne do działania Serwisu pliki (utrzymanie sesji, bezpieczeństwo, pamięć zgód cookie) nie wymagają zgody i są zapisywane zawsze, ponieważ bez nich Serwis nie może poprawnie działać.',
      },
      {
        heading: 'Cookies analityczne (GA4)',
        body: 'Korzystamy z Google Analytics 4 do anonimowego pomiaru ruchu i jakości stron. Adresy IP są skracane/anonimizowane, a okres przechowywania danych analitycznych jest ograniczony. Dane analityczne przetwarzane są na podstawie uzasadnionego interesu administratora; możesz je wyłączyć w banerze zgód oraz w ustawieniach przeglądarki.',
      },
      {
        heading: 'Cookies marketingowe (AdSense)',
        body: 'Jeśli w banerze zgód zaznaczysz odpowiednią opcję, partner reklamowy Google może zapisywać cookies marketingowe (AdSense) służące dopasowaniu reklam i pomiarowi ich skuteczności. Brak zgody nie ogranicza dostępu do treści Serwisu — reklamy będą wtedy niespersonalizowane albo ich nie będzie.',
      },
      {
        heading: 'Zarządzanie zgodami i usuwanie cookies',
        body: 'Zgody cookie możesz zmienić w każdej chwili — ponownie otwórz panel zgód (link w stopce) lub wyczyść pliki cookies w ustawieniach przeglądarki. Każda przeglądarka pozwala blokować lub usuwać cookies dla poszczególnych witryn; instrukcje znajdziesz w pomocy swojej przeglądarki. Pamiętaj, że wyłączenie cookies niezbędnych może uniemożliwić logowanie.',
      },
      {
        heading: 'Inne technologie',
        body: 'Do celów statystycznych możemy stosować równoważne technologie (localStorage, pixel analityczny). Traktujemy je tak samo jak cookies — wymagają tej samej zgody, chyba że są niezbędne do działania Serwisu.',
      },
    ],
  },
  disclaimer: {
    title: 'Zastrzeżenia',
    updatedAt: '26 sierpnia 2026',
    sections: [
      {
        heading: 'Charakter treści',
        body: 'Horoskopy, tarot, numerologia i interpretacje prezentowane w Serwisie mają charakter refleksyjno-rozrywkowy. Nie zastępują profesjonalnej konsultacji medycznej, psychologicznej, prawnej ani finansowej i nie powinny być podstawą decyzji o wysokim znaczeniu życiowym.',
      },
      {
        heading: 'Transparentność sztucznej inteligencji',
        body: 'Część treści Serwisu jest tworzona z wykorzystaniem systemów sztucznej inteligencji, a następnie redagowana i sprawdzana przez ludzi. Zgodnie z duchem art. 50 rozporządzenia (UE) 2024/1689 (AI Act) informujemy o tym wprost wszędzie tam, gdzie treść została wygenerowana z istotnym udziałem AI.',
      },
      {
        heading: 'Brak gwarancji rezultatów',
        body: 'Serwis nie gwarantuje określonych rezultatów życiowych, zdrowotnych, relacyjnych ani finansowych wynikających z zastosowania treści. Opinie i prognozy astrologiczne wyrażają interpretację symboliki, a nie stwierdzenia faktu naukowego.',
      },
      {
        heading: 'Zdrowie psychiczne',
        body: 'Jeśli zmagasz się z trudnymi emocjami, kryzysom lub myślami o samookaleczeniu — skorzystaj z pomocy profesjonalistów. Bezpłatne wsparcie oferuje m.in. Centrum Wsparcia dla osób dorosłych w kryzysie psychicznym (tel. 800 70 2222, całodobowo). Treści Serwisu nie są narzędziem diagnostycznym ani terapeutycznym.',
      },
      {
        heading: 'Własność intelektualna',
        body: 'Treści Serwisu (teksty, grafiki, układ, kod) objęte są prawami autorskimi Administratora lub licencjodawców. Korzystanie osobiste w ramach usługi jest dozwolone; kopiowanie masowe, publikacja i wykorzystanie komercyjne poza zakresem umowy wymagają pisemnej zgody.',
      },
    ],
  },
};

@Component({
  selector: 'app-legal-page',
  imports: [RouterLink],
  template: `
    <main class="bg-[#FFFBFB] min-h-screen pt-16 pb-24">
      <section class="section-container max-w-4xl">
        <a
          routerLink="/"
          class="text-sm text-mystic-rose font-semibold tracking-widest uppercase"
          >Star Sign</a
        >
        <h1
          class="serif-display text-4xl md:text-6xl text-mystic-cocoa mt-8 mb-4"
        >
          {{ page.title }}
        </h1>
        <p class="text-mystic-cocoa mb-12">
          Ostatnia aktualizacja: {{ page.updatedAt }}
        </p>

        <div class="space-y-8">
          @for (section of page.sections; track section.heading) {
            <section class="border-t border-mystic-rose/15 pt-8">
              <h2 class="serif-display text-2xl text-mystic-cocoa mb-4">
                {{ section.heading }}
              </h2>
              <p class="text-mystic-cocoa leading-relaxed font-light">
                {{ section.body }}
              </p>
            </section>
          }
        </div>
      </section>
    </main>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LegalPage {
  private readonly route = inject(ActivatedRoute);
  public readonly page =
    LEGAL_PAGES[
      (this.route.snapshot.data['page'] as LegalPageKey) || 'disclaimer'
    ];
}
