/**
 * Seed 5 published bilingual "fun" quizzes into Play › Quizzes (FR-QUIZ-01).
 * Each quiz has exactly 10 questions and each question has 4 choices.
 * Idempotent: upserts by slug, safe to re-run. Editable in Admin → Quizzes.
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

const o = (a: string, b: string, c: string, d: string) => [a, b, c, d];

const quizzes: Quiz[] = [
  {
    slug: 'find-your-vitamin',
    titleEn: 'Find your vitamin',
    titleAr: 'اكتشف الفيتامين المناسب لك',
    questions: [
      { q: 'What bothers you most lately?', qAr: 'ما الذي يزعجك أكثر مؤخرًا؟', options: o('Low energy', 'Poor sleep', 'Hair & skin', 'Frequent colds'), optionsAr: o('قلة الطاقة', 'سوء النوم', 'الشعر والبشرة', 'نزلات البرد المتكررة') },
      { q: 'How much sunlight do you get daily?', qAr: 'كم من ضوء الشمس تحصل عليه يوميًا؟', options: o('Almost none', 'A little', 'A moderate amount', 'Plenty'), optionsAr: o('لا شيء تقريبًا', 'قليل', 'متوسط', 'كثير') },
      { q: 'How would you describe your diet?', qAr: 'كيف تصف نظامك الغذائي؟', options: o('Lots of veggies', 'Mostly meat', 'Fast food often', 'Pretty balanced'), optionsAr: o('الكثير من الخضار', 'لحوم غالبًا', 'وجبات سريعة كثيرًا', 'متوازن نوعًا ما') },
      { q: 'Your main goal right now?', qAr: 'هدفك الأساسي الآن؟', options: o('More energy', 'Better immunity', 'Beauty & glow', 'General wellness'), optionsAr: o('طاقة أكثر', 'مناعة أفضل', 'جمال وإشراق', 'صحة عامة') },
      { q: 'How active are you weekly?', qAr: 'ما مدى نشاطك أسبوعيًا؟', options: o('Very active', 'Moderately', 'Lightly', 'Rarely'), optionsAr: o('نشيط جدًا', 'معتدل', 'خفيف', 'نادرًا') },
      { q: 'How is your stress level?', qAr: 'كيف هو مستوى التوتر لديك؟', options: o('Low', 'Manageable', 'High', 'Very high'), optionsAr: o('منخفض', 'محتمل', 'مرتفع', 'مرتفع جدًا') },
      { q: 'Do you drink enough water?', qAr: 'هل تشرب ماءً كافيًا؟', options: o('Always', 'Usually', 'Sometimes', 'Rarely'), optionsAr: o('دائمًا', 'غالبًا', 'أحيانًا', 'نادرًا') },
      { q: 'How often do you eat fish?', qAr: 'كم مرة تأكل السمك؟', options: o('Several times a week', 'Weekly', 'Monthly', 'Rarely'), optionsAr: o('عدة مرات أسبوعيًا', 'أسبوعيًا', 'شهريًا', 'نادرًا') },
      { q: 'Your age range?', qAr: 'الفئة العمرية؟', options: o('Under 25', '25–40', '40–55', 'Over 55'), optionsAr: o('أقل من 25', '25–40', '40–55', 'أكثر من 55') },
      { q: 'Preferred supplement form?', qAr: 'الشكل المفضل للمكمل؟', options: o('Capsules', 'Tablets', 'Gummies', 'Powder/liquid'), optionsAr: o('كبسولات', 'أقراص', 'حلوى', 'بودرة/سائل') },
    ],
  },
  {
    slug: 'omega-3-know-how',
    titleEn: 'Omega-3 know-how',
    titleAr: 'معلومات عن أوميغا-3',
    questions: [
      { q: 'Omega-3 is best known for supporting…', qAr: 'يشتهر أوميغا-3 بدعم…', options: o('Heart & brain', 'Bones', 'Eyesight only', 'Teeth'), optionsAr: o('القلب والدماغ', 'العظام', 'النظر فقط', 'الأسنان') },
      { q: 'A great food source of omega-3 is…', qAr: 'من أفضل مصادر أوميغا-3 الغذائية…', options: o('Fatty fish', 'White rice', 'Soda', 'White bread'), optionsAr: o('الأسماك الدهنية', 'الأرز الأبيض', 'المشروبات الغازية', 'الخبز الأبيض') },
      { q: 'EPA and DHA are types of…', qAr: 'EPA و DHA نوعان من…', options: o('Omega-3 fatty acids', 'Vitamins', 'Minerals', 'Proteins'), optionsAr: o('أحماض أوميغا-3 الدهنية', 'الفيتامينات', 'المعادن', 'البروتينات') },
      { q: 'A plant source of omega-3 is…', qAr: 'من مصادر أوميغا-3 النباتية…', options: o('Flaxseed', 'Potato', 'Lettuce', 'Cucumber'), optionsAr: o('بذور الكتان', 'البطاطس', 'الخس', 'الخيار') },
      { q: 'How often do you eat fish?', qAr: 'كم مرة تأكل السمك؟', options: o('Several times a week', 'Weekly', 'Monthly', 'Rarely'), optionsAr: o('عدة مرات أسبوعيًا', 'أسبوعيًا', 'شهريًا', 'نادرًا') },
      { q: 'Fish oil is usually taken…', qAr: 'عادةً يؤخذ زيت السمك…', options: o('With a meal', 'On an empty stomach', 'Only at night', 'Never with food'), optionsAr: o('مع وجبة', 'على معدة فارغة', 'ليلًا فقط', 'أبدًا مع الطعام') },
      { q: 'Omega-3 may support skin by…', qAr: 'قد يدعم أوميغا-3 البشرة عبر…', options: o('Helping hydration', 'Adding color', 'Removing freckles', 'Growing nails'), optionsAr: o('المساعدة على الترطيب', 'إضافة لون', 'إزالة النمش', 'إطالة الأظافر') },
      { q: 'Which oil is richest in omega-3?', qAr: 'أي زيت أغنى بأوميغا-3؟', options: o('Fish oil', 'Palm oil', 'Corn oil', 'Butter'), optionsAr: o('زيت السمك', 'زيت النخيل', 'زيت الذرة', 'الزبدة') },
      { q: 'Omega-3 is a type of…', qAr: 'أوميغا-3 نوع من…', options: o('Healthy fat', 'Sugar', 'Salt', 'Fiber'), optionsAr: o('دهون صحية', 'سكر', 'ملح', 'ألياف') },
      { q: 'Best way to store fish-oil capsules?', qAr: 'أفضل طريقة لحفظ كبسولات زيت السمك؟', options: o('Cool, dry place', 'In sunlight', 'Near the stove', 'In water'), optionsAr: o('مكان بارد وجاف', 'في الشمس', 'قرب الموقد', 'في الماء') },
    ],
  },
  {
    slug: 'sleep-and-magnesium',
    titleEn: 'Sleep & magnesium',
    titleAr: 'النوم والماغنيسيوم',
    questions: [
      { q: 'How well do you sleep most nights?', qAr: 'كيف تنام في معظم الليالي؟', options: o('Great', 'Okay', 'Restless', 'Poorly'), optionsAr: o('ممتاز', 'جيد', 'متقطع', 'سيء') },
      { q: 'Magnesium may help with…', qAr: 'قد يساعد الماغنيسيوم في…', options: o('Relaxation & sleep', 'Hair color', 'Eyesight', 'Tanning'), optionsAr: o('الاسترخاء والنوم', 'لون الشعر', 'النظر', 'اسمرار البشرة') },
      { q: 'A magnesium-rich food is…', qAr: 'من الأطعمة الغنية بالماغنيسيوم…', options: o('Nuts & seeds', 'Candy', 'Chips', 'White sugar'), optionsAr: o('المكسرات والبذور', 'الحلوى', 'رقائق البطاطس', 'السكر الأبيض') },
      { q: 'Best screen habit before bed?', qAr: 'أفضل عادة للشاشة قبل النوم؟', options: o('Dim & put away', 'Brighter screen', 'Scroll for hours', 'Watch action movies'), optionsAr: o('خفّض الإضاءة وابتعد', 'زِد سطوع الشاشة', 'تصفّح لساعات', 'شاهد أفلام إثارة') },
      { q: 'A good wind-down drink is…', qAr: 'من المشروبات المهدّئة قبل النوم…', options: o('Herbal tea', 'Strong coffee', 'Energy drink', 'Cola'), optionsAr: o('شاي أعشاب', 'قهوة قوية', 'مشروب طاقة', 'كولا') },
      { q: 'Magnesium is a…', qAr: 'الماغنيسيوم هو…', options: o('Mineral', 'Vitamin', 'Protein', 'Sugar'), optionsAr: o('معدن', 'فيتامين', 'بروتين', 'سكر') },
      { q: 'A steady sleep schedule means…', qAr: 'جدول نوم منتظم يعني…', options: o('Same times daily', 'Random times', 'No naps ever', 'Sleeping at noon'), optionsAr: o('مواعيد ثابتة يوميًا', 'مواعيد عشوائية', 'بلا قيلولة أبدًا', 'النوم ظهرًا') },
      { q: 'Caffeine late in the day can…', qAr: 'الكافيين متأخرًا قد…', options: o('Disturb sleep', 'Improve sleep', 'Do nothing', 'Cause hunger only'), optionsAr: o('يزعج النوم', 'يحسّن النوم', 'لا يفعل شيئًا', 'يسبب الجوع فقط') },
      { q: 'A relaxing bedroom is usually…', qAr: 'غرفة النوم المريحة عادةً…', options: o('Dark & cool', 'Bright & warm', 'Noisy', 'Cluttered'), optionsAr: o('مظلمة وباردة', 'مضيئة ودافئة', 'صاخبة', 'مزدحمة') },
      { q: 'How many hours do you usually sleep?', qAr: 'كم ساعة تنام عادة؟', options: o('7–9', '5–6', 'Under 5', 'Over 9'), optionsAr: o('7–9', '5–6', 'أقل من 5', 'أكثر من 9') },
    ],
  },
  {
    slug: 'protein-basics',
    titleEn: 'Protein basics',
    titleAr: 'أساسيات البروتين',
    questions: [
      { q: 'Protein mainly helps…', qAr: 'يساعد البروتين أساسًا في…', options: o('Muscle repair', 'Tanning', 'Hydration', 'Eyesight'), optionsAr: o('إصلاح العضلات', 'اسمرار البشرة', 'الترطيب', 'النظر') },
      { q: 'Your activity level?', qAr: 'مستوى نشاطك؟', options: o('Very active', 'Moderate', 'Light', 'Mostly resting'), optionsAr: o('نشيط جدًا', 'معتدل', 'خفيف', 'قليل الحركة') },
      { q: 'A good protein source is…', qAr: 'من مصادر البروتين الجيدة…', options: o('Eggs & legumes', 'Sugar', 'Butter', 'White rice'), optionsAr: o('البيض والبقوليات', 'السكر', 'الزبدة', 'الأرز الأبيض') },
      { q: 'Best time for a protein shake?', qAr: 'أفضل وقت لمشروب البروتين؟', options: o('Around workouts', 'Midnight only', 'Never', 'During sleep'), optionsAr: o('حول التمرين', 'منتصف الليل فقط', 'أبدًا', 'أثناء النوم') },
      { q: 'Whey protein comes from…', qAr: 'بروتين الواي مصدره…', options: o('Milk', 'Rice', 'Soy only', 'Corn'), optionsAr: o('الحليب', 'الأرز', 'الصويا فقط', 'الذرة') },
      { q: 'A plant protein source is…', qAr: 'من مصادر البروتين النباتي…', options: o('Lentils', 'Olive oil', 'Lettuce', 'Apple'), optionsAr: o('العدس', 'زيت الزيتون', 'الخس', 'التفاح') },
      { q: 'Protein is made of…', qAr: 'يتكوّن البروتين من…', options: o('Amino acids', 'Sugars', 'Fats only', 'Water only'), optionsAr: o('أحماض أمينية', 'سكريات', 'دهون فقط', 'ماء فقط') },
      { q: 'Your goal with protein?', qAr: 'هدفك من البروتين؟', options: o('Build muscle', 'Recover faster', 'Feel full', 'All of these'), optionsAr: o('بناء العضلات', 'تعافٍ أسرع', 'الشعور بالشبع', 'كل ما سبق') },
      { q: 'How often do you train?', qAr: 'كم مرة تتمرن؟', options: o('4+ a week', '2–3 a week', 'Once a week', 'Rarely'), optionsAr: o('4+ أسبوعيًا', '2–3 أسبوعيًا', 'مرة أسبوعيًا', 'نادرًا') },
      { q: 'Best with a protein shake?', qAr: 'الأفضل مع مشروب البروتين؟', options: o('Water or milk', 'Soda', 'Energy drink', 'Coffee syrup'), optionsAr: o('ماء أو حليب', 'مشروب غازي', 'مشروب طاقة', 'شراب القهوة') },
    ],
  },
  {
    slug: 'daily-immunity',
    titleEn: 'Daily immunity',
    titleAr: 'مناعة كل يوم',
    questions: [
      { q: 'Which nutrient is famous for immunity?', qAr: 'أي عنصر يشتهر بدعم المناعة؟', options: o('Vitamin C', 'Vitamin K', 'Sodium', 'Nothing'), optionsAr: o('فيتامين C', 'فيتامين K', 'الصوديوم', 'لا شيء') },
      { q: 'Zinc can support…', qAr: 'يدعم الزنك…', options: o('Immune defense', 'Hair length', 'Height', 'Eye color'), optionsAr: o('دفاع المناعة', 'طول الشعر', 'الطول', 'لون العين') },
      { q: 'Best daily habit for immunity?', qAr: 'أفضل عادة يومية للمناعة؟', options: o('Sleep & hydration', 'Skipping meals', 'Less water', 'More stress'), optionsAr: o('النوم والترطيب', 'تخطّي الوجبات', 'ماء أقل', 'توتر أكثر') },
      { q: 'A vitamin-C-rich food is…', qAr: 'من الأطعمة الغنية بفيتامين C…', options: o('Citrus fruit', 'White bread', 'Butter', 'Chips'), optionsAr: o('الحمضيات', 'الخبز الأبيض', 'الزبدة', 'رقائق البطاطس') },
      { q: 'Vitamin D mostly comes from…', qAr: 'يأتي فيتامين D غالبًا من…', options: o('Sunlight', 'TV light', 'Cold air', 'Loud music'), optionsAr: o('ضوء الشمس', 'ضوء التلفاز', 'الهواء البارد', 'الموسيقى الصاخبة') },
      { q: 'How often do you get sick?', qAr: 'كم مرة تمرض؟', options: o('Rarely', 'Sometimes', 'Often', 'Very often'), optionsAr: o('نادرًا', 'أحيانًا', 'كثيرًا', 'كثيرًا جدًا') },
      { q: 'Good for gut & immunity?', qAr: 'مفيد للأمعاء والمناعة؟', options: o('Probiotics', 'Candy', 'Fried food', 'Soda'), optionsAr: o('البروبيوتيك', 'الحلوى', 'المقليات', 'المشروبات الغازية') },
      { q: 'Exercise and immunity?', qAr: 'الرياضة والمناعة؟', options: o('Moderate helps', 'Always harmful', 'No effect', 'Only at night'), optionsAr: o('المعتدلة تساعد', 'ضارة دائمًا', 'بلا تأثير', 'ليلًا فقط') },
      { q: 'How much sleep supports immunity?', qAr: 'كم من النوم يدعم المناعة؟', options: o('7–9 hours', '3–4 hours', 'No sleep', '12+ hours'), optionsAr: o('7–9 ساعات', '3–4 ساعات', 'بلا نوم', '12+ ساعة') },
      { q: 'Best drink for hydration?', qAr: 'أفضل مشروب للترطيب؟', options: o('Water', 'Energy drink', 'Cola', 'Strong coffee'), optionsAr: o('الماء', 'مشروب طاقة', 'كولا', 'قهوة قوية') },
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
  console.log(`Seeded ${quizzes.length} quizzes (10 questions × 4 choices each).`);
}

main().finally(() => prisma.$disconnect());
