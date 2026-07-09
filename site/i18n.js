const STRINGS = {
  pl: {
    // header
    nav_home: 'Strona główna', nav_beds: 'Łóżka', nav_mattresses: 'Materace',
    nav_bedding: 'Pościel', nav_accessories: 'Akcesoria', nav_about: 'O nas', nav_contact: 'Kontakt',
    // hero
    hero_tag: 'Sen ma znaczenie',
    hero_title: 'Dobry sen zaczyna się tutaj',
    hero_sub: 'Tworzymy produkty, które zapewniają komfort, piękno i jakość snu każdej nocy.',
    cta_products: 'Zobacz produkty', cta_visit: 'Umów wizytę',
    hero_bubble: 'Kliknij kategorię poniżej i znajdź to, czego potrzebujesz.',
    // categories
    cat_heading: 'Wybierz kategorię',
    cat_beds: 'Łóżka', cat_mattresses: 'Materace', cat_bedding: 'Pościel',
    cat_pillows: 'Poduszki', cat_kids: 'Dla dzieci', cat_accessories: 'Akcesoria',
    cat_more: 'Zobacz więcej',
    // benefits
    ben_heading: 'Dlaczego Spanko?',
    ben_test_t: '100 nocy na test', ben_test_d: 'Masz 100 nocy na spokojne przetestowanie materaca.',
    ben_warranty_t: '10 lat gwarancji', ben_warranty_d: 'Długa gwarancja to nasza obietnica jakości.',
    ben_delivery_t: 'Darmowa dostawa', ben_delivery_d: 'Szybka i bezpieczna dostawa do Twojego domu.',
    ben_quality_t: 'Polska jakość', ben_quality_d: 'Wspieramy lokalną produkcję i najlepsze materiały.',
    ben_advice_t: 'Profesjonalne doradztwo', ben_advice_d: 'Nasi eksperci pomogą Ci wybrać idealne rozwiązanie.',
    // products
    prod_heading: 'Polecane produkty',
    prod_from: 'od', prod_bed: 'Łóżko Luna', prod_mattress: 'Materac Premium',
    prod_frame: 'Stelaż Comfort', prod_pillow: 'Poduszka Cloud',
    prod_all: 'Zobacz wszystkie produkty',
    // about
    about_heading: 'O salonie',
    about_text: 'Od lat pomagamy dobrać idealny materac i stworzyć komfortową sypialnię. Oferujemy materace, łóżka oraz akcesoria renomowanych producentów. W naszym salonie liczy się jakość, profesjonalna obsługa i Twoje zadowolenie.',
    about_cta: 'Poznaj nas',
    // testimonials
    rev_heading: 'Opinie klientów',
    rev_1: '„Bardzo profesjonalna obsługa. Duży wybór i świetne doradztwo." — Anna K.',
    rev_2: '„Najlepszy wybór materacy w okolicy. Świetna jakość!" — Marcin T.',
    rev_3: '„Polecam każdemu! Wygodne łóżko zmieniło mój sen na lepsze." — Katarzyna P.',
    // contact
    con_heading: 'Kontakt',
    con_address: 'TANIEC 1, 32-800 Brzesko',
    con_hours_t: 'Godziny otwarcia',
    con_hours: 'Pon–Pt: 9:00–17:00 · Sob: 9:00–13:00',
    con_route: 'Wyznacz trasę',
    con_map: 'Mapa dojazdu',
    // footer
    foot_products: 'Produkty', foot_info: 'Informacje', foot_help: 'Pomoc',
    foot_about: 'O nas', foot_delivery: 'Dostawa i płatności', foot_returns: 'Zwroty i reklamacje',
    foot_terms: 'Regulamin', foot_privacy: 'Polityka prywatności',
    foot_faq: 'FAQ', foot_guide: 'Poradnik',
    foot_rights: '© 2027 Spanko. Wszelkie prawa zastrzeżone.',
    // chat widget
    chat_title: 'Spanko — Czat projektowy',
    chat_placeholder: 'Napisz wiadomość…',
  },
  de: {
    nav_home: 'Startseite', nav_beds: 'Betten', nav_mattresses: 'Matratzen',
    nav_bedding: 'Bettwäsche', nav_accessories: 'Zubehör', nav_about: 'Über uns', nav_contact: 'Kontakt',
    hero_tag: 'Schlaf hat Bedeutung',
    hero_title: 'Guter Schlaf beginnt hier',
    hero_sub: 'Wir schaffen Produkte, die Komfort, Schönheit und Schlafqualität in jeder Nacht bieten.',
    cta_products: 'Produkte ansehen', cta_visit: 'Termin vereinbaren',
    hero_bubble: 'Klicke unten auf eine Kategorie und finde, was du brauchst.',
    cat_heading: 'Kategorie wählen',
    cat_beds: 'Betten', cat_mattresses: 'Matratzen', cat_bedding: 'Bettwäsche',
    cat_pillows: 'Kissen', cat_kids: 'Für Kinder', cat_accessories: 'Zubehör',
    cat_more: 'Mehr ansehen',
    ben_heading: 'Warum Spanko?',
    ben_test_t: '100 Nächte Test', ben_test_d: 'Du hast 100 Nächte, um deine Matratze in Ruhe zu testen.',
    ben_warranty_t: '10 Jahre Garantie', ben_warranty_d: 'Lange Garantie ist unser Qualitätsversprechen.',
    ben_delivery_t: 'Gratis-Lieferung', ben_delivery_d: 'Schnelle und sichere Lieferung zu dir nach Hause.',
    ben_quality_t: 'Polnische Qualität', ben_quality_d: 'Wir setzen auf lokale Produktion und beste Materialien.',
    ben_advice_t: 'Professionelle Beratung', ben_advice_d: 'Unsere Experten helfen dir, die ideale Lösung zu finden.',
    prod_heading: 'Empfohlene Produkte',
    prod_from: 'ab', prod_bed: 'Bett Luna', prod_mattress: 'Matratze Premium',
    prod_frame: 'Lattenrost Comfort', prod_pillow: 'Kissen Cloud',
    prod_all: 'Alle Produkte ansehen',
    about_heading: 'Über den Laden',
    about_text: 'Seit Jahren helfen wir, die perfekte Matratze zu finden und ein komfortables Schlafzimmer zu gestalten. Wir bieten Matratzen, Betten und Zubehör namhafter Hersteller. In unserem Geschäft zählen Qualität, professioneller Service und deine Zufriedenheit.',
    about_cta: 'Lerne uns kennen',
    rev_heading: 'Kundenmeinungen',
    rev_1: '„Sehr professioneller Service. Große Auswahl und tolle Beratung." — Anna K.',
    rev_2: '„Die beste Matratzenauswahl in der Umgebung. Super Qualität!" — Marcin T.',
    rev_3: '„Absolut empfehlenswert! Das bequeme Bett hat meinen Schlaf verbessert." — Katarzyna P.',
    con_heading: 'Kontakt',
    con_address: 'TANIEC 1, 32-800 Brzesko',
    con_hours_t: 'Öffnungszeiten',
    con_hours: 'Mo–Fr: 9:00–17:00 · Sa: 9:00–13:00',
    con_route: 'Route planen',
    con_map: 'Anfahrtskarte',
    foot_products: 'Produkte', foot_info: 'Informationen', foot_help: 'Hilfe',
    foot_about: 'Über uns', foot_delivery: 'Lieferung & Zahlung', foot_returns: 'Rückgabe & Reklamation',
    foot_terms: 'AGB', foot_privacy: 'Datenschutz',
    foot_faq: 'FAQ', foot_guide: 'Ratgeber',
    foot_rights: '© 2027 Spanko. Alle Rechte vorbehalten.',
    chat_title: 'Spanko — Design-Chat',
    chat_placeholder: 'Nachricht schreiben…',
  },
};

function setLang(lang) {
  const dict = STRINGS[lang] || STRINGS.pl;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const v = dict[el.getAttribute('data-i18n')];
    if (v != null) el.textContent = v;
  });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => {
    const v = dict[el.getAttribute('data-i18n-ph')];
    if (v != null) el.setAttribute('placeholder', v);
  });
  document.querySelectorAll('[data-lang-btn]').forEach(b =>
    b.classList.toggle('active', b.getAttribute('data-lang-btn') === lang));
  localStorage.setItem('spankoLang', lang);
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-lang-btn]').forEach(b =>
    b.addEventListener('click', () => setLang(b.getAttribute('data-lang-btn'))));
  setLang(localStorage.getItem('spankoLang') || 'pl');
});
