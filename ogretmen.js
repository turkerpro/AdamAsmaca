// ── ÖĞRETMEN PANELİ YÖNLENDİRME YAPILANDIRMASI ────────────────────────────────

// Lütfen buradaki URL'yi kendi oluşturduğunuz Google Form'un linki ile değiştirin:
const TEACHER_FORM_URL = "https://forms.gle/4yUimweuP6BPTVyu9"; 

document.addEventListener("DOMContentLoaded", () => {
  // Tema yönetimi
  const savedTheme = localStorage.getItem("adamAsmacaTheme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);

  // Form butonunun linkini güncelle
  const openFormBtn = document.getElementById("btn-open-form");
  if (openFormBtn) {
    openFormBtn.href = TEACHER_FORM_URL;
  }
  
  console.log("Öğretmen paneli form yönlendirmesi hazır:", TEACHER_FORM_URL);
});
