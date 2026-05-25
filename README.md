# 🎓 Adam Asmaca Eğitim Platformu (Hangman Game)

Öğrenciler için özel olarak tasarlanmış, **MEB müfredatıyla uyumlu** çalışan dinamik bir Adam Asmaca eğitim platformu! Progressive Web App (PWA) altyapısı sayesinde mobil uygulama gibi kullanılabilir.

## ✨ Özellikler

- **Sınıf ve Ders Seçimi:** 1. sınıftan 12. sınıfa kadar öğrencilerin kendi sınıf ve derslerini seçebileceği karşılama ekranı.
- **Otomatik Müfredat Takibi:** İçinde bulunduğunuz aya göre doğru ünite otomatik olarak **"Şu Anki Ünite"** rozetiyle vurgulanır. Öğrenci doğru hedefe yönlendirilir.
- **Modern ve Premium Tasarım:** Glassmorphism etkileri, tatmin edici mikro animasyonlar ve şık tipografi.
- **Dark / Light Mod:** Sağ üst köşedeki butonla iki harika tema arasında geçiş yapılabilir.
- **PWA Desteği (Mobil Uygulama Uyumlu):** Telefonunuzun tarayıcısından girip "Ana Ekrana Ekle" diyerek uygulamayı cihazınıza tam ekran bir mobil uygulama gibi kurabilirsiniz.

## 🚀 Kurulum & Çalıştırma

Proje herhangi bir derleme aşaması (npm, webpack vb.) gerektirmez. Sadece dosyaları bir sunucuya atmanız yeterlidir!

1. Bu repoyu bilgisayarınıza indirin (clone).
2. Dosyaları herhangi bir web sunucusunda (örneğin `Live Server`, `GitHub Pages`, `Netlify`, `Vercel`) açın.
3. Keyfini çıkarın!

## ✏️ Öğretmenler İçin: Soru ve Ünite Ekleme

Uygulamadaki tüm sorular ve ders yapıları ana dizindeki `questions.json` dosyasından çekilmektedir. Harika bir hiyerarşik yapıya sahiptir.

Bir metin editörüyle `questions.json` dosyasını açarak kendi derslerinizi, ünitelerinizi ve kelimelerinizi kolayca ekleyebilirsiniz:

```json
{
  "curriculum": [
    {
      "grade": 4,
      "gradeName": "4. Sınıf",
      "subjects": [
        {
          "id": "fen",
          "name": "Fen Bilimleri",
          "units": [
            {
              "id": "fen_u1",
              "name": "1. Ünite: Yer Kabuğu ve Dünyamızın Hareketleri",
              "months": [9, 10], 
              "words": [
                {"word": "KAYAÇ", "hint": "Yer kabuğunu oluşturan büyük taş kütleleri"}
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

*Not: Kelimeleri ("word" kısmı) her zaman **TÜRKÇE KARAKTERLER VE BÜYÜK HARFLERLE** yazmaya özen gösterin.*

## 🛠️ Teknolojiler

- **HTML5:** Yapı ve Semantik etiketler
- **Vanilla CSS:** Özel değişkenler (CSS variables) ve modern grid/flexbox yapıları
- **Vanilla JavaScript (ES6+):** Harici kütüphane gerektirmeyen oyun motoru ve JSON veri işleme
- **PWA (Progressive Web App):** Mobil kurulum (manifest.json) desteği

---
*İyi eğlenceler ve iyi dersler!*
