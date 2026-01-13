import jsPDF from 'jspdf';
import { format } from 'date-fns';

interface DocSection {
  title: string;
  content: string[];
}

const documentationContent: DocSection[] = [
  {
    title: "1. OBZOR - Chto delaet sistema",
    content: [
      "Sistema analiziruet eksport prodazh iz 1S za neskolko mesyatsev i generiruet:",
      "- ABC Analiz: Klassifikatsiya tovarov po vkladu v vyruchku (A=80%, B=15%, C=5%)",
      "- XYZ Analiz: Klassifikatsiya po stabilnosti sprosa s nastraivaemymi porogami",
      "- Plan proizvodstva: Raschet na 1, 3 i 6 mesyatsev s uchetom globalnogo trenda",
      "- Rekomendatsii: Avtomaticheskie rekomendatsii po upravleniyu zapasami",
      "- Analiz assortimenta: Vyyavlenie pribylnyh, ubytochnyh i zalezhavshihsya tovarov",
      "- Kill-list: Upravlenie vyvodom tovarov s avto-lestnicey tsen",
      "- Yunit-ekonomika: Raschet sebestoimosti, marzhi, pribyli i stsenariev WB",
      "- Istoriya izmeneniy: Otslezhivanie vsekh izmeneniy v kartochkakh tovarov",
      "- Prognozirovanie: Lineynaya regressiya, eksponentsialnoe sglazhivanie, skolzyashchaya srednyaya",
      "- Multi-select i bulk actions: Massovye operatsii nad artikulami",
      "- Sortirovka tablits: Klik po kolonke dlya sortirovki dannykh"
    ]
  },
  {
    title: "2. KAK POLZOVATSYA",
    content: [
      "Shag 1: Nastroyka parametrov - kurs valyuty, natsenki, porogi XYZ, globalnyy trend",
      "Shag 2: Zagruzka fayla - eksportiruyte otchet iz 1S v Excel i zagruzite v sistemu",
      "Shag 3: Ozhidanie obrabotki - sistema avtomaticheski raspoznaet strukturu i obrabatyvaet dannye",
      "Shag 4: Zapolnenie sebestoimosti - pereydite v razdel 'Yunit-ekonomika' i dobavte dannye",
      "Shag 5: Skachivanie rezultatov - poluchite gotovye otchety s analizom i ekonomikoy"
    ]
  },
  {
    title: "3. FORMAT FAYLA IZ 1S",
    content: [
      "Trebovaniya k strukture fayla:",
      "- Shapka s 3 strokami (daty, metriki, tekhnicheskie polya)",
      "- Periody v formate 'Dekabr 2024' ili 'DD.MM.GGGG'",
      "- Dlya kazhdogo perioda 3 stolbtsa: Kolichestvo, Summa, Ostatok",
      "- Stolbets s artikulom ('Nomenklatura.Artikul' ili podobnyy)",
      "- Optsionalno: stolbets s kategoriyey",
      "",
      "Primechanie: Stolbtsy 'Itogo' avtomaticheski propuskayutsya. Razmer fayla: do 50 MB, 100 000+ strok."
    ]
  },
  {
    title: "4. ABC ANALIZ",
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
    title: "5. XYZ ANALIZ",
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
    title: "6. MATRITSA REKOMENDATSIY ABC-XYZ",
    content: [
      "       |    X           |    Y              |    Z",
      "-------|----------------|-------------------|------------------",
      "   A   | Maks kontrol   | Regulyar popolnen | Analizirovat",
      "   B   | Regulyar zakaz | Strakhovoy zapas  | Sokratit zapas",
      "   C   | Min zakazy     | Sokratit assort   | Prekratit"
    ]
  },
  {
    title: "7. RASCHET PLANA PROIZVODSTVA",
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
    title: "8. METODY PROGNOZIROVANIYA",
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
    title: "9. YUNIT-EKONOMIKA",
    content: [
      "Struktura sebestoimosti:",
      "- Zatratyi na tkan (do 3 tipov): Tsena USD * Kurs * kg na edinitsu",
      "- Proizvodstvo: poshiv + kroy + furnitura + pechat/vyshivka",
      "- Nakladnye: admin nakladnye % ot proizvodstvennykh zatrat",
      "",
      "Tsenoobrazovanie:",
      "- Opt = Sebestoimost * (1 + natsenka%)",
      "- Roznitsa = Opt * (1 + roznichnaya natsenka%)",
      "",
      "Raschety WB:",
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
    title: "10. VARIANTY EKSPORTA",
    content: [
      "Dostupnye eksporty:",
      "- Otchet ABC/XYZ analitiki (Excel) - Polnyy analiz so vsemi metrikami",
      "- Plan proizvodstva (Excel) - Prioritetnyy plan proizvodstva",
      "- Otchet analitiki (PDF) - Pechatnyy otchet s tsvetovoy kodirovkoy",
      "- Plan proizvodstva (PDF) - Pechatnyy plan proizvodstva",
      "- Shablon yunit-ekonomiki (Excel) - Pustoy shablon ili s artikulami",
      "- Eksport yunit-ekonomiki (Excel) - Polnye dannye po sebestoimosti",
      "",
      "Dostupnye filtry:",
      "- Po periodu (vybor konkretnyh mesyatsev)",
      "- Po kategorii (kategorii tovarov)",
      "- Po gruppam ABC/XYZ",
      "- Po gruppam tovarov",
      "- Po konkretnym artikulam",
      "- Po nalichyu na sklade",
      "",
      "Sortirovka v tablitsakh:",
      "- Nazhmite na zagolovok kolonki dlya sortirovki",
      "- Pervyy klik: po vozrastaniyu (A-Ya, 0-9)",
      "- Vtoroy klik: po ubyvaniyu (Ya-A, 9-0)",
      "- Tretiy klik: sbros sortirovki"
    ]
  },
  {
    title: "11. NASTROYKI",
    content: [
      "Globalnye nastroyki:",
      "- Kurs valyuty: Kurs USD k RUB",
      "- Admin nakladnye %: Protsent nakladnykh ot proizvodstvennykh zatrat",
      "- Optovaya natsenka %: Natsenka dlya optovoy tseny",
      "- Rezhim nalogov: USN (uproshenka) ili NDS",
      "- USN Nalog %: Stavka uproshenki (po umolchaniyu 7%)",
      "- NDS %: Stavka NDS (esli primenyaetsya)",
      "",
      "Porogi XYZ:",
      "- Porog X: Maksimalnyy CV dlya stabilnogo sprosa (po umolchaniyu 30%)",
      "- Porog Y: Maksimalnyy CV dlya umerennogo sprosa (po umolchaniyu 60%)",
      "",
      "Parametry logistiki WB po umolchaniyu:",
      "- Logistika k klientu (po umolchaniyu 50 RUB)",
      "- Logistika vozvrata (po umolchaniyu 50 RUB)",
      "- Stoimost priemki (po umolchaniyu 50 RUB)",
      "- Protsent vykupa (po umolchaniyu 90%)",
      "",
      "Globalnyy trend:",
      "- Ruchnoy rezhim: Ustanovit fiksirovannyy koeffitsient",
      "- Avto rezhim: Raschitat iz istoricheskikh dannykh"
    ]
  },
  {
    title: "12. KONTROL KACHESTVA DANNYKH",
    content: [
      "Metriki otobrazhaemye posle obrabotki:",
      "- Syrye stroki: Vsego zapisey v baze (artikul x razmer x period)",
      "- Unikalnyye artikuly: Kolichestvo bez razmerov",
      "- Kombinatsii artikul+razmer: Unikalnyye pary",
      "- Koeffitsient szhatiya: Pokazyvaet effektivnost agregatsii dannykh",
      "",
      "Proverki kachestva:",
      "- Validatsiya periodov (net budushchikh dat)",
      "- Validatsiya chislovykh dannykh",
      "- Proverka formata artikulov"
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
  doc.text('ABC/XYZ Analiz, Planirovanie proizvodstva & Yunit-ekonomika', pageWidth / 2, 90, { align: 'center' });
  
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

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  
  documentationContent.forEach((section) => {
    doc.text(`${section.title}`, margin, currentY);
    currentY += 7;
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
