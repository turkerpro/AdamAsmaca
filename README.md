# 🎓 Adam Asmaca Eğitim Platformu (Hangman Game)

Öğrenciler için özel olarak tasarlanmış, **MEB müfredatıyla uyumlu** çalışan dinamik bir Adam Asmaca eğitim platformu! Progressive Web App (PWA) altyapısı sayesinde mobil uygulama gibi kullanılabilir.

## ✨ Özellikler

- **Sınıf ve Ders Seçimi:** 1. sınıftan 12. sınıfa kadar öğrencilerin kendi sınıf ve derslerini seçebileceği karşılama ekranı.
- **Otomatik Müfredat Takibi:** İçinde bulunduğunuz aya göre doğru ünite otomatik olarak **"Şu Anki Ünite"** rozetiyle vurgulanır. Öğrenci doğru hedefe yönlendirilir.
- **Sınırsız Ölçeklenebilirlik (Lazy Loading):** Yüz binlerce kelime ve ünite eklense bile uygulamanın açılış hızı yavaşlamaz. Sistem sadece tıklanan dersin verisini anlık olarak indirir.
- **Modern ve Premium Tasarım:** Glassmorphism etkileri, tatmin edici mikro animasyonlar ve şık tipografi.
- **Dark / Light Mod:** İki harika tema arasında geçiş yapılabilir.

## 🚀 Kurulum & Çalıştırma

Proje herhangi bir derleme aşaması (npm, webpack vb.) gerektirmez. Sadece dosyaları bir sunucuya atmanız yeterlidir!

1. Bu repoyu bilgisayarınıza indirin (clone).
2. Dosyaları herhangi bir web sunucusunda (örneğin `Live Server`, `GitHub Pages`, `Netlify`, `Vercel`) açın.
3. Keyfini çıkarın!

## ✏️ Öğretmenler İçin: Soru ve Ünite Ekleme

Tüm sorular tek bir dosyada karmaşa yaratmasın diye veritabanı **derslere özel klasörlere** bölünmüştür. Yeni bir soru veya ders eklemek çok basittir:

### 1. Klasör Yapısı
Projedeki veriler `data/` klasörü içinde sınıf ve ders bazlı olarak saklanır:
```text
/curriculum_index.json  <-- Sınıfların ve Derslerin LİSTESİ
/data
  /grade_4
    fen.json            <-- 4. Sınıf Fen Bilimleri kelimeleri
```

### 2. Soru Dosyası Oluşturma (Örnek: Türkçe)
Kendi branşınızın klasörüne (örneğin `/data/grade_5/turkce.json`) gidip ünitelerinizi şu şablonla girebilirsiniz:

```json
{
  "units": [
    {
      "id": "tur_u1",
      "name": "1. Ünite: Anlam Bilgisi",
      "months": [9, 10], 
      "words": [
        {"word": "ZIT", "hint": "Anlamca birbirinin tersi olan kelimeler"},
        {"word": "ESANLAMLI", "hint": "Yazılışları farklı, anlamları aynı kelimeler"}
      ]
    }
  ]
}
```
*(Not: `months` kısmı bu ünitenin hangi aylarda "Şu Anki Ünite" olarak işaretleneceğini belirtir. Kelimeleri daima **BÜYÜK HARFLE VE TÜRKÇE KARAKTERLERLE** yazın).*

### 3. Yeni Dersi Sisteme Tanıtma
Ana dizindeki `curriculum_index.json` dosyasını açıp oluşturduğunuz ders dosyasının yolunu (`dataFile`) belirtmeniz yeterlidir. Uygulama otomatik olarak dersi görüp listeye ekleyecektir!

## 🛠️ Teknolojiler

- **HTML5:** Yapı ve Semantik etiketler
- **Vanilla CSS:** Özel değişkenler (CSS variables) ve modern grid/flexbox yapıları
- **Vanilla JavaScript (ES6+):** Harici kütüphane gerektirmeyen asenkron oyun motoru
- **PWA (Progressive Web App):** Mobil kurulum desteği

---
*İyi eğlenceler ve iyi dersler!*
