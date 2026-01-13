import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface DocSection {
  title: string;
  content: string[];
}

const documentationContent: DocSection[] = [
  {
    title: "1. OBZOR SISTEMY",
    content: [
      "Sistema analiziruet eksport prodazh iz 1S za neskolko mesyatsev i predostavlyaet:",
      "",
      "DASHBOARD (Glavnaya stranitsa):",
      "- KPI karty: vyruchka, pribyl, srednyaya marzha, kolichestvo artikulov",
      "- Grafik dinamiki prodazh po periodam",
      "- ABC raspredelenie (krugovaya diagramma)",
      "- Top-10 tovarov po vyruchke i pribyli",
      "- Statistika nalichiya (v nalichii / net v nalichii)",
      "",
      "ANALIZ:",
      "- ABC-XYZ Matritsa: Interaktivnaya matritsa 3x3 s klikabelnymi yacheykami",
      "- ABC Analiz: Klassifikatsiya tovarov po vkladu v vyruchku (A=80%, B=15%, C=5%)",
      "- XYZ Analiz: Klassifikatsiya po stabilnosti sprosa s nastraivaemymi porogami",
      "- Plan proizvodstva: Raschet na 1, 3 i 6 mesyatsev s uchetom globalnogo trenda",
      "- Rekomendatsii: Avtomaticheskie rekomendatsii po upravleniyu zapasami",
      "",
      "UPRAVLENIE ASSORTIMENTOM:",
      "- Katalog artikulov: Upravlenie vidimostyu i gruppami tovarov",
      "- Kill-list: Upravlenie vyvodom tovarov s avto-lestnicey tsen",
      "- Yunit-ekonomika: Raschet sebestoimosti, marzhi, pribyli i stsenariev WB",
      "",
      "DOPOLNITELNO:",
      "- Istoriya izmeneniy kartochek tovarov",
      "- Prognozirovanie: regressiya, sglazhivanie, skolzyashchaya srednyaya",
      "- Multi-select i massovye operatsii nad artikulami",
      "- Sortirovka tablits po lyuboy kolonke"
    ]
  },
  {
    title: "2. NAVIGATSIYA PO MENYU",
    content: [
      "Menyu razdeleno na 3 gruppy:",
      "",
      "OSNOVNYE (vsegda vidny):",
      "- Dashboard: Klyuchevye metriki biznesa",
      "- Novyy raschet: Zagruzka novogo fayla iz 1S",
      "- Istoriya: Spisok vsekh obrabotannykh faylov",
      "",
      "ANALIZ (vypadayushchee menyu):",
      "- ABC-XYZ Matritsa: Interaktivnaya matritsa s tablitsey tovarov",
      "- Katalog artikulov: Upravlenie vidimostyu artikulov",
      "- Kill-list: Tovary na vyvod s lestnitsey tsen",
      "- Yunit-ekonomika: Sebestoimost i rentabelnost",
      "",
      "ESHCHE (vypadayushchee menyu):",
      "- Nastroyki: Kurs valyuty, porogi XYZ, parametry WB",
      "- Dokumentatsiya: Rukovodstvo polzovatelya",
      "- Admin-panel: Upravlenie polzovatelyami (tolko adminy)"
    ]
  },
  {
    title: "3. DASHBOARD",
    content: [
      "Dashboard - glavnaya stranitsa s klyuchevymi metrikami:",
      "",
      "KPI KARTY:",
      "- Vyruchka: Obshchaya summa prodazh za period",
      "- Pribyl: Chistaya pribyl (esli zapolnena sebestoimost)",
      "- Sr. marzha: Srednyaya rentabelnost v protsentakh",
      "- Artikulov: Obshchee kolichestvo unikalnykh artikulov",
      "- V nalichii: Kolichestvo tovarov s ostatkami > 0",
      "- Net v nalichii: Kolichestvo tovarov bez ostatkov",
      "",
      "GRAFIKI:",
      "- Dinamika prodazh: Area-chart vyruchki po mesyatsam",
      "- ABC raspredelenie: Krugovaya diagramma po gruppam A/B/C",
      "",
      "TOP-10 TOVAROV:",
      "- Pereklyuchenie: po vyruchke / po pribyli",
      "- Kolonki: Artikul, Gruppa, ABC, Summa",
      "",
      "VYBOR PROGONA:",
      "- Vyberite obrabotonnyy fayl iz spiska",
      "- Dashboard obnovlyaetsya avtomaticheski"
    ]
  },
  {
    title: "4. KAK POLZOVATSYA",
    content: [
      "Shag 1: Nastroyka parametrov",
      "  - Pereshodit v Nastroyki cherez menyu 'Eshche'",
      "  - Ukazat kurs valyuty, natsenki, porogi XYZ",
      "  - Nastroit parametry logistiki WB",
      "",
      "Shag 2: Zagruzka fayla",
      "  - Nazhat 'Novyy raschet' v menyu",
      "  - Eksportiruyte otchet iz 1S v Excel",
      "  - Zagruzite fayl v sistemu",
      "",
      "Shag 3: Ozhidanie obrabotki",
      "  - Sistema avtomaticheski raspoznaet strukturu",
      "  - Progress otobrazhaetsya v realnom vremeni",
      "",
      "Shag 4: Analiz na Dashboard",
      "  - Otrkroyte Dashboard dlya obzora metrik",
      "  - Smotrite dinamiku prodazh i top-10 tovarov",
      "",
      "Shag 5: ABC-XYZ Matritsa",
      "  - Pereshodite v menyu Analiz -> ABC-XYZ Matritsa",
      "  - Klikajte po yacheykam dlya filtratsii",
      "",
      "Shag 6: Zapolnenie sebestoimosti",
      "  - Pereshodit v menyu Analiz -> Yunit-ekonomika",
      "  - Dobavte dannye o zatratakh na proizvodstvo",
      "",
      "Shag 7: Skachivanie rezultatov",
      "  - Eksportiruyte otchety v Excel ili PDF"
    ]
  },
  {
    title: "5. FORMAT FAYLA IZ 1S",
    content: [
      "Trebovaniya k strukture fayla:",
      "- Shapka s 3 strokami (daty, metriki, tekhnicheskie polya)",
      "- Periody v formate 'Dekabr 2024' ili 'DD.MM.GGGG'",
      "- Dlya kazhdogo perioda 3 stolbtsa: Kolichestvo, Summa, Ostatok",
      "- Stolbets s artikulom ('Nomenklatura.Artikul' ili podobnyy)",
      "- Optsionalno: stolbets s kategoriyey",
      "",
      "Primechanie: Stolbtsy 'Itogo' avtomaticheski propuskayutsya.",
      "Razmer fayla: do 50 MB, 100 000+ strok."
    ]
  },
  {
    title: "6. ABC ANALIZ",
    content: [
      "Klassifikatsiya po vkladu v vyruchku:",
      "",
      "Kategoriya A - pervye 80% vyruchki",
      "  Klyuchevye tovary, trebuyushchie maksimalnogo vnimaniya k zapasam",
      "",
      "Kategoriya B - sleduyushchie 15% vyruchki", 
      "  Tovary sredney vazhnosti, standartnoe upravlenie",
      "",
      "Kategoriya C - ostavshiesya 5% vyruchki",
      "  Naimeneye znachimye tovary, kandidaty na optimizatsiyu"
    ]
  },
  {
    title: "7. XYZ ANALIZ",
    content: [
      "Klassifikatsiya po stabilnosti sprosa (koeffitsient variatsii):",
      "Porogi nastraivayutsya v Nastroykakh. Po umolchaniyu: X <= 30%, Y <= 60%.",
      "",
      "Kategoriya X - CV <= porog X%",
      "  Stabilnyy spros, legko prognoziruetsya",
      "",
      "Kategoriya Y - CV mezhdu porogami X i Y",
      "  Umerennye kolebaniya, trebuetsya strakhovoy zapas",
      "",
      "Kategoriya Z - CV > porog Y%",
      "  Nestabilnyy spros, trebuetsya individualnyy analiz"
    ]
  },
  {
    title: "8. MATRITSA ABC-XYZ",
    content: [
      "Interaktivnaya matritsa 3x3 dlya bystrogo analiza tovarov.",
      "Nahodytsya v menyu: Analiz -> ABC-XYZ Matritsa",
      "",
      "STRUKTURA MATRITSY:",
      "       |    X (stabilnyy)  |    Y (sredniy)    |    Z (nestabilnyy)",
      "-------|-------------------|-------------------|-------------------",
      "   A   | AX: Maks kontrol  | AY: Regulyar popol| AZ: Analizirovat",
      "   B   | BX: Regulyar zakaz| BY: Strakhovoy zap| BZ: Sokratit zapas",
      "   C   | CX: Min zakazy    | CY: Sokratit ass. | CZ: Vyvesti",
      "",
      "TSVETOVAYA KODIROVKA:",
      "- Zelenyy (AX, AY, BX): Luchshie tovary - razvivat i derzhat v nalichii",
      "- Zheltyy (AZ, BY, CX): Kontrolirovat - trebuetsya vnimanie",
      "- Oranzhevyy (BZ, CY): Sokrashchat zapasy",
      "- Krasnyy (CZ): Kandidaty na vyvod iz assortimenta",
      "",
      "ISPOLZOVANIE:",
      "- Klik po yacheyke filtruet tablitsu tovarov",
      "- V kazhdoy yacheyke pokazano kolichestvo tovarov i vyruchka",
      "- Knopka 'Sbrosit' snimaet filtr"
    ]
  },
  {
    title: "9. RASCHET PLANA PROIZVODSTVA",
    content: [
      "Formuly:",
      "- Srednie mesyachnye prodazhi = Obshchee kolichestvo / Chislo periodov",
      "- Dnevnaya skorost = Sr. mesyachnye * Globalnyy trend / 30",
      "- Dney do istoshcheniya = Tekushchiy ostatok / Dnevnaya skorost",
      "- Plan 1M = max(0, Sr. mesyachnye * Trend * 1 - Ostatok)",
      "- Plan 3M = max(0, Sr. mesyachnye * Trend * 3 - Ostatok)",
      "- Plan 6M = max(0, Sr. mesyachnye * Trend * 6 - Ostatok)",
      "",
      "Koeffitsient globalnogo trenda:",
      "- Ustanavlivaetsya v Nastroykakh (po umolchaniyu 1.0 = bez izmeneniy)",
      "- > 1.0 = ozhidaetsya rost (napr., 1.2 = +20%)",
      "- < 1.0 = ozhidaetsya padenie (napr., 0.8 = -20%)"
    ]
  },
  {
    title: "10. METODY PROGNOZIROVANIYA",
    content: [
      "Lineynaya regressiya:",
      "  Vychislyaet liniyu trenda na osnove istoricheskikh dannykh",
      "  y = a + b*x, gde b = koeffitsient trenda",
      "",
      "Eksponentsialnoe sglazhivanie:",
      "  Nedavnie nablyudeniya imeyut bolshiy ves",
      "  F(t+1) = alpha * Y(t) + (1-alpha) * F(t)",
      "",
      "Skolzyashchaya srednyaya:",
      "  Sredneye za poslednie N periodov s sezonnoy korrektirovkoy",
      "  Sezonnyy indeks = Sredneye za mesyats / Obshchee sredneye"
    ]
  },
  {
    title: "11. YUNIT-EKONOMIKA",
    content: [
      "Nahodytsya v menyu: Analiz -> Yunit-ekonomika",
      "",
      "STRUKTURA SEBESTOIMOSTI:",
      "- Zatratyi na tkan (do 3 tipov): Tsena USD * Kurs * kg na edinitsu",
      "- Proizvodstvo: poshiv + kroy + furnitura + pechat/vyshivka",
      "- Nakladnye: admin nakladnye % ot proizvodstvennykh zatrat",
      "",
      "TSENOOBRAZOVANIE:",
      "- Opt = Sebestoimost * (1 + natsenka%)",
      "- Roznitsa = Opt * (1 + roznichnaya natsenka%)",
      "",
      "RASCHETY WB:",
      "- Otpravleno = Plan * Vykup%",
      "- Vozvraty = Plan - Otpravleno",
      "- Logistika = (Otpravleno * k_klientu) + (Vozvraty * stoimost_vozvrata)",
      "- Priemka = Otpravleno * stoimost_priemki",
      "- Komissiya = Vyruchka * komissiya%",
      "- Nalog = Vyruchka * nalog% (USN ili NDS)",
      "- Pribyl = Vyruchka - Vse zatraty"
    ]
  },
  {
    title: "12. KILL-LIST",
    content: [
      "Nahodytsya v menyu: Analiz -> Kill-list",
      "",
      "NAZNACHENIE:",
      "- Upravlenie vyvodom neeffektivnykh tovarov",
      "- Avtomaticheskaya lestnitsa tsen so snizheniem",
      "- Otslezhivanie progressa rasprodazhi",
      "",
      "STRATEGII VYVODA:",
      "- Aggressive: Bystraya rasprodazha s bolshimi skidkami",
      "- Moderate: Sbalansirovannoe snizhenie tsen",
      "- Conservative: Medlennoe snizhenie s sohraneniem marzhi",
      "",
      "ETAPY:",
      "1. Dobavte tovar v kill-list (vruchnuyu ili cherez rekomendatsiyu)",
      "2. Nastroyte strategiyu i minimalnuyu tsenu",
      "3. Sistema sozdast plan snizheniya tsen po shagam",
      "4. Otslezhivayte progress rasprodazhi"
    ]
  },
  {
    title: "13. VARIANTY EKSPORTA",
    content: [
      "DOSTUPNYE EKSPORTY:",
      "- Otchet ABC/XYZ analitiki (Excel) - Polnyy analiz so vsemi metrikami",
      "- Plan proizvodstva (Excel) - Prioritetnyy plan proizvodstva",
      "- Otchet analitiki (PDF) - Pechatnyy otchet s tsvetovoy kodirovkoy",
      "- Plan proizvodstva (PDF) - Pechatnyy plan proizvodstva",
      "- Shablon yunit-ekonomiki (Excel) - Pustoy shablon ili s artikulami",
      "- Eksport yunit-ekonomiki (Excel) - Polnye dannye po sebestoimosti",
      "",
      "DOSTUPNYE FILTRY:",
      "- Po periodu (vybor konkretnyh mesyatsev)",
      "- Po kategorii (kategorii tovarov)",
      "- Po gruppam ABC/XYZ",
      "- Po gruppam tovarov",
      "- Po konkretnym artikulam",
      "- Po nalichyu na sklade",
      "",
      "SORTIROVKA V TABLITSAKH:",
      "- Nazhmite na zagolovok kolonki dlya sortirovki",
      "- Pervyy klik: po vozrastaniyu (A-Ya, 0-9)",
      "- Vtoroy klik: po ubyvaniyu (Ya-A, 9-0)",
      "- Tretiy klik: sbros sortirovki"
    ]
  },
  {
    title: "14. NASTROYKI",
    content: [
      "Nahodytsya v menyu: Eshche -> Nastroyki",
      "",
      "GLOBALNYE NASTROYKI:",
      "- Kurs valyuty: Kurs USD k RUB",
      "- Admin nakladnye %: Protsent nakladnykh ot proizvodstvennykh zatrat",
      "- Optovaya natsenka %: Natsenka dlya optovoy tseny",
      "- Rezhim nalogov: USN (uproshenka) ili NDS",
      "- USN Nalog %: Stavka uproshenki (po umolchaniyu 7%)",
      "- NDS %: Stavka NDS (esli primenyaetsya)",
      "",
      "POROGI XYZ:",
      "- Porog X: Maksimalnyy CV dlya stabilnogo sprosa (po umolchaniyu 30%)",
      "- Porog Y: Maksimalnyy CV dlya umerennogo sprosa (po umolchaniyu 60%)",
      "",
      "PARAMETRY LOGISTIKI WB:",
      "- Logistika k klientu (po umolchaniyu 50 RUB)",
      "- Logistika vozvrata (po umolchaniyu 50 RUB)",
      "- Stoimost priemki (po umolchaniyu 50 RUB)",
      "- Protsent vykupa (po umolchaniyu 90%)",
      "",
      "GLOBALNYY TREND:",
      "- Ruchnoy rezhim: Ustanovit fiksirovannyy koeffitsient",
      "- Avto rezhim: Raschitat iz istoricheskikh dannykh"
    ]
  },
  {
    title: "15. KONTROL KACHESTVA DANNYKH",
    content: [
      "METRIKI POSLE OBRABOTKI:",
      "- Syrye stroki: Vsego zapisey v baze (artikul x razmer x period)",
      "- Unikalnyye artikuly: Kolichestvo bez razmerov",
      "- Kombinatsii artikul+razmer: Unikalnyye pary",
      "- Koeffitsient szhatiya: Pokazyvaet effektivnost agregatsii dannykh",
      "",
      "PROVERKI KACHESTVA:",
      "- Validatsiya periodov (net budushchikh dat)",
      "- Validatsiya chislovykh dannykh",
      "- Proverka formata artikulov"
    ]
  },
  {
    title: "16. ROLI POLZOVATELEY",
    content: [
      "ADMINISTRATOR (admin):",
      "- Polnyy dostup ko vsem funktsiyam",
      "- Upravlenie polzovatelyami i ih rolyami",
      "- Odobrenie novykh registratsiy",
      "",
      "POLNYY DOSTUP (full_access):",
      "- Dostup k yunit-ekonomike i sebestoimosti",
      "- Eksport vsekh tipov otchetov",
      "- Prosmotr marzhi i pribyli",
      "",
      "SKRYTAYA SEBESTOIMOST (hidden_cost):",
      "- Bazovyy analiz ABC/XYZ",
      "- Net dostupa k sebestoimosti i pribyli",
      "- Ogranichennye varianty eksporta"
    ]
  }
];

export function exportDocumentationToPDF(): void {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.width;
  const pageHeight = doc.internal.pageSize.height;
  const margin = 15;
  const contentWidth = pageWidth - 2 * margin;
  let currentY = margin;

  // Title page
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.text('Sales & Production Planner', pageWidth / 2, 60, { align: 'center' });
  
  doc.setFontSize(16);
  doc.setFont('helvetica', 'normal');
  doc.text('Dokumentatsiya sistemy', pageWidth / 2, 75, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text('ABC/XYZ Analiz, Dashboard, Planirovanie & Yunit-ekonomika', pageWidth / 2, 90, { align: 'center' });
  
  doc.setFontSize(10);
  doc.text(`Sgenerirovano: ${format(new Date(), 'dd.MM.yyyy HH:mm')}`, pageWidth / 2, 110, { align: 'center' });

  // Table of contents
  doc.addPage();
  currentY = margin;
  
  doc.setFontSize(18);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'bold');
  doc.text('Soderzhanie', margin, currentY);
  currentY += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  documentationContent.forEach((section) => {
    doc.text(`${section.title}`, margin, currentY);
    currentY += 6;
    if (currentY > pageHeight - 20) {
      doc.addPage();
      currentY = margin;
    }
  });

  // Content pages
  documentationContent.forEach((section) => {
    doc.addPage();
    currentY = margin;

    // Section title
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0);
    const titleLines = doc.splitTextToSize(section.title, contentWidth);
    doc.text(titleLines, margin, currentY);
    currentY += titleLines.length * 7 + 5;

    // Section content
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(50);

    section.content.forEach((line) => {
      // Check if we need a new page
      if (currentY > pageHeight - 20) {
        doc.addPage();
        currentY = margin;
      }

      const textLines = doc.splitTextToSize(line, contentWidth);
      doc.text(textLines, margin, currentY);
      currentY += textLines.length * 5 + 2;
    });
  });

  // Footer with page numbers
  const pageCount = doc.getNumberOfPages();
  for (let i = 2; i <= pageCount; i++) { // Skip title page
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(
      `Stranitsa ${i - 1} iz ${pageCount - 1}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      'Sales & Production Planner - Dokumentatsiya',
      margin,
      pageHeight - 10
    );
  }

  // Download
  const filename = `dokumentatsiya_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
  doc.save(filename);
}
