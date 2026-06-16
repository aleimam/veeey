/**
 * Seed standard static CMS pages + starter blog posts (FR-CONTENT). Idempotent:
 * upserts by slug, so it's safe to re-run. Content is editable afterwards in
 * Admin → CMS Pages / Blog. Legal pages (privacy/terms/compensation) are
 * STARTER DRAFTS — have them reviewed by a lawyer before relying on them.
 *
 * Run on the server:  DATABASE_URL=... npx tsx scripts/seed-content.mts
 */
import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

type Page = { slug: string; titleEn: string; titleAr: string; bodyEn: string; bodyAr: string; metaDescEn?: string };

const pages: Page[] = [
  {
    slug: 'about',
    titleEn: 'Our story',
    titleAr: 'قصتنا',
    metaDescEn: 'Veeey imports premium dietary supplements and health devices directly from the USA, UK and EU.',
    bodyEn:
      'Veeey was built on a simple promise: premium health, with nothing to hide.\n\nWe import dietary supplements and health devices directly from trusted manufacturers in the USA, UK and EU — and we show the expiry date of every product before you buy. No surprises, no repackaging, no shortcuts.\n\nBehind every order is a licensed pharmacist who checks that what you ordered is right for you. We deliver free across Egypt, with UltraFast 3–6 hour delivery in Greater Cairo, and we stand behind our promises in writing.\n\nHealth Inside.',
    bodyAr:
      'تأسست Veeey على وعد بسيط: صحة فاخرة، لا شيء نخفيه.\n\nنستورد المكمّلات الغذائية والأجهزة الصحية مباشرةً من مصنّعين موثوقين في الولايات المتحدة والمملكة المتحدة والاتحاد الأوروبي — ونعرض تاريخ صلاحية كل منتج قبل الشراء. بلا مفاجآت، وبلا إعادة تغليف، وبلا اختصارات.\n\nخلف كل طلب صيدلي مرخّص يتأكد أن ما طلبته مناسب لك. نوصّل مجانًا لكل أنحاء مصر، مع توصيل فائق السرعة خلال 3–6 ساعات في القاهرة الكبرى، ونلتزم بوعودنا كتابيًا.\n\nالصحة من الداخل.',
  },
  {
    slug: 'our-pharmacists',
    titleEn: 'Our pharmacists',
    titleAr: 'صيادلتنا',
    bodyEn:
      'Every Veeey order is reviewed by a licensed pharmacist.\n\nWe are here to help you choose the right product, the right dose, and the right routine — and to flag anything that may interact with your medication or condition. If you are pregnant, nursing, or taking prescription medicine, ask us first.\n\nReach our pharmacy team any time at info@veeey.com or on WhatsApp.',
    bodyAr:
      'تتم مراجعة كل طلب على Veeey بواسطة صيدلي مرخّص.\n\nنحن هنا لمساعدتك في اختيار المنتج المناسب والجرعة المناسبة والروتين المناسب — وللتنبيه إلى أي تعارض محتمل مع أدويتك أو حالتك. إذا كنتِ حاملًا أو مرضعة أو تتناول أدوية بوصفة طبية، اسألنا أولًا.\n\nتواصل مع فريق الصيدلة في أي وقت عبر info@veeey.com أو واتساب.',
  },
  {
    slug: 'careers',
    titleEn: 'Careers',
    titleAr: 'الوظائف',
    bodyEn:
      'Want to help build the most trusted way to buy supplements in Egypt?\n\nWe are always looking for pharmacists, operations and fulfilment talent, and product/engineering people who care about doing things properly.\n\nSend your CV to info@veeey.com with the role you are interested in.',
    bodyAr:
      'هل تريد المساعدة في بناء الطريقة الأكثر ثقة لشراء المكمّلات في مصر؟\n\nنبحث دائمًا عن صيادلة ومواهب في التشغيل والتجهيز، وأشخاص في المنتج والهندسة يهتمون بإتقان العمل.\n\nأرسل سيرتك الذاتية إلى info@veeey.com مع ذكر الوظيفة التي تهتم بها.',
  },
  {
    slug: 'contact',
    titleEn: 'Contact us',
    titleAr: 'تواصل معنا',
    bodyEn:
      'We would love to hear from you.\n\nEmail: info@veeey.com\nWhatsApp: available from the button on every page.\n\nFor order questions, please include your order number so our team can help faster.',
    bodyAr:
      'يسعدنا تواصلك معنا.\n\nالبريد الإلكتروني: info@veeey.com\nواتساب: متاح من الزر في كل صفحة.\n\nلأسئلة الطلبات، يرجى ذكر رقم طلبك حتى يساعدك فريقنا بشكل أسرع.',
  },
  {
    slug: 'shipping-delivery',
    titleEn: 'Shipping & delivery',
    titleAr: 'الشحن والتوصيل',
    bodyEn:
      'We deliver nationwide across Egypt.\n\n• Fast & Free — free standard delivery, 1–3 working days.\n• UltraFast — 3–6 hours within Greater Cairo (small fee).\n• Pick from Office — collect from our office the same day.\n\nDelivery options and fees may vary by area and are shown at checkout. You can pay cash on delivery, by card machine on delivery, by card online, or by bank transfer.',
    bodyAr:
      'نوصّل لكل أنحاء مصر.\n\n• سريع ومجاني — توصيل قياسي مجاني خلال 1–3 أيام عمل.\n• فائق السرعة — خلال 3–6 ساعات داخل القاهرة الكبرى (برسوم بسيطة).\n• الاستلام من المكتب — استلم من مكتبنا في نفس اليوم.\n\nقد تختلف خيارات التوصيل ورسومه حسب المنطقة وتظهر عند إتمام الطلب. يمكنك الدفع نقدًا عند الاستلام، أو بماكينة الدفع عند الاستلام، أو بالبطاقة إلكترونيًا، أو بتحويل بنكي.',
  },
  {
    slug: 'returns',
    titleEn: 'Returns',
    titleAr: 'الإرجاع',
    bodyEn:
      'Your satisfaction matters.\n\nIf something is wrong with your order — damaged, incorrect, or not as described — contact us within 14 days of delivery and we will make it right. For health and safety reasons, opened supplements cannot be returned unless faulty.\n\nTo start a return, go to your account order history and choose "Request return", or email info@veeey.com.',
    bodyAr:
      'رضاك يهمّنا.\n\nإذا كان هناك خطأ في طلبك — تالف أو غير صحيح أو مخالف للوصف — تواصل معنا خلال 14 يومًا من الاستلام وسنصحح الأمر. لأسباب صحية ووقائية، لا يمكن إرجاع المكمّلات المفتوحة إلا إذا كانت معيبة.\n\nلبدء الإرجاع، اذهب إلى سجل الطلبات في حسابك واختر «طلب إرجاع»، أو راسلنا على info@veeey.com.',
  },
  {
    slug: 'faq',
    titleEn: 'Frequently asked questions',
    titleAr: 'الأسئلة الشائعة',
    bodyEn:
      'Are your products authentic?\nYes — we import directly from trusted manufacturers and show each product’s expiry date before you buy.\n\nWhy do some products show different prices for different expiry dates?\nStock closer to its expiry date is offered at a smarter price. You choose the expiry that fits your routine.\n\nCan you bring a product you don’t stock?\nOften yes — we special-order from abroad. Ask us and we’ll confirm price and timeline.\n\nHow fast is delivery?\nFree nationwide delivery, and UltraFast 3–6 hours in Greater Cairo.',
    bodyAr:
      'هل منتجاتكم أصلية؟\nنعم — نستورد مباشرةً من مصنّعين موثوقين ونعرض تاريخ صلاحية كل منتج قبل الشراء.\n\nلماذا تظهر بعض المنتجات بأسعار مختلفة لتواريخ صلاحية مختلفة؟\nالمخزون الأقرب لتاريخ الصلاحية يُعرض بسعر أذكى. أنت تختار الصلاحية التي تناسب روتينك.\n\nهل يمكنكم إحضار منتج غير متوفر لديكم؟\nغالبًا نعم — نوفّره بطلب خاص من الخارج. اسألنا وسنؤكّد السعر والمدة.\n\nما سرعة التوصيل؟\nتوصيل مجاني لكل أنحاء مصر، وفائق السرعة خلال 3–6 ساعات في القاهرة الكبرى.',
  },
  {
    slug: 'authenticity-guarantee',
    titleEn: 'Authenticity guarantee',
    titleAr: 'ضمان الأصالة',
    bodyEn:
      'Every product we sell is genuine.\n\nWe import directly from trusted manufacturers and authorised distributors in the USA, UK and EU. We track each batch and show its expiry date before you buy. If you ever doubt the authenticity of anything you received, contact us and we will investigate immediately.',
    bodyAr:
      'كل منتج نبيعه أصلي.\n\nنستورد مباشرةً من مصنّعين موثوقين وموزّعين معتمدين في الولايات المتحدة والمملكة المتحدة والاتحاد الأوروبي. نتتبّع كل دفعة ونعرض تاريخ صلاحيتها قبل الشراء. إذا شككت يومًا في أصالة أي شيء استلمته، تواصل معنا وسنحقق فورًا.',
  },
  {
    slug: 'compensation-policy',
    titleEn: 'Compensation policy',
    titleAr: 'سياسة التعويض',
    metaDescEn: 'On-time delivery, guaranteed in writing.',
    bodyEn:
      'On-time, or compensated.\n\nFor special orders we agree a delivery date in advance. If we miss it beyond the agreed grace period, you receive automatic compensation as set out at the time of your order. Exact windows and amounts are configured per order type and shown to you before you confirm.\n\nThis is a starter policy draft — final terms will be confirmed at checkout.',
    bodyAr:
      'في الموعد، أو تعويض.\n\nبالنسبة للطلبات الخاصة نتفق على تاريخ توصيل مسبقًا. إذا تأخّرنا بعد فترة السماح المتفق عليها، تحصل على تعويض تلقائي وفق ما هو محدد وقت طلبك. تُضبط المدد والمبالغ بدقة لكل نوع طلب وتُعرض عليك قبل التأكيد.\n\nهذه مسودة سياسة مبدئية — تُؤكَّد الشروط النهائية عند إتمام الطلب.',
  },
  {
    slug: 'privacy-policy',
    titleEn: 'Privacy policy',
    titleAr: 'سياسة الخصوصية',
    bodyEn:
      'This is a starter privacy policy draft — please have it reviewed by a lawyer before relying on it.\n\nWe collect the information you give us (name, contact, address, order details) to process and deliver your orders, provide support, and improve your experience. We use cookies and analytics with your consent. We do not sell your personal data. You can request access to or deletion of your data by contacting info@veeey.com.',
    bodyAr:
      'هذه مسودة مبدئية لسياسة الخصوصية — يرجى مراجعتها بواسطة محامٍ قبل الاعتماد عليها.\n\nنجمع المعلومات التي تقدّمها لنا (الاسم، وسيلة التواصل، العنوان، تفاصيل الطلب) لمعالجة طلباتك وتوصيلها وتقديم الدعم وتحسين تجربتك. نستخدم ملفات تعريف الارتباط والتحليلات بموافقتك. لا نبيع بياناتك الشخصية. يمكنك طلب الوصول إلى بياناتك أو حذفها عبر info@veeey.com.',
  },
  {
    slug: 'terms-of-service',
    titleEn: 'Terms of service',
    titleAr: 'شروط الخدمة',
    bodyEn:
      'This is a starter terms draft — please have it reviewed by a lawyer before relying on it.\n\nBy using Veeey you agree to provide accurate information and to use the store lawfully. Prices, availability and expiry-based pricing are shown at the time of order and may change. Dietary supplements are not intended to diagnose, treat, cure or prevent any disease; consult your physician or pharmacist before use. Orders, returns, shipping and compensation are governed by the policies linked in the footer.',
    bodyAr:
      'هذه مسودة مبدئية للشروط — يرجى مراجعتها بواسطة محامٍ قبل الاعتماد عليها.\n\nباستخدامك Veeey فإنك توافق على تقديم معلومات دقيقة واستخدام المتجر بشكل قانوني. تُعرض الأسعار والتوفّر والتسعير حسب الصلاحية وقت الطلب وقد تتغيّر. المكمّلات الغذائية ليست مخصصة لتشخيص أي مرض أو علاجه أو الوقاية منه؛ استشر طبيبك أو الصيدلي قبل الاستخدام. تخضع الطلبات والإرجاع والشحن والتعويض للسياسات المرتبطة في تذييل الصفحة.',
  },
  {
    slug: 'special-order',
    titleEn: 'Special order',
    titleAr: 'طلب خاص',
    bodyEn:
      'Can’t find it? We’ll bring it.\n\nIf a product is sold abroad, we can source it for you — authentic, tracked, and on a fixed timeline. Share a link or a product name and our team will confirm the price and delivery date. Special orders are reserved with a deposit, and we back the delivery date with our compensation policy.\n\nTo request one, contact us at info@veeey.com or on WhatsApp.',
    bodyAr:
      'لم تجده؟ سنُحضره لك.\n\nإذا كان المنتج يُباع في الخارج، يمكننا توفيره لك — أصلي ومتتبَّع وضمن جدول زمني ثابت. شارك رابطًا أو اسم منتج وسيؤكّد فريقنا السعر وتاريخ التوصيل. تُحجز الطلبات الخاصة بعربون، ونضمن تاريخ التوصيل بسياسة التعويض.\n\nلطلب ذلك، تواصل معنا عبر info@veeey.com أو واتساب.',
  },
  {
    slug: 'payment-methods',
    titleEn: 'Payment methods',
    titleAr: 'طرق الدفع',
    metaDescEn: 'Pay for your Veeey order by cash on delivery, card machine, or secure online card payment.',
    bodyEn:
      'You can pay for your Veeey order in the way that suits you best:\n\n• Cash on Delivery — pay our courier in cash when your order arrives.\n• Card machine on delivery — pay by Visa or MasterCard at your door.\n• Online card payment (Visa / MasterCard) — pay securely during checkout through our certified payment gateway. We never store your full card details.\n• Bank transfer and mobile wallet — available on request for some orders.\n\nAll prices are shown in Egyptian Pounds (EGP) and include any applicable taxes. If a payment fails, your order is kept pending so you can try again.',
    bodyAr:
      'يمكنك دفع قيمة طلبك من Veeey بالطريقة التي تناسبك:\n\n• الدفع عند الاستلام — ادفع نقدًا لمندوب التوصيل عند وصول طلبك.\n• الدفع بالبطاقة عند الاستلام — ادفع بفيزا أو ماستركارد على باب منزلك.\n• الدفع الإلكتروني بالبطاقة (فيزا / ماستركارد) — ادفع بأمان أثناء إتمام الطلب عبر بوابة دفع معتمدة. لا نحتفظ ببيانات بطاقتك كاملة أبدًا.\n• التحويل البنكي والمحفظة الإلكترونية — متاحان عند الطلب لبعض الطلبات.\n\nجميع الأسعار بالجنيه المصري وتشمل أي ضرائب مطبّقة. في حال فشل الدفع، يبقى طلبك معلّقًا لتتمكن من المحاولة مرة أخرى.',
  },
  {
    slug: 'how-to-order',
    titleEn: 'How to order',
    titleAr: 'كيفية الطلب',
    metaDescEn: 'Ordering from Veeey is simple — browse, add to cart, choose delivery, and pay your way.',
    bodyEn:
      'Ordering from Veeey takes just a few minutes:\n\n1. Browse our products or search for what you need. Every product shows its expiry date before you buy.\n2. Add items to your cart and open the cart to review your order.\n3. Sign in or continue as a guest, then enter your delivery details.\n4. Choose a delivery option — Free delivery across Egypt, or UltraFast 3–6 hour delivery in Greater Cairo.\n5. Pick a payment method and place your order.\n\nYou will receive an order confirmation, and a licensed pharmacist reviews your order before it ships. Need help? Contact us at info@veeey.com or on WhatsApp.',
    bodyAr:
      'الطلب من Veeey يستغرق دقائق قليلة:\n\n1. تصفّح منتجاتنا أو ابحث عمّا تريد. كل منتج يعرض تاريخ صلاحيته قبل الشراء.\n2. أضف المنتجات إلى السلة ثم افتح السلة لمراجعة طلبك.\n3. سجّل الدخول أو تابع كزائر، ثم أدخل بيانات التوصيل.\n4. اختر طريقة التوصيل — توصيل مجاني لكل أنحاء مصر، أو توصيل فائق السرعة خلال 3–6 ساعات في القاهرة الكبرى.\n5. اختر طريقة الدفع وأكّد طلبك.\n\nستصلك رسالة تأكيد، ويراجع صيدلي مرخّص طلبك قبل الشحن. تحتاج مساعدة؟ تواصل معنا عبر info@veeey.com أو واتساب.',
  },
  {
    slug: 'track-order',
    titleEn: 'Track your order',
    titleAr: 'تتبّع طلبك',
    metaDescEn: 'Track your Veeey order status from your account or with the tracking number we send you.',
    bodyEn:
      'You can follow your order every step of the way:\n\n• Sign in to your account and open “Order history” to see the latest status of each order.\n• When your order ships, we send you a tracking number so you can follow the delivery.\n• You will also receive updates by email (and SMS, if enabled) when your order is placed, shipped, and delivered.\n\nIf anything looks wrong, contact us at info@veeey.com or on WhatsApp and our team will help.',
    bodyAr:
      'يمكنك متابعة طلبك في كل مرحلة:\n\n• سجّل الدخول إلى حسابك وافتح «سجل الطلبات» لرؤية أحدث حالة لكل طلب.\n• عند شحن طلبك، نرسل لك رقم تتبّع لمتابعة التوصيل.\n• ستصلك أيضًا تحديثات عبر البريد الإلكتروني (والرسائل القصيرة إن كانت مفعّلة) عند تأكيد الطلب وشحنه وتسليمه.\n\nإذا لاحظت أي خطأ، تواصل معنا عبر info@veeey.com أو واتساب وسيساعدك فريقنا.',
  },
  {
    slug: 'loyalty-rewards',
    titleEn: 'Veeey rewards',
    titleAr: 'مكافآت Veeey',
    metaDescEn: 'Earn loyalty points on every Veeey order and unlock tier benefits as you shop.',
    bodyEn:
      'Every order brings you closer to more value.\n\n• Earn loyalty points on your purchases and redeem them for discounts at checkout.\n• Move up our membership tiers as you shop to unlock better pricing and perks.\n• Invite friends with your referral code and earn rewards when they shop.\n\nYou can see your points balance, tier, and referral code any time in your account. Point and reward values are set by Veeey and may be updated; the current values always apply at checkout.',
    bodyAr:
      'كل طلب يقرّبك من قيمة أكبر.\n\n• اكسب نقاط ولاء على مشترياتك واستبدلها بخصومات عند إتمام الطلب.\n• ارتقِ بين مستويات العضوية كلما تسوّقت لتفتح أسعارًا ومزايا أفضل.\n• ادعُ أصدقاءك برمز الإحالة الخاص بك واكسب مكافآت عند تسوّقهم.\n\nيمكنك رؤية رصيد نقاطك ومستواك ورمز الإحالة في أي وقت من حسابك. قيم النقاط والمكافآت تحدّدها Veeey وقد تُحدَّث؛ وتُطبَّق القيم الحالية دائمًا عند الدفع.',
  },
  {
    slug: 'wholesale',
    titleEn: 'Wholesale & bulk orders',
    titleAr: 'الجملة والطلبات بالكميات',
    metaDescEn: 'Veeey supplies pharmacies, clinics, gyms, and corporate buyers with bulk supplement orders.',
    bodyEn:
      'Buying for a pharmacy, clinic, gym, or team?\n\nVeeey supplies authentic supplements and health devices in bulk, with the same expiry transparency and pharmacist oversight as our retail store. We offer tailored pricing for larger quantities and can arrange recurring orders.\n\nTo discuss a wholesale or corporate order, contact us at info@veeey.com or on WhatsApp with the products and quantities you need, and our team will prepare a quote.',
    bodyAr:
      'تشتري لصيدلية أو عيادة أو صالة رياضية أو فريق؟\n\nتوفّر Veeey مكمّلات وأجهزة صحية أصلية بالكميات، بنفس شفافية الصلاحية وإشراف الصيادلة كما في متجرنا. نقدّم أسعارًا مخصّصة للكميات الكبيرة ويمكننا ترتيب طلبات متكرّرة.\n\nلمناقشة طلب جملة أو طلب للشركات، تواصل معنا عبر info@veeey.com أو واتساب مع المنتجات والكميات المطلوبة، وسيُعدّ فريقنا عرض سعر.',
  },
  {
    slug: 'cookie-policy',
    titleEn: 'Cookie policy',
    titleAr: 'سياسة ملفات تعريف الارتباط',
    metaDescEn: 'How Veeey uses cookies and similar technologies, and how you can control them.',
    bodyEn:
      'Veeey uses cookies and similar technologies to make the website work and to improve your experience.\n\n• Essential cookies keep you signed in, remember your cart, and keep the site secure. These are always on.\n• Analytics cookies help us understand how the site is used so we can improve it. These run only with your consent.\n• Preference cookies remember choices such as your language.\n\nYou can accept or decline non-essential cookies from our consent banner, and you can change your choice at any time in your browser settings. Declining analytics cookies will not stop you from shopping. For more detail on the data we hold, see our Privacy Policy.',
    bodyAr:
      'تستخدم Veeey ملفات تعريف الارتباط والتقنيات المشابهة لتشغيل الموقع وتحسين تجربتك.\n\n• الملفات الأساسية تُبقيك مسجّل الدخول وتتذكّر سلتك وتحافظ على أمان الموقع. وهي مفعّلة دائمًا.\n• ملفات التحليلات تساعدنا على فهم كيفية استخدام الموقع لتحسينه. وتعمل فقط بموافقتك.\n• ملفات التفضيلات تتذكّر اختياراتك مثل اللغة.\n\nيمكنك قبول أو رفض الملفات غير الأساسية من شريط الموافقة، ويمكنك تغيير اختيارك في أي وقت من إعدادات متصفحك. رفض ملفات التحليلات لن يمنعك من التسوّق. لمزيد من التفاصيل عن البيانات التي نحتفظ بها، راجع سياسة الخصوصية.',
  },
];

type Post = { slug: string; titleEn: string; titleAr: string; excerptEn: string; excerptAr: string; bodyEn: string; bodyAr: string };

const posts: Post[] = [
  {
    slug: 'how-to-read-a-supplement-label',
    titleEn: 'How to read a supplement label like a pharmacist',
    titleAr: 'كيف تقرأ ملصق المكمّل الغذائي مثل الصيدلي',
    excerptEn: 'Dosage, bioavailability, and the fine print that actually matters.',
    excerptAr: 'الجرعة والتوافر الحيوي والتفاصيل الدقيقة التي تهم فعلًا.',
    bodyEn:
      'A supplement label tells you more than the marketing on the front. Start with the serving size and servings per container — that’s how you know how long a bottle really lasts and the true cost per day.\n\nCheck the active ingredient and its form: some forms are absorbed far better than others. Look for the amount per serving against a known reference, and scan the "other ingredients" line for fillers or allergens.\n\nFinally, check the expiry date — potency fades over time. At Veeey we show it before you buy.',
    bodyAr:
      'يخبرك ملصق المكمّل بأكثر مما تقوله الدعاية في الواجهة. ابدأ بحجم الحصة وعدد الحصص في العبوة — بذلك تعرف كم تدوم العبوة فعلًا والتكلفة الحقيقية لليوم.\n\nتحقّق من المكوّن الفعّال وشكله: بعض الأشكال تُمتَص أفضل بكثير من غيرها. انظر إلى الكمية لكل حصة مقارنةً بمرجع معروف، وافحص سطر «المكوّنات الأخرى» بحثًا عن مواد مالئة أو مسبّبات حساسية.\n\nأخيرًا، تحقّق من تاريخ الصلاحية — تقل الفعالية مع الوقت. في Veeey نعرضه قبل الشراء.',
  },
  {
    slug: 'does-expiry-change-potency',
    titleEn: 'Does the expiry date really change a supplement’s potency?',
    titleAr: 'هل يؤثّر تاريخ الصلاحية فعلًا على فعالية المكمّل؟',
    excerptEn: 'What shelf life means for vitamins, omegas, and minerals.',
    excerptAr: 'ماذا تعني مدة الصلاحية للفيتامينات والأوميغا والمعادن.',
    bodyEn:
      'Expiry dates are a manufacturer’s guarantee of full potency, not a cliff. Minerals are very stable; many vitamins decline slowly; sensitive ingredients like probiotics and omega-3 oils are the most time- and storage-sensitive.\n\nStored cool and dry, most supplements remain effective up to their printed date. That’s why we show the exact expiry of each lot — and offer shorter-dated stock at a smarter price for routines you’ll finish soon.',
    bodyAr:
      'تواريخ الصلاحية ضمان من المصنّع للفعالية الكاملة، وليست حدًّا فاصلًا. المعادن مستقرة جدًا؛ وكثير من الفيتامينات يتراجع ببطء؛ أما المكوّنات الحساسة مثل البروبيوتيك وزيوت الأوميغا-3 فهي الأكثر حساسية للوقت والتخزين.\n\nعند حفظها في مكان بارد وجاف، تظل معظم المكمّلات فعّالة حتى التاريخ المطبوع. لذلك نعرض الصلاحية الدقيقة لكل دفعة — ونوفّر المخزون الأقرب انتهاءً بسعر أذكى للروتين الذي ستنهيه قريبًا.',
  },
  {
    slug: 'choosing-the-right-omega-3',
    titleEn: 'Choosing the right omega-3',
    titleAr: 'كيف تختار الأوميغا-3 المناسبة',
    excerptEn: 'EPA vs DHA, dosage, and what "high concentration" really means.',
    excerptAr: 'EPA مقابل DHA، والجرعة، وماذا يعني «التركيز العالي» فعلًا.',
    bodyEn:
      'Not all fish oils are equal. What matters is the actual EPA and DHA per serving — not the total fish-oil weight. A "1000 mg" capsule may contain only a fraction as active omega-3.\n\nDecide your goal (heart, brain, joints), check the EPA/DHA split, and prefer a form your body absorbs well. As always, ask our pharmacists if you’re on medication.',
    bodyAr:
      'ليست كل زيوت السمك متساوية. المهم هو كمية EPA وDHA الفعلية لكل حصة — وليس الوزن الإجمالي لزيت السمك. قد تحتوي كبسولة «1000 ملغ» على جزء بسيط فقط كأوميغا-3 فعّالة.\n\nحدّد هدفك (القلب، الدماغ، المفاصل)، وتحقّق من نسبة EPA/DHA، وفضّل شكلًا يمتصّه جسمك جيدًا. وكالعادة، اسأل صيادلتنا إذا كنت تتناول دواءً.',
  },
];

async function main() {
  for (const p of pages) {
    await prisma.cmsPage.upsert({
      where: { slug: p.slug },
      update: { titleEn: p.titleEn, titleAr: p.titleAr, bodyEn: p.bodyEn, bodyAr: p.bodyAr, status: 'PUBLISHED', metaDescEn: p.metaDescEn ?? null },
      create: { slug: p.slug, titleEn: p.titleEn, titleAr: p.titleAr, bodyEn: p.bodyEn, bodyAr: p.bodyAr, status: 'PUBLISHED', metaDescEn: p.metaDescEn ?? null },
    });
  }
  const now = new Date();
  for (const post of posts) {
    await prisma.blogPost.upsert({
      where: { slug: post.slug },
      update: { titleEn: post.titleEn, titleAr: post.titleAr, excerptEn: post.excerptEn, excerptAr: post.excerptAr, bodyEn: post.bodyEn, bodyAr: post.bodyAr, status: 'PUBLISHED' },
      create: { slug: post.slug, titleEn: post.titleEn, titleAr: post.titleAr, excerptEn: post.excerptEn, excerptAr: post.excerptAr, bodyEn: post.bodyEn, bodyAr: post.bodyAr, status: 'PUBLISHED', publishedAt: now },
    });
  }
  console.log(`Seeded ${pages.length} CMS pages + ${posts.length} blog posts.`);
}

main().then(() => prisma.$disconnect()).catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
