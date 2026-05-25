# 🎮 Adam Asmaca (Hangman Game)

Modern, karanlık/aydınlık (dark/light) tema destekli ve tamamen dinamik bir **Adam Asmaca** web & mobil oyunu! Vanilla JavaScript, CSS ve HTML kullanılarak geliştirilmiş olup, Progressive Web App (PWA) altyapısına sahiptir.

## ✨ Özellikler

- **Modern ve Premium Tasarım:** Glassmorphism etkileri, tatmin edici mikro animasyonlar ve şık tipografi.
- **PWA Desteği (Mobil Uygulama Uyumlu):** Telefonunuzun tarayıcısından girip "Ana Ekrana Ekle" diyerek uygulamayı cihazınıza bir mobil uygulama gibi kurabilirsiniz.
- **Dinamik Soru Havuzu:** Sorular kodun içine gömülü değildir. Harici bir `questions.json` dosyasından otomatik olarak çekilir.
- **Kategori ve İpucu Sistemi:** Oyuncuya kelime hakkında ipuçları sunar.
- **Dark / Light Mod:** Sağ üst köşedeki butonla iki harika tema arasında geçiş yapılabilir.

## 🚀 Kurulum & Çalıştırma

Proje herhangi bir derleme aşaması (npm, webpack vb.) gerektirmez. Sadece dosyaları bir sunucuya atmanız yeterlidir!

1. Bu repoyu bilgisayarınıza indirin (clone).
2. Dosyaları herhangi bir web sunucusunda (örneğin `Live Server`, `GitHub Pages`, `Netlify`, `Vercel`) açın.
3. Keyfini çıkarın!

## ✏️ Soruları Düzenleme (Kendi Sorularınızı Ekleyin)

Oyundaki soruları değiştirmek çok kolaydır. Proje ana dizininde bulunan `questions.json` dosyasını bir metin editörüyle açın ve kendi kelimelerinizi ekleyin:

```json
[
  {
    "word": "YAZILIM",
    "hint": "Bilgisayar programları",
    "category": "Teknoloji"
  }
]
```

Eğer soruları internet üzerindeki harici bir veritabanından çekmek isterseniz, `main.js` içindeki 3. satırda yer alan linki değiştirmeniz yeterlidir:
```javascript
const QUESTIONS_URL = 'https://siteniz.com/kendi-sorulariniz.json';
```

## 🛠️ Teknolojiler

- **HTML5:** Yapı ve Semantik etiketler
- **Vanilla CSS:** Özel değişkenler (CSS variables) ve modern grid/flexbox yapıları
- **Vanilla JavaScript (ES6+):** Harici kütüphane gerektirmeyen oyun motoru
- **PWA (Progressive Web App):** Mobil kurulum (manifest.json) desteği

---
*İyi eğlenceler!*
