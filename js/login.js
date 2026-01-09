import { auth, db } from "/js/firebase.js";
import { signInWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.13.1/firebase-database.js";

document.addEventListener("DOMContentLoaded", () => {

  const form = document.getElementById("loginForm");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault(); // impede reload da página

    const email = document.getElementById("email").value.trim();
    const senha = document.getElementById("senha").value.trim();

    if (!email || !senha) {
      alert("Preencha todos os campos!");
      return;
    }

    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, senha);
      const user = userCredential.user;

      const snap = await get(ref(db, "users/" + user.uid));

      if (!snap.exists()) {
        alert("Usuário sem dados no banco!");
        return;
      }

      const dados = snap.val();

      if (dados.role === "admin") {
        window.location.href = "admin.html";
      } 
      else if (dados.role === "teacher") {
        window.location.href = "professor.html";
      }
      else if (dados.role === "student") {
        window.location.href = "aluno.html";
      }
      else {
        alert("Perfil inválido.");
      }

    } catch (err) {
      alert("Erro ao fazer login: " + err.message);
    }
  });
});
