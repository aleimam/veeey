import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

/**
 * Seed the 27 governorates' main sub-areas EN·AR (V4 E28, owner-provided list).
 * UltraFast eligibility = true ONLY for Greater Cairo + Giza sub-areas, false
 * everywhere else (E24). Idempotent:
 *   - zone matched by governorate (case-insensitive) or created (granularity AREA)
 *   - zone nameAr backfilled when empty
 *   - area matched by EN name within its zone; created with nameAr, or updated
 *     (nameAr backfilled when empty; allowsUltraFast set per zone eligibility)
 *   - allowsPos and ETA fields are never touched on existing areas
 * DRY RUN by default — pass --apply to write.
 *
 *   npx tsx scripts/seed-shipping-areas.ts [--apply]
 */

type Gov = { en: string; ar: string; ultraFast?: boolean; areas: [en: string, ar: string][] };

const GOVS: Gov[] = [
  { en: 'Greater Cairo', ar: 'القاهرة الكبرى', ultraFast: true, areas: [
    ['Nasr City', 'مدينة نصر'], ['Heliopolis', 'مصر الجديدة'], ['Maadi', 'المعادي'], ['New Cairo', 'القاهرة الجديدة'],
    ['Shubra', 'شبرا'], ['Downtown', 'وسط البلد'], ['Zamalek', 'الزمالك'], ['Mokattam', 'المقطم'],
    ['El Marg', 'المرج'], ['Helwan', 'حلوان'], ['El Salam', 'السلام'], ['Ain Shams', 'عين شمس'],
  ]},
  { en: 'Giza', ar: 'الجيزة', ultraFast: true, areas: [
    ['Dokki', 'الدقي'], ['Mohandessin', 'المهندسين'], ['Agouza', 'العجوزة'], ['Haram', 'الهرم'], ['Faisal', 'فيصل'],
    ['6th of October', 'مدينة السادس من أكتوبر'], ['Sheikh Zayed', 'الشيخ زايد'], ['Imbaba', 'إمبابة'],
    ['Bulaq El Dakrour', 'بولاق الدكرور'], ['Badrashein', 'البدرشين'],
  ]},
  { en: 'Alexandria', ar: 'الإسكندرية', areas: [
    ['Montazah', 'المنتزه'], ['Sidi Gaber', 'سيدي جابر'], ['Sporting', 'سبورتنج'], ['Smouha', 'سموحة'],
    ['Miami', 'ميامي'], ['Agami', 'العجمي'], ['Borg El Arab', 'برج العرب'], ['Amreya', 'العامرية'], ['Mansheya', 'المنشية'],
  ]},
  { en: 'Qalyubia', ar: 'القليوبية', areas: [
    ['Banha', 'بنها'], ['Qalyub', 'قليوب'], ['Shubra El Kheima', 'شبرا الخيمة'], ['Qaha', 'قها'],
    ['Khanka', 'الخانكة'], ['Obour', 'العبور'], ['Khosous', 'الخصوص'], ['Toukh', 'طوخ'],
  ]},
  { en: 'Port Said', ar: 'بورسعيد', areas: [
    ['El Arab', 'العرب'], ['El Manakh', 'المناخ'], ['El Dawahi', 'الضواحي'], ['El Zohour', 'الزهور'],
    ['El Sharq', 'الشرق'], ['Port Fouad', 'بورفؤاد'],
  ]},
  { en: 'Suez', ar: 'السويس', areas: [
    ['Suez', 'السويس'], ['Arbaeen', 'الأربعين'], ['Ataka', 'عتاقة'], ['Ganayen', 'الجناين'], ['Faisal', 'فيصل'],
  ]},
  { en: 'Ismailia', ar: 'الإسماعيلية', areas: [
    ['Ismailia City', 'الإسماعيلية'], ['Fayed', 'فايد'], ['Qantara Sharq', 'القنطرة شرق'], ['Qantara Gharb', 'القنطرة غرب'],
    ['Tell El Kebir', 'التل الكبير'], ['Abu Suwair', 'أبو صوير'],
  ]},
  { en: 'Dakahlia', ar: 'الدقهلية', areas: [
    ['Mansoura', 'المنصورة'], ['Talkha', 'طلخا'], ['Mit Ghamr', 'ميت غمر'], ['Dekernes', 'دكرنس'],
    ['Aga', 'أجا'], ['Belqas', 'بلقاس'], ['Sherbin', 'شربين'], ['Manzala', 'المنزلة'],
  ]},
  { en: 'Sharqia', ar: 'الشرقية', areas: [
    ['Zagazig', 'الزقازيق'], ['10th of Ramadan', 'العاشر من رمضان'], ['Belbeis', 'بلبيس'], ['Abu Hammad', 'أبو حماد'],
    ['Faqous', 'فاقوس'], ['Minya El Qamh', 'منيا القمح'], ['Hehia', 'ههيا'], ['Kafr Saqr', 'كفر صقر'],
  ]},
  { en: 'Gharbia', ar: 'الغربية', areas: [
    ['Tanta', 'طنطا'], ['El Mahalla El Kubra', 'المحلة الكبرى'], ['Kafr El Zayat', 'كفر الزيات'], ['Zefta', 'زفتى'],
    ['Samannoud', 'سمنود'], ['Basyoun', 'بسيون'], ['Qutur', 'قطور'],
  ]},
  { en: 'Monufia', ar: 'المنوفية', areas: [
    ['Shibin El Kom', 'شبين الكوم'], ['Menouf', 'منوف'], ['Ashmoun', 'أشمون'], ['Sadat City', 'مدينة السادات'],
    ['Quesna', 'قويسنا'], ['Berket El Sabaa', 'بركة السبع'], ['Tala', 'تلا'],
  ]},
  { en: 'Beheira', ar: 'البحيرة', areas: [
    ['Damanhour', 'دمنهور'], ['Kafr El Dawwar', 'كفر الدوار'], ['Rashid', 'رشيد'], ['Edku', 'إدكو'],
    ['Abu Hummus', 'أبو حمص'], ['Kom Hamada', 'كوم حمادة'], ['Itay El Barud', 'إيتاي البارود'],
  ]},
  { en: 'Kafr El Sheikh', ar: 'كفر الشيخ', areas: [
    ['Kafr El Sheikh City', 'كفر الشيخ'], ['Desouk', 'دسوق'], ['Fuwwah', 'فوه'], ['Baltim', 'بلطيم'],
    ['Sidi Salem', 'سيدي سالم'], ['Metoubes', 'مطوبس'], ['Qallin', 'قلين'],
  ]},
  { en: 'Damietta', ar: 'دمياط', areas: [
    ['Damietta City', 'دمياط'], ['New Damietta', 'دمياط الجديدة'], ['Ras El Bar', 'رأس البر'],
    ['Faraskur', 'فارسكور'], ['Kafr Saad', 'كفر سعد'], ['Zarqa', 'الزرقا'],
  ]},
  { en: 'Faiyum', ar: 'الفيوم', areas: [
    ['Faiyum City', 'الفيوم'], ['Sinnuris', 'سنورس'], ['Ibsheway', 'إبشواي'], ['Tamiya', 'طامية'],
    ['Etsa', 'إطسا'], ['Yousef El Seddik', 'يوسف الصديق'],
  ]},
  { en: 'Beni Suef', ar: 'بني سويف', areas: [
    ['Beni Suef City', 'بني سويف'], ['New Beni Suef', 'بني سويف الجديدة'], ['El Wasta', 'الواسطى'],
    ['Nasser', 'ناصر'], ['Ihnasia', 'إهناسيا'], ['Beba', 'ببا'], ['Sumusta', 'سمسطا'],
  ]},
  { en: 'Minya', ar: 'المنيا', areas: [
    ['Minya City', 'المنيا'], ['Mallawi', 'ملوي'], ['Beni Mazar', 'بني مزار'], ['Samalut', 'سمالوط'],
    ['Maghagha', 'مغاغة'], ['Matai', 'مطاي'], ['Deir Mawas', 'دير مواس'], ['Abu Qurqas', 'أبو قرقاص'],
  ]},
  { en: 'Asyut', ar: 'أسيوط', areas: [
    ['Asyut City', 'أسيوط'], ['New Asyut', 'أسيوط الجديدة'], ['Dairut', 'ديروط'], ['Manfalut', 'منفلوط'],
    ['Abnoub', 'أبنوب'], ['El Qusiya', 'القوصية'], ['Abu Tig', 'أبو تيج'], ['Sahel Selim', 'ساحل سليم'],
  ]},
  { en: 'Sohag', ar: 'سوهاج', areas: [
    ['Sohag City', 'سوهاج'], ['Akhmim', 'أخميم'], ['Girga', 'جرجا'], ['Tahta', 'طهطا'],
    ['El Balyana', 'البلينا'], ['Tema', 'طما'], ['Maragha', 'المراغة'], ['Dar El Salam', 'دار السلام'],
  ]},
  { en: 'Qena', ar: 'قنا', areas: [
    ['Qena City', 'قنا'], ['Nag Hammadi', 'نجع حمادي'], ['Qus', 'قوص'], ['Dishna', 'دشنا'],
    ['Farshut', 'فرشوط'], ['Naqada', 'نقادة'], ['Abu Tesht', 'أبو تشت'],
  ]},
  { en: 'Luxor', ar: 'الأقصر', areas: [
    ['Luxor City', 'الأقصر'], ['New Luxor', 'الأقصر الجديدة'], ['Esna', 'إسنا'], ['Armant', 'أرمنت'],
    ['El Bayadiya', 'البياضية'], ['El Zeiniya', 'الزينية'], ['El Toud', 'الطود'],
  ]},
  { en: 'Aswan', ar: 'أسوان', areas: [
    ['Aswan City', 'أسوان'], ['New Aswan', 'أسوان الجديدة'], ['Kom Ombo', 'كوم أمبو'], ['Edfu', 'إدفو'],
    ['Daraw', 'دراو'], ['Nasr El Nuba', 'نصر النوبة'], ['Kalabsha', 'كلابشة'],
  ]},
  { en: 'Red Sea', ar: 'البحر الأحمر', areas: [
    ['Hurghada', 'الغردقة'], ['Safaga', 'سفاجا'], ['El Gouna', 'الجونة'], ['Marsa Alam', 'مرسى علم'],
    ['Ras Gharib', 'رأس غارب'], ['El Quseir', 'القصير'], ['Shalateen', 'شلاتين'],
  ]},
  { en: 'New Valley', ar: 'الوادي الجديد', areas: [
    ['Kharga', 'الخارجة'], ['Dakhla', 'الداخلة'], ['Farafra', 'الفرافرة'], ['Balat', 'بلاط'], ['Paris (Baris)', 'باريس'],
  ]},
  { en: 'Matrouh', ar: 'مطروح', areas: [
    ['Marsa Matrouh', 'مرسى مطروح'], ['El Alamein', 'العلمين'], ['El Dabaa', 'الضبعة'], ['Sidi Barrani', 'سيدي براني'],
    ['Siwa', 'سيوة'], ['Sallum', 'السلوم'], ['El Hammam', 'الحمام'],
  ]},
  { en: 'North Sinai', ar: 'شمال سيناء', areas: [
    ['El Arish', 'العريش'], ['Sheikh Zuweid', 'الشيخ زويد'], ['Rafah', 'رفح'], ['Bir El Abd', 'بئر العبد'],
    ['El Hasana', 'الحسنة'], ['Nakhl', 'نخل'],
  ]},
  { en: 'South Sinai', ar: 'جنوب سيناء', areas: [
    ['Sharm El Sheikh', 'شرم الشيخ'], ['Dahab', 'دهب'], ['Nuweiba', 'نويبع'], ['El Tur', 'الطور'],
    ['Saint Catherine', 'سانت كاترين'], ['Taba', 'طابا'], ['Abu Rudeis', 'أبو رديس'],
  ]},
];

const APPLY = process.argv.includes('--apply');
const norm = (s: string) => s.toLowerCase().replace(/\s+/g, ' ').trim();

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  const zones = await prisma.shippingZone.findMany({ include: { areas: true } });
  let zonesCreated = 0, zonesUpdated = 0, areasCreated = 0, areasUpdated = 0;

  for (const gov of GOVS) {
    const ultra = !!gov.ultraFast;
    let zone = zones.find((z) => norm(z.governorate) === norm(gov.en) || norm(z.name) === norm(gov.en));
    if (!zone) {
      console.log(`+ zone  ${gov.en} (${gov.ar})${ultra ? ' [UltraFast]' : ''}`);
      zonesCreated += 1;
      if (APPLY) {
        zone = { ...(await prisma.shippingZone.create({ data: { name: gov.en, nameAr: gov.ar, governorate: gov.en, granularity: 'AREA' } })), areas: [] };
      }
    } else if (!zone.nameAr) {
      console.log(`~ zone  ${zone.name} → nameAr "${gov.ar}"`);
      zonesUpdated += 1;
      if (APPLY) await prisma.shippingZone.update({ where: { id: zone.id }, data: { nameAr: gov.ar } });
    }
    if (!zone) continue; // dry run for a missing zone — areas reported below

    for (const [en, ar] of gov.areas) {
      const existing = zone.areas.find((a) => norm(a.name) === norm(en));
      if (!existing) {
        console.log(`  + area  ${gov.en} / ${en} (${ar}) ultraFast=${ultra}`);
        areasCreated += 1;
        if (APPLY) await prisma.shippingArea.create({ data: { zoneId: zone.id, name: en, nameAr: ar, allowsUltraFast: ultra } });
      } else {
        const needsAr = !existing.nameAr;
        const needsUltra = existing.allowsUltraFast !== ultra;
        if (needsAr || needsUltra) {
          console.log(`  ~ area  ${gov.en} / ${en}${needsAr ? ` nameAr→"${ar}"` : ''}${needsUltra ? ` ultraFast→${ultra}` : ''}`);
          areasUpdated += 1;
          if (APPLY) {
            await prisma.shippingArea.update({
              where: { id: existing.id },
              data: { ...(needsAr ? { nameAr: ar } : {}), allowsUltraFast: ultra },
            });
          }
        }
      }
    }
  }

  // E24 hard rule: UltraFast=false everywhere OUTSIDE Greater Cairo + Giza.
  const ultraGovs = GOVS.filter((g) => g.ultraFast).map((g) => norm(g.en));
  const rogue = await prisma.shippingArea.findMany({
    where: { allowsUltraFast: true },
    include: { zone: { select: { governorate: true, name: true } } },
  });
  const toClear = rogue.filter((a) => !ultraGovs.includes(norm(a.zone.governorate)) && !ultraGovs.includes(norm(a.zone.name)));
  for (const a of toClear) {
    console.log(`  ! clear UltraFast on ${a.zone.name} / ${a.name}`);
    if (APPLY) await prisma.shippingArea.update({ where: { id: a.id }, data: { allowsUltraFast: false } });
  }

  console.log(`\n${APPLY ? 'APPLIED' : 'DRY RUN (pass --apply to write)'} — zones +${zonesCreated}/~${zonesUpdated}, areas +${areasCreated}/~${areasUpdated}, ultraFast cleared ${toClear.length}`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
