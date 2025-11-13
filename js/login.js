import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { getDatabase, ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

// 🔧 Configuração Firebase
const firebaseConfig = {
  apiKey: "AIzaSyCdLIRF811LJ7-BEnXxeht6sXvEtTiYn2U",
  authDomain: "sistema-colegio-saber.firebaseapp.com",
  databaseURL: "https://sistema-colegio-saber-default-rtdb.firebaseio.com",
  projectId: "sistema-colegio-saber",
  storageBucket: "sistema-colegio-saber.firebasestorage.app",
  messagingSenderId: "905380056037",
  appId: "1:905380056037:web:39b6b31f0e5dabb412bd0c"
};

// Inicializa Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const loginForm = document.getElementById("loginForm");
const mensagem = document.getElementById("mensagem");

// 🧠 Login
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value.trim();
  const senha = document.getElementById("senha").value.trim();
  mensagem.textContent = "";

  // 🔹 1. Verifica ADMIN LOCAL primeiro (antes de chamar Firebase)
  if (email === "admin@saber.com" && senha === "adminS@ber") {
    window.location.href = "admin.html";
    return;
  }

  try {
    // 🔹 2. Agora tenta autenticar no Firebase
    const cred = await signInWithEmailAndPassword(auth, email, senha);

    // 🔎 Verifica o tipo de usuário no banco
    const snapshot = await get(ref(db, "users/" + cred.user.uid));
    const userData = snapshot.val();

    if (!userData) {
      throw new Error("Usuário não encontrado no banco de dados.");
    }

    // 🔀 Redireciona conforme o papel (role)
    if (userData.role === "teacher") {
      window.location.href = "professor.html";
    } else if (userData.role === "student") {
      window.location.href = "aluno.html";
    } else if (userData.role === "admin") {
      window.location.href = "admin.html";
    } else {
      throw new Error("Tipo de usuário inválido.");
    }

  } catch (err) {
    console.error(err);
    mensagem.textContent = "Erro ao logar: " + err.message;
  }
});

// --------- ESQUECI MINHA SENHA ---------
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";

const btnEsqueciSenha = document.getElementById("btnEsqueciSenha");

if (btnEsqueciSenha) {
  btnEsqueciSenha.addEventListener("click", async (e) => {
    e.preventDefault();
    const email = document.getElementById("email").value.trim();

    if (!email) {
      alert("Por favor, digite seu e-mail para redefinir a senha.");
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      alert(`✅ Um e-mail foi enviado para ${email} com o link para redefinir sua senha.`);
    } catch (err) {
      console.error(err);
      alert("❌ Erro ao enviar e-mail de redefinição: " + err.message);
    }
  });
}
