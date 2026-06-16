/**
 * Seed 5 published bilingual "fun" quizzes into the Play › Quizzes section
 * (FR-QUIZ-01). Idempotent: upserts by slug, safe to re-run. Editable afterwards
 * in Admin → Quizzes.
 *
 * Run on the server:  DATABASE_URL=... npx tsx scripts/seed-quizzes.mts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Q = { q: string; qAr: string; options: string[]; optionsAr: string[] };
type Quiz = { slug: string; titleEn: string; titleAr: string; questions: Q[] };

const quizzes: Quiz[] = [
  {
    slug: 'find-your-vitamin',
    titleEn: 'Find your vitamin',
    titleAr: 'اكتشف الفيتامين المناسب لك',
    questions: [
      { q: 'What bothers you most lately?', qAr: 'ما الذي يزعجك أكثر مؤخرًا؟', options: ['Low energy', 'Poor sleep', 'Hair & skin', 'Frequent colds'], optionsAr: ['قلة الطاقة', 'سوء النوم', 'الشعر والبشرة', 'نزلات البرد المتكررة'] },
      { q: 'How much sun do you get daily?', qAr: 'كم من الشمس تحصل عليها يوميًا؟', options: ['Almost none', 'A little', 'Plenty'], optionsAr: ['لا شيء تقريبًا', 'قليل', 'كثير'] },
      { q: 'How is your diet?', qAr: 'كيف هو نظامك الغذائي؟', options: ['Lots of veggies', 'Mostly meat', 'Fast food often'], optionsAr: ['الكثير من الخضار', 'لحوم غالبًا', 'وجبات سريعة كثيرًا'] },
      { q: 'Your main goal?', qAr: 'هدفك الأساسي؟', options: ['More energy', 'Better immunity', 'Beauty & glow'], optionsAr: ['طاقة أكثر', 'مناعة أفضل', 'جمال وإشراق'] },
    ],
  },
  {
    slug: 'omega-3-know-how',
    titleEn: 'Omega-3 know-how',
    titleAr: 'معلومات عن أوميغا-3',
    questions: [
      { q: 'Omega-3 is best known for supporting…', qAr: 'يشتهر أوميغا-3 بدعم…', options: ['Heart & brain', 'Bones', 'Eyesight only'], optionsAr: ['القلب والدماغ', 'العظام', 'النظر فقط'] },
      { q: 'A great food source of omega-3 is…', qAr: 'من أفضل مصادر أوميغا-3 الغذائية…', options: ['Fatty fish', 'White rice', 'Soda'], optionsAr: ['الأسماك الدهنية', 'الأرز الأبيض', 'المشروبات الغازية'] },
      { q: 'How often do you eat fish?', qAr: 'كم مرة تأكل السمك؟', options: ['Weekly', 'Rarely', 'Never'], optionsAr: ['أسبوعيًا', 'نادرًا', 'أبدًا'] },
      { q: 'EPA and DHA are types of…', qAr: 'EPA و DHA نوعان من…', options: ['Omega-3 fatty acids', 'Vitamins', 'Minerals'], optionsAr: ['أحماض أوميغا-3 الدهنية', 'الفيتامينات', 'المعادن'] },
    ],
  },
  {
    slug: 'sleep-and-magnesium',
    titleEn: 'Sleep & magnesium',
    titleAr: 'النوم والماغنيسيوم',
    questions: [
      { q: 'How well do you sleep?', qAr: 'كيف تنام؟', options: ['Great', 'So-so', 'Poorly'], optionsAr: ['ممتاز', 'مقبول', 'سيء'] },
      { q: 'Magnesium may help with…', qAr: 'قد يساعد الماغنيسيوم في…', options: ['Relaxation & sleep', 'Hair color', 'Eyesight'], optionsAr: ['الاسترخاء والنوم', 'لون الشعر', 'النظر'] },
      { q: 'A magnesium-rich food is…', qAr: 'من الأطعمة الغنية بالماغنيسيوم…', options: ['Nuts & seeds', 'Candy', 'Chips'], optionsAr: ['المكسرات والبذور', 'الحلوى', 'رقائق البطاطس'] },
      { q: 'Best screen habit before bed?', qAr: 'أفضل عادة للشاشة قبل النوم؟', options: ['Dim & put away', 'Brighter', 'Scroll for hours'], optionsAr: ['خفّض الإضاءة وابتعد', 'زِد السطوع', 'تصفّح لساعات'] },
    ],
  },
  {
    slug: 'protein-basics',
    titleEn: 'Protein basics',
    titleAr: 'أساسيات البروتين',
    questions: [
      { q: 'Protein mainly helps…', qAr: 'يساعد البروتين أساسًا في…', options: ['Muscle repair', 'Tanning', 'Hydration'], optionsAr: ['إصلاح العضلات', 'اسمرار البشرة', 'الترطيب'] },
      { q: 'Your activity level?', qAr: 'مستوى نشاطك؟', options: ['Very active', 'Moderate', 'Mostly resting'], optionsAr: ['نشيط جدًا', 'معتدل', 'قليل الحركة'] },
      { q: 'A good protein source is…', qAr: 'من مصادر البروتين الجيدة…', options: ['Eggs & legumes', 'Sugar', 'Butter'], optionsAr: ['البيض والبقوليات', 'السكر', 'الزبدة'] },
      { q: 'Best time for a protein shake?', qAr: 'أفضل وقت لمشروب البروتين؟', options: ['Around workouts', 'Midnight only', 'Never'], optionsAr: ['حول التمرين', 'منتصف الليل فقط', 'أبدًا'] },
    ],
  },
  {
    slug: 'daily-immunity',
    titleEn: 'Daily immunity',
    titleAr: 'مناعة كل يوم',
    questions: [
      { q: 'Which nutrient is famous for immunity?', qAr: 'أي عنصر يشتهر بدعم المناعة؟', options: ['Vitamin C', 'Vitamin K', 'None'], optionsAr: ['فيتامين C', 'فيتامين K', 'لا شيء'] },
      { q: 'Zinc can support…', qAr: 'يدعم الزنك…', options: ['Immune defense', 'Hair length', 'Height'], optionsAr: ['دفاع المناعة', 'طول الشعر', 'الطول'] },
      { q: 'Best daily habit for immunity?', qAr: 'أفضل عادة يومية للمناعة؟', options: ['Sleep & hydration', 'Skipping meals', 'Less water'], optionsAr: ['النوم والترطيب', 'تخطّي الوجبات', 'ماء أقل'] },
      { q: 'How often do you get sick?', qAr: 'كم مرة تمرض؟', options: ['Rarely', 'Sometimes', 'Often'], optionsAr: ['نادرًا', 'أحيانًا', 'كثيرًا'] },
    ],
  },
];

async function main() {
  for (const quiz of quizzes) {
    await prisma.quiz.upsert({
      where: { slug: quiz.slug },
      update: { titleEn: quiz.titleEn, titleAr: quiz.titleAr, kind: 'FUN', questionsJson: quiz.questions, published: true },
      create: { slug: quiz.slug, titleEn: quiz.titleEn, titleAr: quiz.titleAr, kind: 'FUN', questionsJson: quiz.questions, published: true },
    });
  }
  console.log(`Seeded ${quizzes.length} published quizzes.`);
}

main().finally(() => prisma.$disconnect());
