document.addEventListener("DOMContentLoaded", () => {
  const SITE_PASSWORD = "eofarmas";
  const ACCESS_KEY = "elementalAccess";

  const passwordScreen = document.getElementById("passwordScreen");
  const mainApp = document.getElementById("mainApp");
  const passwordInput = document.getElementById("passwordInput");
  const passwordButton = document.getElementById("passwordButton");
  const passwordError = document.getElementById("passwordError");

  if (!passwordScreen || !mainApp || !passwordInput || !passwordButton || !passwordError) {
    console.error("Elementos da tela de senha não foram encontrados.");
    return;
  }

  function unlockSite() {
    sessionStorage.setItem(ACCESS_KEY, "allowed");
    passwordScreen.style.display = "none";
    mainApp.style.display = "grid";
    passwordInput.value = "";
    passwordError.style.display = "none";
  }

  function lockSite() {
    passwordScreen.style.display = "flex";
    mainApp.style.display = "none";
    passwordInput.value = "";
    passwordError.style.display = "none";
    setTimeout(() => passwordInput.focus(), 50);
  }

  function checkPassword() {
    if (passwordInput.value.trim() === SITE_PASSWORD) {
      unlockSite();
      return;
    }
    passwordError.textContent = "Senha incorreta.";
    passwordError.style.display = "block";
    passwordInput.value = "";
    passwordInput.focus();
  }

  sessionStorage.getItem(ACCESS_KEY) === "allowed" ? unlockSite() : lockSite();
  passwordButton.addEventListener("click", checkPassword);
  passwordInput.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      checkPassword();
    }
  });
});
