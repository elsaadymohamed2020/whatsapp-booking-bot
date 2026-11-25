# بوت حجز المواعيد عبر واتساب

[English README](README.md)

بوت محادثة للشركات ومقدّمي الخدمات، يساعد العملاء على حجز المواعيد وإدارتها عبر واتساب، من دون الحاجة إلى تنزيل تطبيق أو تعبئة نموذج. يختار العميل الخدمة واليوم والوقت، ثم يراجع تفاصيل الموعد ويؤكده.

## ماذا يفعل؟

- يعرض قائمة الخدمات، ثم يتيح اختيار اليوم والوقت المناسبين.
- يحسب الأوقات المتاحة بحسب ساعات العمل والمنطقة الزمنية للنشاط، ويتحقق من عدم وجود حجز آخر للموعد نفسه.
- يطلب تأكيد العميل قبل إنشاء الحجز، ثم يرسل تفاصيل الموعد ورمزًا قصيرًا للحجز.
- يتيح للعميل عرض حجوزاته وإلغاء الحجز برسالة تتضمن رمز الحجز، ولا يسمح بإلغاء حجز شخص آخر.
- يفهم الرسائل باللغة الطبيعية بالعربية والإنجليزية باستخدام OpenAI عند ضبط مفتاح الخدمة. ومن دون المفتاح، يستخدم وضعًا مدمجًا قائمًا على القواعد.
- يرسل الردود عبر WhatsApp Business Cloud API عند إعداد بيانات Meta. ومن دون رمز واتساب، يسجّل الردود بدلًا من إرسالها.

> **التذكيرات التلقائية:** ميزة مخططة، وليست مفعّلة في النسخة الحالية.

## التقنيات

- Node.js 20+ وTypeScript
- Express 5
- WhatsApp Business Cloud API من Meta
- OpenAI لفهم الرسائل واستخراج تفاصيل الطلب، مع بديل قائم على القواعد
- MongoDB مع Mongoose لتخزين الحجوزات، أو تخزين مؤقت في الذاكرة إذا لم تُضبط قاعدة البيانات
- Luxon للمناطق الزمنية، وZod للتحقق من الإعدادات والبيانات

## التشغيل السريع

تحتاج إلى Node.js 20 أو أحدث. استنسخ المشروع وثبّت الاعتماديات، ثم شغّل الاختبارات ومحادثة الطرفية:

```bash
git clone https://github.com/elsaadymohamed2020/whatsapp-booking-bot.git
cd whatsapp-booking-bot
npm install
cp .env.example .env
npm test
npm run chat
```

لتشغيل خادم التطوير، استخدم `npm run dev`. يمكن تجربة مسار المحادثة المحلي عبر `POST /dev/chat` عندما لا يكون `WHATSAPP_TOKEN` مضبوطًا.

### التشغيل مع MongoDB باستخدام Docker

```bash
cp .env.example .env
docker compose up --build
```

### ربط رقم واتساب حقيقي

1. أنشئ تطبيقًا في [Meta for Developers](https://developers.facebook.com/) وأضف منتج WhatsApp.
2. أضف المتغيرات `WHATSAPP_TOKEN` و`WHATSAPP_PHONE_NUMBER_ID` و`WHATSAPP_VERIFY_TOKEN` و`WHATSAPP_APP_SECRET` إلى ملف `.env`.
3. وفّر عنوان HTTPS للخادم، ثم اضبط عنوان الـ webhook في لوحة Meta على `https://<your-host>/webhook` واشترك في حقل `messages`.
4. شغّل الخادم وأرسل رسالة إلى رقم واتساب المرتبط بالتطبيق.

### إعدادات مهمة

- `MONGODB_URI`: رابط MongoDB؛ إذا كان فارغًا، يستخدم البوت التخزين المؤقت في الذاكرة.
- `OPENAI_API_KEY`: مفتاح OpenAI؛ إذا كان فارغًا، يستخدم البوت وضع الفهم القائم على القواعد.
- `WHATSAPP_TOKEN` و`WHATSAPP_PHONE_NUMBER_ID`: بيانات إرسال الرسائل عبر WhatsApp Cloud API.
- `WHATSAPP_VERIFY_TOKEN` و`WHATSAPP_APP_SECRET`: للتحقق من إعداد الـ webhook والرسائل الواردة.
- `BUSINESS_TIMEZONE`: المنطقة الزمنية للنشاط، والافتراضي `Africa/Cairo`.
- `BUSINESS_DAYS` و`BUSINESS_OPEN` و`BUSINESS_CLOSE`: أيام وساعات العمل.

راجع `.env.example` لمعرفة بقية المتغيرات.

## الاختبارات وجودة الكود

```bash
npm test
npm run lint
npm run build
```

## الترخيص

المشروع مرخّص بموجب MIT.
